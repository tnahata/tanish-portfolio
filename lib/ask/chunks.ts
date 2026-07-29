import { asc, cosineDistance, eq, sql } from 'drizzle-orm';
import { db } from './db';
import { chunks, documents } from './schema';

/**
 * Chunk-search repository: the one vector-search query, shared by lib/ask/retrieve.ts (the
 * request path) and scripts/search.ts (the tuning probe) so they can never silently diverge.
 */

/** One ranked chunk, joined with its parent document's citation fields. */
export interface ChunkSearchResult {
  slug: string;
  title: string;
  route: string | null;
  verbatimOnly: boolean;
  heading: string | null;
  content: string;
  score: number;
}

/** Ranks every chunk by pgvector cosine distance to `embedding` (ascending) and returns the
 *  top `limit`; similarity is `1 - distance` in SQL, so higher is always better on read. */
export async function searchChunks(embedding: number[], limit: number): Promise<ChunkSearchResult[]> {
  const distance = cosineDistance(chunks.embedding, embedding);
  return db()
    .select({
      slug: documents.slug,
      title: documents.title,
      route: documents.route,
      verbatimOnly: documents.verbatimOnly,
      heading: chunks.heading,
      content: chunks.content,
      score: sql<number>`1 - (${distance})`,
    })
    .from(chunks)
    .innerJoin(documents, eq(documents.id, chunks.documentId))
    .orderBy(asc(distance))
    .limit(limit);
}
