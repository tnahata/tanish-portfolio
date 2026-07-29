import { createHash } from 'crypto';
import { MarkdownNodeParser } from '@llamaindex/core/node-parser';
import { Document } from '@llamaindex/core/schema';
import type { TextNode } from '@llamaindex/core/schema';
import { estimateTokens } from './tokens';
import type { CorpusChunk } from './types';

/** Splits corpus documents into the chunks that get embedded and retrieved: cut on markdown
 *  headings, then packed toward a token target. See docs/ask-agent/01-corpus.md#chunking. */

/** Target size for a packed chunk. Soft: a single oversized section is never split. */
const TARGET_TOKENS = 800;

/** Trailing context copied from the previous chunk, so a boundary does not orphan a claim. */
const OVERLAP_TOKENS = 100;

/** Packing target for a document already under TARGET_TOKENS: without it, the packing loop's
 *  overflow check would never fire and such a document could never split. See docs/ask-agent/01-corpus.md#chunking. */
const SHORT_DOC_TARGET_TOKENS = 200;

/** Joins a nested section's ancestor headings into one breadcrumb ("Parent > Child"), since
 *  `CorpusChunk.heading` is a single string. A no-op today: every corpus file uses only `##`. */
const HEADING_PATH_SEPARATOR = ' > ';

/** LlamaIndex stamps one `Header_<n>` metadata key per active ancestor heading level, e.g.
 *  `{ Header_2: "Overview", Header_3: "Scope" }`. This reads that shape back out. */
const HEADER_METADATA_KEY_PATTERN = /^Header_(\d+)$/;

interface Section {
  heading: string | null;
  content: string;
}

/** Stateless: `MarkdownNodeParser` takes no options and holds no per-call state, so one
 *  instance is reused for the module's lifetime instead of reallocating per document. */
const markdownParser = new MarkdownNodeParser();

/** Splits on markdown headings of any level. Text before the first heading becomes a leading
 *  section with a null heading; the heading line stays in the body as real retrieval context. */
export function splitOnHeadings(markdown: string): Section[] {
  const document = new Document({ text: markdown });
  const nodes = markdownParser.getNodesFromDocuments([document]) as TextNode[];
  return nodes.map(sectionFromNode);
}

/** Converts one `MarkdownNodeParser` node into a `Section`. No `Header_<n>` metadata means
 *  leading, pre-heading text; otherwise the ancestor chain becomes the `HEADING_PATH_SEPARATOR` breadcrumb. */
function sectionFromNode(node: TextNode): Section {
  const levels = Object.keys(node.metadata)
    .map((key) => HEADER_METADATA_KEY_PATTERN.exec(key))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => Number(match[1]))
    .sort((a, b) => a - b);

  if (levels.length === 0) {
    return { heading: null, content: node.text };
  }

  const metadata = node.metadata as Record<string, string>;
  const path = levels.map((level) => metadata[`Header_${level}`]).join(HEADING_PATH_SEPARATOR);
  const ownLevel = levels[levels.length - 1];

  return { heading: path, content: restoreHeadingMarkup(node.text, ownLevel) };
}

/** `MarkdownNodeParser` strips the leading `#`s from a section's own heading line; this puts
 *  them back so the chunk body still reads as the originally authored heading line. */
function restoreHeadingMarkup(text: string, level: number): string {
  const newlineIndex = text.indexOf('\n');
  const headingLine = newlineIndex === -1 ? text : text.slice(0, newlineIndex);
  const rest = newlineIndex === -1 ? '' : text.slice(newlineIndex);
  return `${'#'.repeat(level)} ${headingLine}${rest}`;
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

/** True once `cost` more tokens would push a real pending chunk over `target`. False while
 *  `pending` is only carried-over overlap: flushing that would emit a pure-duplicate fragment. */
function wouldOverflowPendingChunk(
  pendingTokens: number,
  pendingHeading: string | null,
  cost: number,
  target: number
): boolean {
  return pendingTokens > 0 && pendingHeading !== null && pendingTokens + cost > target;
}

/** Packs sections into chunks toward `target` tokens, carrying OVERLAP_TOKENS of trailing
 *  context across each boundary. A section at or above `target` is emitted whole, never split mid-prose. */
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

    if (wouldOverflowPendingChunk(pendingTokens, pendingHeading, cost, target)) flush();

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

/** Chunks a document body. Zero or one heading section stays whole; two or more always split
 *  on those headings regardless of size. See docs/ask-agent/01-corpus.md#chunking for why. */
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
