import { describe, it, expect } from 'vitest';
import { chunkDocument, splitOnHeadings, hashContent } from '../../lib/ask/chunk';

/**
 * Behavioural tests for the corpus chunker.
 *
 * `chunkDocument` packs sections to a soft ~800 token target with ~100 tokens of overlap
 * (see docs/ask-agent/01-corpus.md, "Chunking"). Section sizes below are chosen against real,
 * word-wrapped prose (short lines, ~30 tokens each) so the token-packing behaviour matches how
 * an actual corpus file chunks, not a pathological single-line fixture.
 *
 * Whether a document splits at all is structural, not size-based: a document stays a single
 * chunk only when it has zero or one heading section. A short document with two or more
 * sections still splits, packed toward a smaller target so short unrelated sections (like
 * content/corpus/faq.md's list of FAQ topics) don't collapse back into one chunk.
 */

const WORDS_PER_LINE = 14;

/** One wrapped prose line, distinguishable by section prefix and line index. */
function makeLine(prefix: string, lineIndex: number): string {
  return Array.from({ length: WORDS_PER_LINE }, (_, word) => `${prefix}${lineIndex}w${word}`).join(' ');
}

/** A `##` section with `lineCount` short wrapped lines, mirroring how the real corpus is authored. */
function makeSection(heading: string, lineCount: number): string {
  const lines = Array.from({ length: lineCount }, (_, i) => makeLine(heading, i));
  return `## ${heading}\n\n${lines.join('\n')}`;
}

describe('chunkDocument', () => {
  it('keeps a short single-section document as a single chunk with ordinal 0', () => {
    const content = '# Title\n\nA short paragraph that easily fits inside one chunk.';

    const chunks = chunkDocument(content);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].ordinal).toBe(0);
  });

  it('splits a short multi-section document instead of collapsing it into one chunk', () => {
    // Well under the old SINGLE_CHUNK_TOKENS/TARGET_TOKENS threshold (800), but it has three
    // heading sections. The old rule kept anything this small whole; the new rule splits on
    // structure, not size.
    const doc = [makeSection('First', 3), makeSection('Second', 3), makeSection('Third', 3)].join('\n\n');

    const chunks = chunkDocument(doc);

    expect(chunks.length).toBeGreaterThan(1);
  });

  it('separates unrelated short sections into different chunks instead of averaging them into one', () => {
    // Mirrors the shape of content/corpus/faq.md: several short, topically unrelated sections
    // in one short document. If packing quietly re-merges everything back into one chunk, an
    // embedding for this chunk has to represent all six topics at once, which is the exact
    // dilution problem the structural rule exists to fix.
    const headings = ['Looking', 'Authorization', 'Location', 'Availability', 'Compensation', 'Contact'];
    const doc = headings.map((h) => makeSection(h, 2)).join('\n\n');

    const chunks = chunkDocument(doc);

    expect(chunks.length).toBeGreaterThan(1);

    const lookingChunk = chunks.find((c) => c.content.includes('Looking0w0'));
    const compensationChunk = chunks.find((c) => c.content.includes('Compensation0w0'));

    expect(lookingChunk).toBeDefined();
    expect(compensationChunk).toBeDefined();
    expect(lookingChunk).not.toBe(compensationChunk);
    expect(compensationChunk?.content).not.toContain('Looking0w0');
    expect(lookingChunk?.content).not.toContain('Compensation0w0');
  });

  it('returns no chunks for empty input', () => {
    expect(chunkDocument('')).toEqual([]);
  });

  it('returns no chunks for whitespace-only input', () => {
    expect(chunkDocument('   \n\t\n   ')).toEqual([]);
  });

  it('splits a long multi-heading document into multiple chunks with contiguous ordinals starting at 0', () => {
    const doc = [makeSection('Alpha', 20), makeSection('Beta', 20), makeSection('Gamma', 20)].join('\n\n');

    const chunks = chunkDocument(doc);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((c) => c.ordinal)).toEqual(chunks.map((_, i) => i));
  });

  it('carries the tail of one chunk into the head of the next, so a boundary never orphans a claim', () => {
    const headings = ['Alpha', 'Beta', 'Gamma'];
    const doc = headings.map((h) => makeSection(h, 20)).join('\n\n');

    const chunks = chunkDocument(doc);
    expect(chunks.length).toBeGreaterThan(1);

    for (let i = 0; i < chunks.length - 1; i++) {
      const previousChunk = chunks[i];
      const nextChunk = chunks[i + 1];
      const lastLineOfPrevious = previousChunk.content.trim().split('\n').pop();
      expect(lastLineOfPrevious).toBeTruthy();

      // The overlap must appear at the head of the next chunk: before that chunk's own new
      // heading, not merely somewhere inside it by coincidence.
      const overlapIndex = nextChunk.content.indexOf(lastLineOfPrevious as string);
      const nextChunkOwnHeading = nextChunk.heading ? nextChunk.content.indexOf(`## ${nextChunk.heading}`) : -1;

      expect(overlapIndex).toBeGreaterThanOrEqual(0);
      if (nextChunkOwnHeading >= 0) {
        expect(overlapIndex).toBeLessThan(nextChunkOwnHeading);
      }
    }
  });

  it('emits a single section larger than the target whole, rather than splitting it mid-prose', () => {
    const bigLineCount = 45;
    const doc = [makeSection('Small1', 3), makeSection('Big', bigLineCount), makeSection('Small2', 3)].join('\n\n');
    const bigSectionBody = Array.from({ length: bigLineCount }, (_, i) => makeLine('Big', i)).join('\n');

    const chunks = chunkDocument(doc);

    const bigChunks = chunks.filter((c) => c.heading === 'Big');
    expect(bigChunks).toHaveLength(1);
    expect(bigChunks[0].content).toContain(bigSectionBody);
  });

  it('produces a stable contentHash for identical input', () => {
    const content = 'Identical content should hash identically every time.';

    expect(hashContent(content)).toBe(hashContent(content));
  });

  it('produces a different contentHash when a single character changes', () => {
    const original = 'A single changed character must change the hash.';
    const changed = 'A single changed character must change the hash!';

    expect(hashContent(original)).not.toBe(hashContent(changed));
  });
});

describe('splitOnHeadings', () => {
  it('treats text before the first heading as a leading section with a null heading', () => {
    const markdown = 'Intro paragraph before any heading.\n\n## First Section\n\nBody text here.';

    const sections = splitOnHeadings(markdown);

    expect(sections[0]).toEqual({ heading: null, content: 'Intro paragraph before any heading.' });
  });

  it('keeps the heading line itself inside the section body it introduces', () => {
    const markdown = 'Intro.\n\n## First Section\n\nBody text here.';

    const sections = splitOnHeadings(markdown);
    const firstSection = sections.find((s) => s.heading === 'First Section');

    expect(firstSection).toBeDefined();
    expect(firstSection?.content.startsWith('## First Section')).toBe(true);
  });

  it('splits on both ## and ### headings into separate sections', () => {
    const markdown = '## Top\n\nTop body.\n\n### Sub\n\nSub body.';

    const sections = splitOnHeadings(markdown);

    expect(sections.map((s) => s.heading)).toEqual(['Top', 'Sub']);
  });
});
