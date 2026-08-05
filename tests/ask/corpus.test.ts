import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CorpusValidationError, embeddingText, hashContent, loadCorpus, slugifyHeading } from '@/lib/ask/corpus';

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

  it('sets contentHash to hashContent(embeddingText(title, heading, content)) for every chunk', async () => {
    await writeCorpusFile(
      dir,
      'hashed.md',
      `${FRONTMATTER('hashed', 'Hashed Title')}
## Only Section

Body text used to verify the hash.
`,
    );

    const chunks = loadCorpus(dir);

    expect(chunks).toHaveLength(1);
    const chunk = chunks[0];
    expect(chunk.metadata.contentHash).toBe(
      hashContent(embeddingText(chunk.metadata.title, chunk.metadata.heading, chunk.content)),
    );
  });

  it('gives a chunk whose heading changes a different contentHash, even with identical body and title', async () => {
    await writeCorpusFile(
      dir,
      'a.md',
      `${FRONTMATTER('a', 'Same Title')}
## Original Heading

Identical body text.
`,
    );
    await writeCorpusFile(
      dir,
      'b.md',
      `${FRONTMATTER('b', 'Same Title')}
## Changed Heading

Identical body text.
`,
    );

    const chunks = loadCorpus(dir);
    const a = chunks.find((chunk) => chunk.metadata.file === 'a');
    const b = chunks.find((chunk) => chunk.metadata.file === 'b');

    expect(a?.content).toBe(b?.content);
    expect(a?.metadata.contentHash).not.toBe(b?.metadata.contentHash);
  });

  it('strips an HTML comment inside a section, leaving no double blank line behind', async () => {
    await writeCorpusFile(
      dir,
      'note.md',
      `${FRONTMATTER('note')}
## Section

Prose before.

<!-- do not say this publicly -->

Prose after.
`,
    );

    const chunks = loadCorpus(dir);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe('Prose before.\n\nProse after.');
  });

  it('strips a multi-line HTML comment', async () => {
    await writeCorpusFile(
      dir,
      'multiline.md',
      `${FRONTMATTER('multiline')}
## Section

Prose before.

<!--
This is a
multi-line comment.
-->

Prose after.
`,
    );

    const chunks = loadCorpus(dir);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe('Prose before.\n\nProse after.');
  });

  it('strips two comments in the same section', async () => {
    await writeCorpusFile(
      dir,
      'two-comments.md',
      `${FRONTMATTER('two-comments')}
## Section

First line.

<!-- comment one -->

Middle line.

<!-- comment two -->

Last line.
`,
    );

    const chunks = loadCorpus(dir);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe('First line.\n\nMiddle line.\n\nLast line.');
  });

  it('still drops a comment that sits above the first ## heading', async () => {
    await writeCorpusFile(
      dir,
      'preamble-comment.md',
      `${FRONTMATTER('preamble-comment')}
<!-- private note above the first heading -->

## Real Section

Kept content.
`,
    );

    const chunks = loadCorpus(dir);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe('Kept content.');
  });

  it('computes contentHash from the stripped body, not the raw body with the comment', async () => {
    await writeCorpusFile(
      dir,
      'secret.md',
      `${FRONTMATTER('secret', 'Secret Title')}
## Only Section

Prose before.

<!-- do not say this publicly -->

Prose after.
`,
    );

    const [chunk] = loadCorpus(dir);

    const rawBodyWithComment = 'Prose before.\n\n<!-- do not say this publicly -->\n\nProse after.';
    const hashIfCommentKept = hashContent(embeddingText('Secret Title', 'Only Section', rawBodyWithComment));

    expect(chunk.metadata.contentHash).not.toBe(hashIfCommentKept);
    expect(chunk.metadata.contentHash).toBe(
      hashContent(embeddingText(chunk.metadata.title, chunk.metadata.heading, chunk.content)),
    );
  });
});

describe('embeddingText', () => {
  it('composes title, then heading, then body, in that order', () => {
    const text = embeddingText('The Title', 'The Heading', 'The body text.');

    expect(text).toBe('The Title\nThe Heading\n\nThe body text.');
  });

  it('includes title and heading, which chunk.content never carries', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ask-corpus-'));
    try {
      await writeCorpusFile(
        dir,
        'sample.md',
        `${FRONTMATTER('sample', 'A Distinctive Title')}
## A Distinctive Heading

Just the body.
`,
      );

      const [chunk] = loadCorpus(dir);
      const text = embeddingText(chunk.metadata.title, chunk.metadata.heading, chunk.content);

      expect(text).toContain('A Distinctive Title');
      expect(text).toContain('A Distinctive Heading');
      expect(chunk.content).not.toContain('A Distinctive Title');
      expect(chunk.content).not.toContain('A Distinctive Heading');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
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
