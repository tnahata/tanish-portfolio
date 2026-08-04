import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';
import { EMBED_DIMS, EMBED_MODEL } from './config';
import type { CorpusChunk } from './types';

/** Thrown when a corpus file's frontmatter is missing or malformed. Ingest must not proceed. */
export class CorpusValidationError extends Error {}

/** `route` is still present in every file but no longer used; accepted and ignored. */
const frontmatterSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    kind: z.string(),
  })
  .passthrough();

type Frontmatter = z.infer<typeof frontmatterSchema>;

interface Section {
  heading: string;
  body: string;
}

const H2_HEADING = /^## (.+)$/;

/**
 * Reads every markdown file in `dir`, validates frontmatter with zod, and splits each into one
 * chunk per `##` section. Content before the first `##` belongs to no chunk and is dropped.
 * Chunk ids are `${file}#${heading-slug}` and must be unique across the whole corpus.
 */
export function loadCorpus(dir: string): CorpusChunk[] {
  const chunks: CorpusChunk[] = [];
  const seenIds = new Set<string>();

  for (const fileName of listMarkdownFiles(dir)) {
    const filePath = join(dir, fileName);
    const raw = readFileSync(filePath, 'utf-8');
    const { data, content } = matter(raw);
    const frontmatter = parseFrontmatter(data, fileName);
    const file = basename(fileName, '.md');

    for (const section of splitIntoSections(content)) {
      const id = `${file}#${slugifyHeading(section.heading)}`;
      if (seenIds.has(id)) {
        throw new CorpusValidationError(
          `${fileName}: heading "${section.heading}" collides with an existing chunk id "${id}"`,
        );
      }
      seenIds.add(id);

      chunks.push({
        id,
        content: section.body,
        metadata: {
          file,
          heading: section.heading,
          title: frontmatter.title,
          embedModel: EMBED_MODEL,
          dims: EMBED_DIMS,
          contentHash: hashContent(section.body),
        },
      });
    }
  }

  return chunks;
}

function listMarkdownFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => extname(name) === '.md')
    .sort();
}

function parseFrontmatter(data: unknown, fileName: string): Frontmatter {
  const result = frontmatterSchema.safeParse(data);
  if (!result.success) {
    const field = result.error.issues[0]?.path.join('.') ?? 'unknown';
    throw new CorpusValidationError(`${fileName}: missing or invalid frontmatter field "${field}"`);
  }
  return result.data;
}

/** Splits body content on `##` headings; a `###` line stays inside its parent section. */
function splitIntoSections(content: string): Section[] {
  const sections: Section[] = [];
  let current: { heading: string; lines: string[] } | null = null;

  for (const line of content.split('\n')) {
    const match = H2_HEADING.exec(line);
    if (match) {
      if (current) sections.push(finalizeSection(current));
      current = { heading: match[1].trim(), lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
  }
  if (current) sections.push(finalizeSection(current));

  return sections;
}

function finalizeSection(section: { heading: string; lines: string[] }): Section {
  return { heading: section.heading, body: section.lines.join('\n').trim() };
}

/** Slugifies a heading for use in a chunk id: lowercase, non-alphanumerics to single dashes. */
export function slugifyHeading(heading: string): string {
  return heading
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Stable hash of chunk content, used by reconcile to decide whether a chunk needs re-embedding. */
export function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}
