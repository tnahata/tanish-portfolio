import type { CorpusChunk } from './types';

/** Thrown when the desired corpus is empty: the delete sweep would otherwise wipe the index. */
export class EmptyCorpusError extends Error {}

/** What reconcile would do, computed before anything is embedded or written. */
export interface IngestPlan {
  insert: CorpusChunk[];
  update: CorpusChunk[];
  deleteIds: string[];
  unchanged: number;
}

/** Pure diff of desired chunks against live ids and hashes. Shared by ingest and the CI dry run. */
export function planReconcile(
  desired: CorpusChunk[],
  live: Map<string, string>,
): IngestPlan {
  throw new Error(`not implemented: planReconcile(${desired.length} desired, ${live.size} live)`);
}

/**
 * Embeds what changed and applies the plan in one transaction. The transaction is the blue-green:
 * either the whole corpus moves or none of it does.
 */
export function ingest(dir: string): Promise<IngestPlan> {
  throw new Error(`not implemented: ingest(${dir})`);
}
