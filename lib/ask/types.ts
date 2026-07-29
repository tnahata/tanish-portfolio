/**
 * Shared types for the ask agent's corpus pipeline. `DocumentKind`/`DocumentSource` mirror the
 * `documents` table columns; string unions so a typo fails at compile time, not silently.
 */

export const DOCUMENT_KINDS = [
  'blog',
  'project',
  'code',
  'disclosure',
  'page',
  'meta',
  'asked',
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/** Where a document came from. Scopes the ingest deletion sweep: only `file` rows are swept. */
export const DOCUMENT_SOURCES = ['file', 'asked'] as const;

export type DocumentSource = (typeof DOCUMENT_SOURCES)[number];

/** Frontmatter as authored, before defaults are applied. */
export interface CorpusFrontmatter {
  id: string;
  title: string;
  kind: DocumentKind;
  route: string | null;
  externalUrl?: string;
  verbatimOnly?: boolean;
  clearedOn?: string;
}

/** A corpus file after loading, validation, and comment stripping. */
export interface CorpusDocument {
  slug: string;
  title: string;
  kind: DocumentKind;
  source: DocumentSource;
  route: string | null;
  externalUrl: string | null;
  verbatimOnly: boolean;
  /** Body with frontmatter and HTML comments removed. What actually gets chunked. */
  content: string;
  /** Relative path, for error messages only. Never persisted. */
  filePath: string;
}

/** One chunk of a document, the unit of retrieval. */
export interface CorpusChunk {
  ordinal: number;
  heading: string | null;
  content: string;
  contentHash: string;
  tokenCount: number;
}
