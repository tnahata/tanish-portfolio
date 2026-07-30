import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { chunkDocument, hashContent } from '@/lib/ask/chunk';

describe('chunkDocument', () => {
  it('splits real corpus content on ## sections and leaves fenced code untouched', () => {
    const filePath = path.join(process.cwd(), 'content/corpus/code-hybrid-fit.md');
    const raw = fs.readFileSync(filePath, 'utf-8');
    const body = raw.replace(/^---[\s\S]*?---\n/, '');

    const chunks = chunkDocument(body);

    const headingCount = body.split('\n').filter((line) => line.startsWith('## ')).length;
    expect(chunks).toHaveLength(headingCount);
    expect(chunks.some((chunk) => chunk.content.includes('```'))).toBe(true);
  });

  it('never treats a heading-shaped line inside a fenced code block as a section break', () => {
    const content = [
      '## Real section',
      '',
      'Some prose.',
      '',
      '```ts',
      '// ## comment that looks like a heading',
      'const x = 1;',
      '```',
      '',
      '## Next section',
      '',
      'More prose.',
    ].join('\n');

    const chunks = chunkDocument(content);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].content).toContain('## comment that looks like a heading');
    expect(chunks[0].heading).toBe('Real section');
    expect(chunks[1].heading).toBe('Next section');
  });

  it('keeps a document with zero heading sections whole', () => {
    const content = 'Just prose, no headings anywhere in this document.';

    const chunks = chunkDocument(content);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].heading).toBeNull();
    expect(chunks[0].content).toBe(content);
    expect(chunks[0].ordinal).toBe(0);
  });

  it('keeps a document with exactly one heading section whole', () => {
    const content = '## Only section\n\nAll of the content lives here.';

    const chunks = chunkDocument(content);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].heading).toBe('Only section');
    expect(chunks[0].content.startsWith('## Only section')).toBe(true);
  });

  it('restores the # markup the parser strips from a heading line', () => {
    const content = '## Restored Heading\n\nBody text.';

    const [chunk] = chunkDocument(content);

    expect(chunk.content).toBe('## Restored Heading\n\nBody text.');
  });

  it('builds a Parent > Child breadcrumb for nested headings', () => {
    const content = '# Parent\n\nintro\n\n## Child\n\nchild body';

    const chunks = chunkDocument(content);
    const child = chunks.find((chunk) => chunk.content.includes('child body'));

    expect(child?.heading).toBe('Parent > Child');
  });

  it('drops a whitespace-only preamble before the first heading instead of emitting an empty chunk', () => {
    const content = '\n\n## First real section\n\nbody';

    const chunks = chunkDocument(content);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].heading).toBe('First real section');
  });

  it('keeps real preamble text before the first heading as its own headless chunk', () => {
    const content = 'Intro paragraph before any heading.\n\n## First section\n\nbody';

    const chunks = chunkDocument(content);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].heading).toBeNull();
    expect(chunks[0].content).toBe('Intro paragraph before any heading.');
    expect(chunks[1].heading).toBe('First section');
  });
});

describe('hashContent', () => {
  it('returns a deterministic 64-character sha256 hex digest', () => {
    const hash = hashContent('some content');

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashContent('some content')).toBe(hash);
  });

  it('treats leading/trailing whitespace differences as identical content', () => {
    expect(hashContent('  same  \n')).toBe(hashContent('same'));
  });

  it('produces different hashes for different content', () => {
    expect(hashContent('a')).not.toBe(hashContent('b'));
  });
});
