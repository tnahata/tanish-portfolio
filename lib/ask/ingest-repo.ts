import { and, eq, notInArray, sql } from 'drizzle-orm';
import { type AskExecutor, getDb } from './db';
import { type AskEventType, askEvents, chunks, documents } from './schema';

export interface ExistingDocument {
  id: string;
  slug: string;
  title: string;
  route: string | null;
  kind: string;
}

export interface ExistingChunk {
  documentId: string;
  ordinal: number;
  contentHash: string;
}

export interface DesiredDocument {
  slug: string;
  title: string;
  route: string | null;
  kind: string;
}

export interface DesiredChunk {
  ordinal: number;
  heading: string | null;
  content: string;
  contentHash: string;
  embedding: number[];
}

export interface UpsertedDocument {
  id: string;
  slug: string;
  inserted: boolean;
}

export async function readExistingDocuments(): Promise<ExistingDocument[]> {
  return getDb()
    .select({ id: documents.id, slug: documents.slug, title: documents.title, route: documents.route, kind: documents.kind })
    .from(documents);
}

export async function readExistingChunks(): Promise<ExistingChunk[]> {
  return getDb()
    .select({ documentId: chunks.documentId, ordinal: chunks.ordinal, contentHash: chunks.contentHash })
    .from(chunks);
}

/** Unscoped by design: only ingest ever writes documents/chunks. See docs/ask-agent/01-corpus.md. */
export async function deleteDocumentsNotIn(executor: AskExecutor, desiredSlugs: string[]): Promise<string[]> {
  const deleted = await executor.delete(documents).where(notInArray(documents.slug, desiredSlugs)).returning({ slug: documents.slug });
  return deleted.map((row) => row.slug);
}

export async function upsertDocument(executor: AskExecutor, doc: DesiredDocument): Promise<UpsertedDocument> {
  const [row] = await executor
    .insert(documents)
    .values(doc)
    .onConflictDoUpdate({
      target: documents.slug,
      set: { title: doc.title, route: doc.route, kind: doc.kind },
    })
    .returning({ id: documents.id, slug: documents.slug, inserted: sql<boolean>`(xmax = 0)` });
  return row;
}

export async function upsertChunk(executor: AskExecutor, documentId: string, chunk: DesiredChunk): Promise<void> {
  const values = {
    documentId,
    ordinal: chunk.ordinal,
    heading: chunk.heading,
    content: chunk.content,
    contentHash: chunk.contentHash,
    embedding: chunk.embedding,
  };
  await executor
    .insert(chunks)
    .values(values)
    .onConflictDoUpdate({
      target: [chunks.documentId, chunks.ordinal],
      set: { heading: values.heading, content: values.content, contentHash: values.contentHash, embedding: values.embedding },
    });
}

export async function deleteChunksNotIn(executor: AskExecutor, documentId: string, keepOrdinals: number[]): Promise<number> {
  const deleted = await executor
    .delete(chunks)
    .where(and(eq(chunks.documentId, documentId), notInArray(chunks.ordinal, keepOrdinals)))
    .returning({ ordinal: chunks.ordinal });
  return deleted.length;
}

export async function insertSystemEvent(
  executor: AskExecutor,
  event: AskEventType,
  seq: number,
  payload: Record<string, unknown>,
): Promise<void> {
  await executor.insert(askEvents).values({ sessionId: null, userId: null, turnId: null, seq, event, payload });
}
