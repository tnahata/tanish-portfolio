import { eq, inArray } from 'drizzle-orm';

import { loadCorpus } from './corpus';
import { getDb } from './db';
import { embedMany } from './embed';
import { chunks } from './schema';
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
export function planReconcile(desired: CorpusChunk[], live: Map<string, string>): IngestPlan {
  if (desired.length === 0) {
    throw new EmptyCorpusError('desired corpus is empty; refusing to plan a delete sweep against it');
  }

  const insert: CorpusChunk[] = [];
  const update: CorpusChunk[] = [];
  const desiredIds = new Set<string>();
  let unchanged = 0;

  for (const chunk of desired) {
    desiredIds.add(chunk.id);
    const liveHash = live.get(chunk.id);
    if (liveHash === undefined) {
      insert.push(chunk);
    } else if (liveHash !== chunk.metadata.contentHash) {
      update.push(chunk);
    } else {
      unchanged += 1;
    }
  }

  const deleteIds = [...live.keys()].filter((id) => !desiredIds.has(id));

  return { insert, update, deleteIds, unchanged };
}

async function readLiveHashes(): Promise<Map<string, string>> {
  const rows = await getDb().select({ id: chunks.id, metadata: chunks.metadata }).from(chunks);
  return new Map(rows.map((row) => [row.id, row.metadata.contentHash]));
}

/** Embeds only insert and update chunks, keyed by id. Unchanged chunks never reach this call. */
async function embedChanged(plan: IngestPlan): Promise<Map<string, number[]>> {
  const changed = [...plan.insert, ...plan.update];
  if (changed.length === 0) return new Map();

  const vectors = await embedMany(changed.map((chunk) => chunk.content));
  return new Map(changed.map((chunk, index) => [chunk.id, vectors[index]]));
}

function embeddingFor(embeddings: Map<string, number[]>, id: string): number[] {
  const vector = embeddings.get(id);
  if (!vector) {
    throw new Error(`missing embedding for chunk "${id}"`);
  }
  return vector;
}

/** Deletes, inserts and updates the plan in one transaction: the whole corpus moves, or none of it. */
async function applyPlan(plan: IngestPlan, embeddings: Map<string, number[]>): Promise<void> {
  await getDb().transaction(async (tx) => {
    if (plan.deleteIds.length > 0) {
      await tx.delete(chunks).where(inArray(chunks.id, plan.deleteIds));
    }

    if (plan.insert.length > 0) {
      await tx.insert(chunks).values(
        plan.insert.map((chunk) => ({
          id: chunk.id,
          content: chunk.content,
          metadata: chunk.metadata,
          embedding: embeddingFor(embeddings, chunk.id),
        })),
      );
    }

    for (const chunk of plan.update) {
      await tx
        .update(chunks)
        .set({
          content: chunk.content,
          metadata: chunk.metadata,
          embedding: embeddingFor(embeddings, chunk.id),
        })
        .where(eq(chunks.id, chunk.id));
    }
  });
}

/**
 * Loads the corpus, plans the reconcile, embeds only what changed, and applies the plan. Returns
 * the plan it applied.
 */
export async function ingest(dir: string): Promise<IngestPlan> {
  const desired = loadCorpus(dir);
  const live = await readLiveHashes();
  const plan = planReconcile(desired, live);
  const embeddings = await embedChanged(plan);

  await applyPlan(plan, embeddings);

  return plan;
}
