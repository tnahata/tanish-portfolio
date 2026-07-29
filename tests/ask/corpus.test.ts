import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { CorpusValidationError, loadCorpus, stripHtmlComments } from '../../lib/ask/corpus';

/**
 * Behavioural tests for corpus loading and validation.
 *
 * `lib/ask/corpus.ts` hardcodes `CORPUS_DIR`/`BLOG_DIR` as `path.join(process.cwd(), ...)`,
 * computed once at module load. There is no injection point for a fixture directory without
 * changing that module, which this task explicitly avoids. Instead these tests replace the
 * three `fs` calls corpus.ts makes (`existsSync`, `readdirSync`, `readFileSync`) with in-memory
 * fixtures via `vi.spyOn`, keyed on the real `CORPUS_DIR`/`BLOG_DIR` paths. This never touches
 * `content/corpus/` on disk: loadCorpus() only ever sees the fixture content handed to it.
 */

const CORPUS_DIR = path.join(process.cwd(), 'content/corpus');
const BLOG_DIR = path.join(process.cwd(), 'content/blog');

/** The subset of frontmatter fields these tests need to control, one key per test at a time. */
type FrontmatterFields = Partial<{
  id: string;
  title: string;
  kind: string;
  route: string | null;
  externalUrl: string;
  verbatimOnly: boolean;
  clearedOn: string;
}>;

function frontmatterBlock(fields: FrontmatterFields): string {
  const lines = ['---'];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    lines.push(`${key}: ${value === null ? 'null' : String(value)}`);
  }
  lines.push('---');
  return lines.join('\n');
}

function authoredFile(fields: FrontmatterFields, body = 'Body paragraph with real content.'): string {
  return `${frontmatterBlock(fields)}\n\n${body}`;
}

const FULLY_VALID_FIELDS: FrontmatterFields = {
  id: 'test-doc',
  title: 'Test Doc',
  kind: 'project',
  route: '/projects/test-doc',
};

/**
 * Points corpus.ts's fs calls at in-memory fixtures instead of disk. `corpusFiles` and
 * `blogFiles` are keyed by filename (not full path); this fills in CORPUS_DIR/BLOG_DIR.
 */
