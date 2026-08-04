import type { CorpusChunk } from './types';

/** Thrown when a corpus file's frontmatter is missing or malformed. Ingest must not proceed. */
export class CorpusValidationError extends Error {}

/**
 * Reads every markdown file in `dir`, validates frontmatter with zod, and splits each into one
 * chunk per `##` section. Content before the first `##` belongs to no chunk and is dropped.
 * Chunk ids are `${file}#${heading-slug}` and must be unique across the whole corpus.
 */
export function loadCorpus(dir: string): CorpusChunk[] {
  throw new Error(`not implemented: loadCorpus(${dir})`);
}

/** Slugifies a heading for use in a chunk id: lowercase, non-alphanumerics to single dashes. */
export function slugifyHeading(heading: string): string {
  throw new Error(`not implemented: slugifyHeading(${heading})`);
}

/** Stable hash of chunk content, used by reconcile to decide whether a chunk needs re-embedding. */
export function hashContent(content: string): string {
  throw new Error(`not implemented: hashContent(${content.length} chars)`);
}
