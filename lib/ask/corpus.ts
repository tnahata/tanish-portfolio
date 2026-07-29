import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { DOCUMENT_KINDS, type CorpusDocument, type DocumentKind } from './types';

/**
 * Loads and validates the authored corpus from disk.
 *
 * This module defines what the agent is allowed to know. Repository source is never read
 * here: only `content/corpus/*.md` and published blog posts. Code reaches the agent solely
 * as snippets quoted by hand into a corpus file.
 *
 * Validation is strict and fails loudly. A malformed corpus file is an authoring mistake
 * caught at ingest, and the alternative (defaulting a missing field) produces a document
 * that retrieves but cites nowhere.
 */

const CORPUS_DIR = path.join(process.cwd(), 'content/corpus');
const BLOG_DIR = path.join(process.cwd(), 'content/blog');

/** Blog frontmatter fields that duplicate body text and are stripped before chunking. */
const BLOG_EXCERPT_FIELD = 'excerpt';

export class CorpusValidationError extends Error {
  constructor(filePath: string, problem: string) {
    super(`${filePath}: ${problem}`);
    this.name = 'CorpusValidationError';
  }
}

/**
 * Removes HTML comments before chunking.
 *
 * Corpus files carry authoring scaffolding in `<!-- -->`. None of it is content, and an
 * embedded comment could be retrieved and quoted back to a visitor.
 */
export function stripHtmlComments(markdown: string): string {
  return markdown.replace(/<!--[\s\S]*?-->/g, '');
}

function requireString(
  value: unknown,
  field: string,
  filePath: string
): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new CorpusValidationError(filePath, `frontmatter \`${field}\` is required`);
  }
  return value.trim();
}

function parseKind(value: unknown, filePath: string): DocumentKind {
  const kind = requireString(value, 'kind', filePath);
  if (!DOCUMENT_KINDS.includes(kind as DocumentKind)) {
    throw new CorpusValidationError(
      filePath,
      `kind "${kind}" is not one of: ${DOCUMENT_KINDS.join(', ')}`
    );
  }
  return kind as DocumentKind;
}

/**
 * `route: null` is meaningful and distinct from a missing route: it declares that no page
 * exists to cite. gray-matter yields `null` for an explicit `null` and `undefined` when the
 * key is absent, so the two are told apart here rather than collapsed.
 */
function parseRoute(data: Record<string, unknown>, filePath: string): string | null {
  if (!('route' in data)) {
    throw new CorpusValidationError(filePath, 'frontmatter `route` is required (use null if no page exists)');
  }
  const route = data.route;
  if (route === null) return null;
  if (typeof route !== 'string' || !route.startsWith('/')) {
    throw new CorpusValidationError(filePath, 'route must be null or an absolute path beginning with /');
  }
  return route;
}

function loadAuthoredFile(filePath: string): CorpusDocument {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  const relative = path.relative(process.cwd(), filePath);

  const verbatimOnly = data.verbatimOnly === true;
  const route = parseRoute(data, relative);

  // A verbatim-only document is quoted rather than paraphrased, so its clearance is a real
  // decision with a date. An unset date is indistinguishable from no clearance at all.
  if (verbatimOnly && data.kind === 'disclosure' && !data.clearedOn) {
    throw new CorpusValidationError(relative, 'disclosure files require a `clearedOn` date before ingest');
  }

  return {
    slug: requireString(data.id, 'id', relative),
    title: requireString(data.title, 'title', relative),
    kind: parseKind(data.kind, relative),
    source: 'file',
    route,
    externalUrl: typeof data.externalUrl === 'string' ? data.externalUrl : null,
    verbatimOnly,
    content: stripHtmlComments(content).trim(),
    filePath: relative,
  };
}

/**
 * Blog posts carry the site's own frontmatter and none of the corpus fields, so their
 * document identity is derived rather than authored.
 */
function loadBlogFile(filePath: string): CorpusDocument {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  const relative = path.relative(process.cwd(), filePath);
  const slug = path.basename(filePath, '.mdx');

  return {
    slug: `blog-${slug}`,
    title: requireString(data.title, 'title', relative),
    kind: 'blog',
    source: 'file',
    route: `/blog/${slug}`,
    externalUrl: null,
    verbatimOnly: false,
    content: stripHtmlComments(content).trim(),
    filePath: relative,
  };
}

function readDir(dir: string, extension: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(extension))
    .sort()
    .map((f) => path.join(dir, f));
}

/**
 * Every document the agent is allowed to know, in stable slug order.
 *
 * Throws on a duplicate slug: two documents sharing one primary key would silently
 * overwrite each other on ingest, leaving whichever loaded last.
 */
export function loadCorpus(): CorpusDocument[] {
  const documents = [
    ...readDir(CORPUS_DIR, '.md').map(loadAuthoredFile),
    ...readDir(BLOG_DIR, '.mdx').map(loadBlogFile),
  ];

  const seen = new Map<string, string>();
  for (const doc of documents) {
    const previous = seen.get(doc.slug);
    if (previous) {
      throw new CorpusValidationError(doc.filePath, `duplicate id "${doc.slug}", already used by ${previous}`);
    }
    seen.set(doc.slug, doc.filePath);
  }

  return documents.sort((a, b) => a.slug.localeCompare(b.slug));
}

export { BLOG_EXCERPT_FIELD };