function mockFilesystem(corpusFiles: Record<string, string>, blogFiles: Record<string, string> = {}): void {
  const contents = new Map<string, string>();
  for (const [name, content] of Object.entries(corpusFiles)) {
    contents.set(path.join(CORPUS_DIR, name), content);
  }
  for (const [name, content] of Object.entries(blogFiles)) {
    contents.set(path.join(BLOG_DIR, name), content);
  }

  vi.spyOn(fs, 'existsSync').mockImplementation((target) => target === CORPUS_DIR || target === BLOG_DIR);

  vi.spyOn(fs, 'readdirSync').mockImplementation(((target: fs.PathLike) => {
    const dir = target.toString();
    if (dir === CORPUS_DIR) return Object.keys(corpusFiles);
    if (dir === BLOG_DIR) return Object.keys(blogFiles);
    return [];
  }) as unknown as typeof fs.readdirSync);

  vi.spyOn(fs, 'readFileSync').mockImplementation(((target: fs.PathOrFileDescriptor) => {
    const filePath = target.toString();
    const content = contents.get(filePath);
    if (content === undefined) {
      throw new Error(`test fixture gap: no mocked content for readFileSync(${filePath})`);
    }
    return content;
  }) as unknown as typeof fs.readFileSync);
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('stripHtmlComments', () => {
  it('removes HTML comments so authoring scaffolding can never be retrieved', () => {
    const input = 'Kept text.\n<!-- authoring note: do not ship -->\nMore kept text.';

    expect(stripHtmlComments(input)).toBe('Kept text.\n\nMore kept text.');
  });

  it('removes multi-line HTML comments', () => {
    const input = 'Before.\n<!--\n  multi-line scaffolding\n  more notes\n-->\nAfter.';

    const result = stripHtmlComments(input);

    expect(result).not.toContain('scaffolding');
    expect(result).toContain('Before.');
    expect(result).toContain('After.');
  });
});

describe('loadCorpus: HTML comment stripping', () => {
  it('strips HTML comments from a document before it becomes retrievable content', () => {
    const file = authoredFile(FULLY_VALID_FIELDS, 'Visible line.\n<!-- internal note, never retrievable -->\nAnother visible line.');
    mockFilesystem({ 'test-doc.md': file });

    const [doc] = loadCorpus();

    expect(doc.content).not.toContain('internal note');
    expect(doc.content).toContain('Visible line.');
    expect(doc.content).toContain('Another visible line.');
  });
});

describe('loadCorpus: required frontmatter', () => {
  it('throws when id is missing', () => {
    const fields: FrontmatterFields = { title: 'Test Doc', kind: 'project', route: '/projects/test-doc' };
    mockFilesystem({ 'test-doc.md': authoredFile(fields) });

    expect(() => loadCorpus()).toThrow(CorpusValidationError);
    expect(() => loadCorpus()).toThrow(/`id` is required/);
  });

  it('throws when title is missing', () => {
    const fields: FrontmatterFields = { id: 'test-doc', kind: 'project', route: '/projects/test-doc' };
    mockFilesystem({ 'test-doc.md': authoredFile(fields) });

    expect(() => loadCorpus()).toThrow(CorpusValidationError);
    expect(() => loadCorpus()).toThrow(/`title` is required/);
  });

  it('throws when kind is missing', () => {
    const fields: FrontmatterFields = { id: 'test-doc', title: 'Test Doc', route: '/projects/test-doc' };
    mockFilesystem({ 'test-doc.md': authoredFile(fields) });

    expect(() => loadCorpus()).toThrow(CorpusValidationError);
    expect(() => loadCorpus()).toThrow(/`kind` is required/);
  });

  it('throws when the route key is entirely absent from frontmatter', () => {
    const fields: FrontmatterFields = { id: 'test-doc', title: 'Test Doc', kind: 'project' };
    mockFilesystem({ 'test-doc.md': authoredFile(fields) });

    expect(() => loadCorpus()).toThrow(CorpusValidationError);
    expect(() => loadCorpus()).toThrow(/`route` is required/);
  });

  it('accepts an explicit route: null as a deliberate absence of a citable page', () => {
    const fields: FrontmatterFields = { ...FULLY_VALID_FIELDS, route: null };
    mockFilesystem({ 'test-doc.md': authoredFile(fields) });

    const [doc] = loadCorpus();

    expect(doc.route).toBeNull();
  });
});

describe('loadCorpus: kind validation', () => {
  it('throws when kind is not one of the allowed values, and names them', () => {
    const fields: FrontmatterFields = { ...FULLY_VALID_FIELDS, kind: 'nonsense' };
    mockFilesystem({ 'test-doc.md': authoredFile(fields) });

    expect(() => loadCorpus()).toThrow(CorpusValidationError);
    expect(() => loadCorpus()).toThrow(/blog, project, code, disclosure, page, meta, asked/);
  });
});

describe('loadCorpus: disclosure clearance', () => {
  it('throws when a disclosure file has verbatimOnly true and no clearedOn date', () => {
    const fields: FrontmatterFields = {
      ...FULLY_VALID_FIELDS,
      id: 'disclosure-test',
      kind: 'disclosure',
      route: null,
      verbatimOnly: true,
    };
    mockFilesystem({ 'disclosure-test.md': authoredFile(fields) });

    expect(() => loadCorpus()).toThrow(CorpusValidationError);
    expect(() => loadCorpus()).toThrow(/clearedOn/);
  });

  it('accepts a disclosure file once verbatimOnly is paired with a clearedOn date', () => {
    const fields: FrontmatterFields = {
      ...FULLY_VALID_FIELDS,
      id: 'disclosure-test',
      kind: 'disclosure',
      route: null,
      verbatimOnly: true,
      clearedOn: '2026-01-01',
    };
    mockFilesystem({ 'disclosure-test.md': authoredFile(fields) });

    const docs = loadCorpus();

    expect(docs).toHaveLength(1);
    expect(docs[0].kind).toBe('disclosure');
    expect(docs[0].verbatimOnly).toBe(true);
  });

  it('does not require clearedOn for verbatimOnly files outside the disclosure kind', () => {
    const fields: FrontmatterFields = {
      ...FULLY_VALID_FIELDS,
      id: 'faq-test',
      kind: 'page',
      verbatimOnly: true,
    };
    mockFilesystem({ 'faq-test.md': authoredFile(fields) });

    const docs = loadCorpus();

    expect(docs).toHaveLength(1);
    expect(docs[0].verbatimOnly).toBe(true);
  });
});

describe('loadCorpus: duplicate ids', () => {
  it('throws on a duplicate id across two files, naming both', () => {
    const fields: FrontmatterFields = { ...FULLY_VALID_FIELDS, id: 'dup-id' };
    mockFilesystem({
      'first.md': authoredFile(fields),
      'second.md': authoredFile(fields),
    });

    let caught: unknown;
    try {
      loadCorpus();
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(CorpusValidationError);
    const message = (caught as Error).message;
    expect(message).toContain('first.md');
    expect(message).toContain('second.md');
  });
});

describe('loadCorpus: blog document derivation', () => {
  it('derives slug, kind, and route for blog posts rather than reading them from frontmatter', () => {
    const blogFile = [
      '---',
      'title: My Post',
      'date: 2026-01-01',
      'excerpt: A short summary.',
      'kind: page', // deliberately wrong: must be ignored, not read
      'route: /wrong', // deliberately wrong: must be ignored, not read
      '---',
      '',
      'Blog body content.',
    ].join('\n');
    mockFilesystem({}, { 'my-post.mdx': blogFile });

    const [doc] = loadCorpus();

    expect(doc.slug).toBe('blog-my-post');
    expect(doc.kind).toBe('blog');
    expect(doc.route).toBe('/blog/my-post');
  });
});
