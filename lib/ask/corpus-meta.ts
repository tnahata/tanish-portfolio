import { eq } from 'drizzle-orm';
import { db } from './db';
import { corpusMeta } from './schema';

/** Reads `corpus_meta` for turn logging (`turns.corpus_hash`) and the retrieval config check.
 *  Not cached: it's one cheap row, and caching risks a stale value across a mid-process re-ingest. */

export interface CorpusMetaStatus {
  embedModel: string;
  embedDims: number;
  corpusHash: string;
}

/** Null when `corpus_meta` has no row (id = 1): the index has never been ingested successfully. */
export async function fetchCorpusMeta(): Promise<CorpusMetaStatus | null> {
  const rows = await db()
    .select({
      embedModel: corpusMeta.embedModel,
      embedDims: corpusMeta.embedDims,
      corpusHash: corpusMeta.corpusHash,
    })
    .from(corpusMeta)
    .where(eq(corpusMeta.id, 1))
    .limit(1);
  return rows[0] ?? null;
}
