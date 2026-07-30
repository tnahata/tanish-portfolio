import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

export const CORPUS_KINDS = ['blog', 'project', 'code', 'disclosure', 'page', 'meta'] as const;
export type CorpusKind = (typeof CORPUS_KINDS)[number];

const BLOG_KIND: CorpusKind = 'blog';
const HTML_COMMENT_PATTERN = /<!--[\s\S]*?-->/g;
const REQUIRED_CORPUS_FIELDS = ['id', 'title', 'kind', 'route'] as const;

const DEFAULT_CORPUS_DIR = path.join(process.cwd(), 'content/corpus');
const DEFAULT_BLOG_DIR = path.join(process.cwd(), 'content/blog');

export interface CorpusDocument {
  slug: string;
  title: string;
  kind: CorpusKind;
  route: string | null;
  content: string;
  sourcePath: string;
}

export class CorpusValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CorpusValidationError';
  }
}

export class EmptyCorpusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmptyCorpusError';
  }
}

function stripHtmlComments(markdown: string): string {
  return markdown.replace(HTML_COMMENT_PATTERN, '');
}

function isCorpusKind(value: unknown): value is CorpusKind {
  return typeof value === 'string' && (CORPUS_KINDS as readonly string[]).includes(value);
}

function listMarkdownFiles(dir: string, extension: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((filename) => filename.endsWith(extension))
    .sort();
}

function loadCorpusFile(dir: string, filename: string): CorpusDocument {
  const sourcePath = path.join(dir, filename);
  const { data, content } = matter(fs.readFileSync(sourcePath, 'utf-8'));

  for (const field of REQUIRED_CORPUS_FIELDS) {
    if (!(field in data)) {
      throw new CorpusValidationError(`${sourcePath}: missing required frontmatter field "${field}"`);
    }
  }
  if (typeof data.id !== 'string' || data.id.trim() === '') {
    throw new CorpusValidationError(`${sourcePath}: frontmatter "id" must be a non-empty string`);
  }
  if (typeof data.title !== 'string' || data.title.trim() === '') {
    throw new CorpusValidationError(`${sourcePath}: frontmatter "title" must be a non-empty string`);
  }
  if (!isCorpusKind(data.kind)) {
    throw new CorpusValidationError(
      `${sourcePath}: frontmatter "kind" must be one of ${CORPUS_KINDS.join(', ')}, got ${JSON.stringify(data.kind)}`,
    );
  }
  if (data.route !== null && typeof data.route !== 'string') {
    throw new CorpusValidationError(`${sourcePath}: frontmatter "route" must be a string or null`);
  }

  return {
    slug: data.id,
    title: data.title,
    kind: data.kind,
    route: data.route,
    content: stripHtmlComments(content),
    sourcePath,
  };
}

function loadBlogFile(dir: string, filename: string): CorpusDocument {
  const sourcePath = path.join(dir, filename);
  const { data, content } = matter(fs.readFileSync(sourcePath, 'utf-8'));
  const slug = filename.replace(/\.mdx$/, '');

  if (typeof data.title !== 'string' || data.title.trim() === '') {
    throw new CorpusValidationError(`${sourcePath}: frontmatter "title" must be a non-empty string`);
  }

  return {
    slug,
    title: data.title,
    kind: BLOG_KIND,
    route: `/blog/${slug}`,
    content: stripHtmlComments(content),
    sourcePath,
  };
}

function assertNoDuplicateSlugs(documents: CorpusDocument[]): void {
  const seen = new Map<string, string>();
  for (const doc of documents) {
    const priorSourcePath = seen.get(doc.slug);
    if (priorSourcePath) {
      throw new CorpusValidationError(`Duplicate corpus id "${doc.slug}": ${priorSourcePath} and ${doc.sourcePath}`);
    }
    seen.set(doc.slug, doc.sourcePath);
  }
}

export function loadCorpus(corpusDir: string = DEFAULT_CORPUS_DIR, blogDir: string = DEFAULT_BLOG_DIR): CorpusDocument[] {
  const documents = [
    ...listMarkdownFiles(corpusDir, '.md').map((filename) => loadCorpusFile(corpusDir, filename)),
    ...listMarkdownFiles(blogDir, '.mdx').map((filename) => loadBlogFile(blogDir, filename)),
  ];
  assertNoDuplicateSlugs(documents);
  return documents;
}

/**
 * Postgres `x <> all('{}')` is vacuously true, so an empty desired-state set would delete every
 * document. This must run before any database query, embedding call, or transaction.
 */
export function assertCorpusNotEmpty(documents: CorpusDocument[]): void {
  if (documents.length === 0) {
    throw new EmptyCorpusError('Corpus resolved empty: refusing to reconcile against zero documents.');
  }
}
