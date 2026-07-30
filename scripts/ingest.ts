import { loadScriptEnv } from './load-env';
import { assertCorpusNotEmpty, loadCorpus, type CorpusDocument } from '@/lib/ask/corpus';
import { chunkDocument, hashContent, type Chunk } from '@/lib/ask/chunk';
import { embedTexts } from '@/lib/ask/embed';
import { getDb } from '@/lib/ask/db';
import {
  type ExistingDocument,
  deleteChunksNotIn,
  deleteDocumentsNotIn,
  insertSystemEvent,
  readExistingChunks,
  readExistingDocuments,
  upsertChunk,
  upsertDocument,
} from '@/lib/ask/ingest-repo';

const EMBEDDING_MODEL = 'text-embedding-3-large';
const EMBEDDING_DIMENSIONS = 1024;
// This event is not part of a turn (turn_id is null), so it never competes with another row for
// (turn_id, seq) uniqueness: 0 is a fixed placeholder, not an ordering value.
const SYSTEM_EVENT_SEQ = 0;

loadScriptEnv();

interface HashedChunk extends Chunk {
  contentHash: string;
}

interface DesiredDocumentChunks {
  document: CorpusDocument;
  chunks: HashedChunk[];
}

interface PendingEmbedding {
  slug: string;
  ordinal: number;
  content: string;
}

interface IngestSummary {
  documentsAdded: number;
  documentsUpdated: number;
  documentsDeleted: number;
  chunksEmbedded: number;
  chunksSkipped: number;
  chunksDeleted: number;
  tokensUsed: number;
}

function chunkKey(documentIdentifier: string, ordinal: number): string {
  return `${documentIdentifier}#${ordinal}`;
}

function documentChanged(existing: ExistingDocument | undefined, desired: CorpusDocument): boolean {
  if (!existing) return false; // brand new: counted as added, not updated
  return existing.title !== desired.title || existing.route !== desired.route || existing.kind !== desired.kind;
}

function buildCorpusHash(documents: CorpusDocument[]): string {
  const fingerprint = [...documents]
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((doc) => `${doc.slug}:${doc.content.trim()}`)
    .join('|');
  return hashContent(fingerprint);
}

function planEmbeddings(
  desired: DesiredDocumentChunks[],
  existingDocIdBySlug: Map<string, string>,
  existingHashByDocOrdinal: Map<string, string>,
): { pending: PendingEmbedding[]; totalDesiredChunks: number } {
  const pending: PendingEmbedding[] = [];
  let totalDesiredChunks = 0;

  for (const { document, chunks } of desired) {
    const existingDocId = existingDocIdBySlug.get(document.slug);
    for (const chunk of chunks) {
      totalDesiredChunks += 1;
      const priorHash = existingDocId ? existingHashByDocOrdinal.get(chunkKey(existingDocId, chunk.ordinal)) : undefined;
      if (priorHash !== chunk.contentHash) {
        pending.push({ slug: document.slug, ordinal: chunk.ordinal, content: chunk.content });
      }
    }
  }

  return { pending, totalDesiredChunks };
}

function loadDesiredState(): { desired: DesiredDocumentChunks[]; corpusHash: string } {
  const documents = loadCorpus();
  assertCorpusNotEmpty(documents);

  const desired = documents.map((document) => ({
    document,
    chunks: chunkDocument(document.content).map((chunk) => ({ ...chunk, contentHash: hashContent(chunk.content) })),
  }));

  return { desired, corpusHash: buildCorpusHash(documents) };
}

async function reconcile(desired: DesiredDocumentChunks[], corpusHash: string): Promise<IngestSummary> {
  const [existingDocuments, existingChunks] = await Promise.all([readExistingDocuments(), readExistingChunks()]);
  const existingDocBySlug = new Map(existingDocuments.map((doc) => [doc.slug, doc]));
  const existingDocIdBySlug = new Map(existingDocuments.map((doc) => [doc.slug, doc.id]));
  const existingHashByDocOrdinal = new Map(existingChunks.map((chunk) => [chunkKey(chunk.documentId, chunk.ordinal), chunk.contentHash]));

  const { pending, totalDesiredChunks } = planEmbeddings(desired, existingDocIdBySlug, existingHashByDocOrdinal);
  const embedding = await embedTexts(pending.map((item) => item.content));
  const embeddingByKey = new Map(pending.map((item, index) => [chunkKey(item.slug, item.ordinal), embedding.embeddings[index]]));

  const desiredSlugs = desired.map(({ document }) => document.slug);
  const db = getDb();

  return db.transaction(async (tx) => {
    const deletedDocumentSlugs = await deleteDocumentsNotIn(tx, desiredSlugs);
    const deletedDocumentIds = new Set(deletedDocumentSlugs.map((slug) => existingDocBySlug.get(slug)?.id));
    // Chunks of a wholly-deleted document disappear via `on delete cascade`, not the per-document
    // ordinal-shrink path below, so they need to be tallied separately for an accurate summary.
    let chunksDeleted = existingChunks.filter((chunk) => deletedDocumentIds.has(chunk.documentId)).length;

    let documentsAdded = 0;
    let documentsUpdated = 0;

    for (const { document, chunks } of desired) {
      const changed = documentChanged(existingDocBySlug.get(document.slug), document);
      const upserted = await upsertDocument(tx, {
        slug: document.slug,
        title: document.title,
        route: document.route,
        kind: document.kind,
      });
      if (upserted.inserted) documentsAdded += 1;
      else if (changed) documentsUpdated += 1;

      for (const chunk of chunks) {
        const embeddingVector = embeddingByKey.get(chunkKey(document.slug, chunk.ordinal));
        if (!embeddingVector) continue; // hash matched: no write needed

        await upsertChunk(tx, upserted.id, {
          ordinal: chunk.ordinal,
          heading: chunk.heading,
          content: chunk.content,
          contentHash: chunk.contentHash,
          embedding: embeddingVector,
        });
      }

      chunksDeleted += await deleteChunksNotIn(
        tx,
        upserted.id,
        chunks.map((chunk) => chunk.ordinal),
      );
    }

    await insertSystemEvent(tx, 'ingest_completed', SYSTEM_EVENT_SEQ, {
      embed_model: EMBEDDING_MODEL,
      dims: EMBEDDING_DIMENSIONS,
      corpus_hash: corpusHash,
    });

    return {
      documentsAdded,
      documentsUpdated,
      documentsDeleted: deletedDocumentSlugs.length,
      chunksEmbedded: pending.length,
      chunksSkipped: totalDesiredChunks - pending.length,
      chunksDeleted,
      tokensUsed: embedding.tokensUsed,
    };
  });
}

function printSummary(summary: IngestSummary): void {
  console.log('Ingest complete.');
  console.log(`  documents: +${summary.documentsAdded} added, ~${summary.documentsUpdated} updated, -${summary.documentsDeleted} deleted`);
  console.log(`  chunks:    ${summary.chunksEmbedded} embedded, ${summary.chunksSkipped} skipped, ${summary.chunksDeleted} deleted`);
  console.log(`  tokens used: ${summary.tokensUsed}`);
}

async function main(): Promise<void> {
  const { desired, corpusHash } = loadDesiredState();
  const summary = await reconcile(desired, corpusHash);
  printSummary(summary);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
