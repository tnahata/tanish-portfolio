import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CorpusValidationError, hashContent, loadCorpus, slugifyHeading } from '@/lib/ask/corpus';

const FRONTMATTER = (id: string, title = 'A Title') =>
  `---\nid: ${id}\ntitle: ${title}\nkind: page\nroute: /\n---\n`;

async function writeCorpusFile(dir: string, filename: string, body: string): Promise<void> {
  await writeFile(join(dir, filename), body, 'utf8');
}

describe('loadCorpus', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ask-corpus-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('produces one chunk per ## section, keeping ### subsections with their parent', async () => {
    await writeCorpusFile(
      dir,
      'sample.md',
      `${FRONTMATTER('sample')}
## First Section

Some content under the first section.

### Nested detail

More nested content that belongs to the first section.

## Second Section

Content under the second section.
`,
    );

    const chunks = loadCorpus(dir);

    expect(chunks).toHaveLength(2);
    const first = chunks.find((chunk) => chunk.metadata.heading === 'First Section');
    const second = chunks.find((chunk) => chunk.metadata.heading === 'Second Section');
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first?.content).toContain('Nested detail');
    expect(first?.content).toContain('More nested content that belongs to the first section.');
    expect(second?.content).not.toContain('Nested detail');
  });

  it('drops content before the first ## heading', async () => {
    await writeCorpusFile(
      dir,
      'preamble.md',
      `${FRONTMATTER('preamble')}
This paragraph appears before any heading and must be dropped entirely.

## Real Section

Kept content.
`,
    );

    const chunks = loadCorpus(dir);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).not.toContain('must be dropped entirely');
    expect(chunks[0].content).toContain('Kept content.');
  });

  it('returns no chunks for a file with no ## sections at all', async () => {
    await writeCorpusFile(
      dir,
      'no-sections.md',
      `${FRONTMATTER('no-sections')}
Just a paragraph, no headings anywhere in this file.
`,
    );

    const chunks = loadCorpus(dir);

    expect(chunks).toHaveLength(0);
  });

  it('throws on an empty file', async () => {
    await writeCorpusFile(dir, 'empty.md', '');

    expect(() => loadCorpus(dir)).toThrow(CorpusValidationError);
  });

  it('throws when frontmatter is missing a required field', async () => {
    await writeCorpusFile(
      dir,
      'missing-title.md',
      `---
id: missing-title
kind: page
route: /
---

## Section

Content.
`,
    );

    expect(() => loadCorpus(dir)).toThrow(CorpusValidationError);
  });

  it('throws on a heading that appears twice in the same file, instead of silently overwriting', async () => {
    await writeCorpusFile(
      dir,
      'dup.md',
      `${FRONTMATTER('dup')}
## Same Heading

First occurrence.

## Same Heading

Second occurrence.
`,
    );

    expect(() => loadCorpus(dir)).toThrow(CorpusValidationError);
  });

  it('does not collide when the same heading text appears in two different files', async () => {
    await writeCorpusFile(
      dir,
      'one.md',
      `${FRONTMATTER('one')}
## Overview

Overview for file one.
`,
    );
    await writeCorpusFile(
      dir,
      'two.md',
      `${FRONTMATTER('two')}
## Overview

Overview for file two.
`,
    );

    const chunks = loadCorpus(dir);

    expect(chunks).toHaveLength(2);
    const ids = chunks.map((chunk) => chunk.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('produces ids shaped as ${file}#${heading-slug}, matching slugifyHeading', async () => {
    await writeCorpusFile(
      dir,
      'shape.md',
      `${FRONTMATTER('shape')}
## Café, Naïve & Co. — 2026!!!

Unicode heading content.
`,
    );

    const chunks = loadCorpus(dir);

    expect(chunks).toHaveLength(1);
    const chunk = chunks[0];
    const [filePart, slugPart] = chunk.id.split('#');
    expect(chunk.id).toBe(`${filePart}#${slugPart}`);
    expect(chunk.metadata.file).toBe(filePart);
    expect(slugPart).toBe(slugifyHeading('Café, Naïve & Co. — 2026!!!'));
  });

  it('sets contentHash to hashContent(content) for every chunk', async () => {
    await writeCorpusFile(
      dir,
      'hashed.md',
      `${FRONTMATTER('hashed')}
## Only Section

Body text used to verify the hash.
`,
    );

    const chunks = loadCorpus(dir);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].metadata.contentHash).toBe(hashContent(chunks[0].content));
  });
});

describe('slugifyHeading', () => {
  it('lowercases and collapses runs of non-alphanumerics to a single dash', () => {
    expect(slugifyHeading('Hello   ---  World!!')).toBe('hello-world');
  });

  it('has no leading or trailing dash', () => {
    const slug = slugifyHeading('  !!! Leading and Trailing !!!  ');
    expect(slug.startsWith('-')).toBe(false);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('handles unicode and punctuation deterministically', () => {
    const heading = 'Café, Naïve & Co. — 2026!!!';
    const first = slugifyHeading(heading);
    const second = slugifyHeading(heading);
    expect(first).toBe(second);
    expect(first).toMatch(/^[a-z0-9-]+$/);
  });
});

describe('hashContent', () => {
  it('returns the same hash for the same input', () => {
    const content = 'Some corpus chunk content.';
    expect(hashContent(content)).toBe(hashContent(content));
  });

  it('returns a different hash for different input', () => {
    expect(hashContent('First version.')).not.toBe(hashContent('Second version.'));
  });
});
