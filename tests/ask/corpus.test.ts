import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CorpusValidationError, EmptyCorpusError, assertCorpusNotEmpty, loadCorpus } from '@/lib/ask/corpus';

let corpusDir: string;
let emptyDir: string;

function writeCorpusFile(filename: string, frontmatter: string, body = '\n\n## Section\n\nbody text.'): void {
  fs.writeFileSync(path.join(corpusDir, filename), `---\n${frontmatter}\n---${body}`, 'utf-8');
}

beforeEach(() => {
  corpusDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-corpus-'));
  emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-empty-'));
});

afterEach(() => {
  fs.rmSync(corpusDir, { recursive: true, force: true });
  fs.rmSync(emptyDir, { recursive: true, force: true });
});

describe('loadCorpus frontmatter validation', () => {
  it('loads a valid document, treating route: null as meaningful', () => {
    writeCorpusFile('a.md', 'id: a\ntitle: A\nkind: page\nroute: null');

    const docs = loadCorpus(corpusDir, emptyDir);

    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ slug: 'a', title: 'A', kind: 'page', route: null });
  });

  it('throws when id is missing', () => {
    writeCorpusFile('a.md', 'title: A\nkind: page\nroute: null');
    expect(() => loadCorpus(corpusDir, emptyDir)).toThrow(CorpusValidationError);
  });

  it('throws when title is missing', () => {
    writeCorpusFile('a.md', 'id: a\nkind: page\nroute: null');
    expect(() => loadCorpus(corpusDir, emptyDir)).toThrow(CorpusValidationError);
  });

  it('throws when kind is missing', () => {
    writeCorpusFile('a.md', 'id: a\ntitle: A\nroute: null');
    expect(() => loadCorpus(corpusDir, emptyDir)).toThrow(CorpusValidationError);
  });

  it('throws when the route key is absent, distinct from an explicit route: null', () => {
    writeCorpusFile('a.md', 'id: a\ntitle: A\nkind: page');
    expect(() => loadCorpus(corpusDir, emptyDir)).toThrow(/route/);
  });

  it('throws when kind is not one of the closed enum values', () => {
    writeCorpusFile('a.md', 'id: a\ntitle: A\nkind: nonsense\nroute: null');
    expect(() => loadCorpus(corpusDir, emptyDir)).toThrow(CorpusValidationError);
  });

  it('throws on a duplicate id across two files', () => {
    writeCorpusFile('a.md', 'id: dup\ntitle: A\nkind: page\nroute: null');
    writeCorpusFile('b.md', 'id: dup\ntitle: B\nkind: page\nroute: null');
    expect(() => loadCorpus(corpusDir, emptyDir)).toThrow(CorpusValidationError);
  });

  it('ignores deprecated verbatimOnly and clearedOn fields rather than failing', () => {
    writeCorpusFile('a.md', 'id: a\ntitle: A\nkind: disclosure\nroute: null\nverbatimOnly: true\nclearedOn: 2024-01-01');
    expect(() => loadCorpus(corpusDir, emptyDir)).not.toThrow();
  });

  it('strips HTML comments from the loaded content', () => {
    writeCorpusFile('a.md', 'id: a\ntitle: A\nkind: page\nroute: null', '\n\n<!-- authoring note -->\n\n## Section\n\nbody');
    const [doc] = loadCorpus(corpusDir, emptyDir);
    expect(doc.content).not.toContain('authoring note');
  });
});

describe('loadCorpus blog loading', () => {
  it('derives slug and route from the filename without requiring id/kind/route frontmatter', () => {
    const blogDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-blog-'));
    try {
      fs.writeFileSync(
        path.join(blogDir, 'my-post.mdx'),
        '---\ntitle: "My Post"\ndate: "2024-01-01"\nexcerpt: "..."\n---\n\n## Section\n\nbody',
        'utf-8',
      );

      const docs = loadCorpus(emptyDir, blogDir);

      expect(docs).toHaveLength(1);
      expect(docs[0]).toMatchObject({ slug: 'my-post', title: 'My Post', kind: 'blog', route: '/blog/my-post' });
    } finally {
      fs.rmSync(blogDir, { recursive: true, force: true });
    }
  });
});

describe('assertCorpusNotEmpty', () => {
  it('throws EmptyCorpusError when the corpus resolves empty', () => {
    const documents = loadCorpus(emptyDir, emptyDir);
    expect(documents).toEqual([]);
    expect(() => assertCorpusNotEmpty(documents)).toThrow(EmptyCorpusError);
  });

  it('does not throw when at least one document is present', () => {
    writeCorpusFile('a.md', 'id: a\ntitle: A\nkind: page\nroute: null');
    expect(() => assertCorpusNotEmpty(loadCorpus(corpusDir, emptyDir))).not.toThrow();
  });

  it('demonstrates the ingest guard: a directory that resolves empty must refuse, never proceed to a delete sweep', () => {
    // Mirrors the real hazard directly: a bad working directory or renamed corpus folder makes
    // the loader return []. `x <> all('{}')` is vacuously true, so the guard must fire before
    // any reconcile logic ever builds a delete-sweep parameter list.
    const documents = loadCorpus(emptyDir, emptyDir);
    expect(() => assertCorpusNotEmpty(documents)).toThrowError(/resolved empty/);
  });
});
