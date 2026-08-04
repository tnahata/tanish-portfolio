import { asc, cosineDistance, sql } from 'drizzle-orm';

import { EMBED_DIMS, EMBED_MODEL, T_FLOOR, T_STRONG, TOP_K } from './config';
import { getDb } from './db';
import { embedOne } from './embed';
import { chunks as chunksTable } from './schema';
import type { Grading, RetrievedChunk, StrongGrounding } from './types';

/** Thrown when chunks.metadata records a different embed model than config declares. */
export class IngestConfigMismatchError extends Error {}

/** Thrown when the chunks table has no rows: a broken deployment, not an off-topic question. */
export class EmptyIndexError extends Error {}

async function assertIngestMatchesConfig(): Promise<void> {
  const db = getDb();
  const [row] = await db.select({ metadata: chunksTable.metadata }).from(chunksTable).limit(1);

  if (!row) {
    throw new EmptyIndexError(
      'chunks table is empty. Ingest has not been run against this database; run `npm run ingest` before retrieving.',
    );
  }

  const { embedModel, dims } = row.metadata;
  if (embedModel !== EMBED_MODEL || dims !== EMBED_DIMS) {
    throw new IngestConfigMismatchError(
      `chunks.metadata records embedModel "${embedModel}" (${dims} dims), but config declares ` +
        `"${EMBED_MODEL}" (${EMBED_DIMS} dims). Re-ingest after a model change so scores stay meaningful.`,
    );
  }
}

/** Embeds the question and returns the TOP_K nearest chunks by cosine distance, best first. */
export async function retrieve(question: string): Promise<RetrievedChunk[]> {
  await assertIngestMatchesConfig();

  const questionEmbedding = await embedOne(question);
  const distance = cosineDistance(chunksTable.embedding, questionEmbedding);
  const similarity = sql<number>`1 - (${distance})`;

  const db = getDb();
  const rows = await db
    .select({
      id: chunksTable.id,
      content: chunksTable.content,
      metadata: chunksTable.metadata,
      score: similarity,
    })
    .from(chunksTable)
    .orderBy(asc(distance))
    .limit(TOP_K);

  return rows;
}

/**
 * Turns scores into a verdict. The top score decides; the context is every chunk at or above
 * T_STRONG, so a low scorer riding along on a good query never reaches the prompt.
 */
export function grade(chunks: RetrievedChunk[]): Grading {
  const top = chunks[0];

  if (!top || top.score < T_FLOOR) {
    return { verdict: 'off_topic', reason: 'off_topic', chunks };
  }

  if (top.score < T_STRONG) {
    return { verdict: 'weak', reason: 'no_grounding', chunks };
  }

  const strongChunks = chunks.filter((chunk) => chunk.score >= T_STRONG);
  const grounding = { chunks: strongChunks, topScore: top.score } as unknown as StrongGrounding;

  return { verdict: 'strong', grounding };
}
