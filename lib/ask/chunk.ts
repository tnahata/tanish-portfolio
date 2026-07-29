import { createHash } from 'crypto';
import { estimateTokens } from './tokens';
import type { CorpusChunk } from './types';

/**
 * Splits corpus documents into the chunks that get embedded and retrieved.
 *
 * Sections are cut on markdown headings and packed toward a token target. A chunk is what
 * retrieval returns, so a section that only makes sense after reading the one above it will
 * be shown without it. That is a writing constraint, enforced by convention in the corpus
 * files rather than by this module.
 *
 * Whether a document splits at all is a structural decision, not a size one: a document with
 * zero or one heading section stays whole, and a document with two or more always splits on
 * those headings. See chunkDocument for why.
 */

/** Target size for a packed chunk. Soft: a single oversized section is never split. */
const TARGET_TOKENS = 800;

/** Trailing context copied from the previous chunk, so a boundary does not orphan a claim. */
const OVERLAP_TOKENS = 100;

/**
 * Packing target for a multi-section document whose total already fits under TARGET_TOKENS.
 *
 * The packing loop below only closes a chunk when adding the next section would overflow the
 * target. If a document's whole body is already under TARGET_TOKENS, that overflow check can
 * never fire, so packing toward TARGET_TOKENS would silently re-merge every section back into
 * one chunk: the same output the removed single-chunk shortcut produced. This smaller target
 * is what actually forces a split for those documents.
 *
 * Value chosen against the real corpus (see docs/ask-agent/01-corpus.md): small enough that
 * faq.md's six ~70-100 token sections separate into topically distinct chunks instead of
 * collapsing back into one, large enough that a lone ~30-40 token section (e.g. faq.md's
 * "Location and remote") still gets pulled into a neighboring chunk instead of standing alone
 * as a fragment.
 */
const SHORT_DOC_TARGET_TOKENS = 200;

const HEADING_PATTERN = /^(#{2,3})\s+(.*)$/;

interface Section {
  heading: string | null;
  content: string;
}

/**
 * Splits on `##` and `###` headings. Text before the first heading becomes a leading
 * section with a null heading. The heading line stays in the section body: it is real
 * context for retrieval, and dropping it would strip the only label most sections have.
 */
export function splitOnHeadings(markdown: string): Section[] {
  const sections: Section[] = [];
  let heading: string | null = null;
  let buffer: string[] = [];

  const flush = (): void => {
    const content = buffer.join('\n').trim();
    if (content) sections.push({ heading, content });
    buffer = [];
  };

  for (const line of markdown.split('\n')) {
    const match = line.match(HEADING_PATTERN);
    if (match) {
      flush();
      heading = match[2].trim();
    }
    buffer.push(line);
  }
  flush();

  return sections;
}

/** Last `tokens` worth of whole lines from a chunk, used as overlap into the next one. */
function tailForOverlap(text: string, tokens: number): string {
  const lines = text.split('\n');
  const kept: string[] = [];
  let total = 0;

  for (let i = lines.length - 1; i >= 0; i--) {
    const cost = estimateTokens(lines[i]);
    if (total + cost > tokens && kept.length > 0) break;
    kept.unshift(lines[i]);
    total += cost;
  }

  return kept.join('\n');
}

export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function toChunk(content: string, heading: string | null, ordinal: number): CorpusChunk {
  const trimmed = content.trim();
  return {
    ordinal,
    heading,
    content: trimmed,
    contentHash: hashContent(trimmed),
    tokenCount: estimateTokens(trimmed),
  };
}

/**
 * Packs sections into chunks toward `target` tokens, carrying OVERLAP_TOKENS of trailing
 * context across each boundary. A single section at or above `target` is emitted whole
 * rather than split mid-prose: sections are authored units, and cutting one at an arbitrary
 * token offset produces a chunk that starts mid-argument, which retrieves worse than an
 * oversized chunk does.
 */
function packSections(sections: Section[], target: number): CorpusChunk[] {
  const chunks: CorpusChunk[] = [];
  let pending: string[] = [];
  let pendingHeading: string | null = null;
  let pendingTokens = 0;

  const flush = (): void => {
    if (!pending.length) return;
    chunks.push(toChunk(pending.join('\n\n'), pendingHeading, chunks.length));
    const overlap = tailForOverlap(pending.join('\n\n'), OVERLAP_TOKENS);
    pending = overlap ? [overlap] : [];
    pendingTokens = overlap ? estimateTokens(overlap) : 0;
    pendingHeading = null;
  };

  for (const section of sections) {
    const cost = estimateTokens(section.content);

    // Packing this section would overflow the target, so close the current chunk first.
    // Skipped when `pending` is only carried-over overlap (pendingHeading still null): flushing
    // that would emit a chunk that is pure duplicate text from the previous chunk with no new
    // section of its own, which is a worse fragment than a chunk that runs slightly over target.
    if (pendingTokens > 0 && pendingHeading !== null && pendingTokens + cost > target) flush();

    if (pendingHeading === null) pendingHeading = section.heading;
    pending.push(section.content);
    pendingTokens += cost;

    // An oversized section cannot be packed with anything: emit it alone.
    if (cost >= target) flush();
  }

  // Whatever remains is a real chunk unless it is only the carried-over overlap.
  if (pending.length && chunks.length > 0) {
    const remainder = pending.join('\n\n').trim();
    const isOnlyOverlap = chunks.some((c) => c.content.endsWith(remainder));
    if (!isOnlyOverlap) flush();
  } else {
    flush();
  }

  return chunks;
}

/**
 * Chunks a document body.
 *
 * A document with zero or one heading section stays a single chunk: there is nothing to
 * separate it from. A document with two or more sections always splits on those headings,
 * regardless of total size.
 *
 * Size-based short-circuiting was tried and rejected: a chunk is the unit an embedding
 * represents and the unit retrieval returns. A short document with several unrelated heading
 * sections (e.g. faq.md: what he's looking for, work authorization, location, availability,
 * compensation, contact) collapsed into one chunk pulls that embedding toward the centroid of
 * everything it contains, which can sink a specific question below the retrieval threshold
 * even though the corpus states the answer plainly. It also over-returns on the verbatim path:
 * the whole matched chunk gets quoted, so a compensation question would surface work
 * authorization and availability alongside it.
 *
 * Splitting does not cost corroboration. The grounding ladder requires supporting chunks from
 * two distinct documents (see docs/ask-agent/04-retrieval-grounding.md), specifically because
 * the ~100 token overlap between adjacent chunks of one document would otherwise let a single
 * passage satisfy "two chunks" by itself. Extra chunks inside one document were never eligible
 * to corroborate each other, so splitting one more time has no cost on that axis.
 *
 * Sections pack toward TARGET_TOKENS when the document's total already exceeds it (the normal,
 * size-driven case). When a multi-section document's total already fits under TARGET_TOKENS,
 * packing toward it would never trigger a split, since the overflow check that drives packing
 * only fires once the running total exceeds the target: that document would collapse right
 * back into a single chunk. SHORT_DOC_TARGET_TOKENS is what actually forces a split there.
 */
export function chunkDocument(content: string): CorpusChunk[] {
  const body = content.trim();
  if (!body) return [];

  const sections = splitOnHeadings(body);
  if (sections.length <= 1) {
    return [toChunk(body, sections[0]?.heading ?? null, 0)];
  }

  const target = estimateTokens(body) > TARGET_TOKENS ? TARGET_TOKENS : SHORT_DOC_TARGET_TOKENS;
  return packSections(sections, target);
}
