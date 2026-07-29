import { chunkDocument, hashContent } from '../lib/ask/chunk';
import { loadCorpus } from '../lib/ask/corpus';
import { ingestQuery, ingestWithTransaction, type AskQueryFn } from '../lib/ask/db';
import { embedDocuments, EMBED_MODEL, EMBED_DIMENSIONS, type EmbedBatchResult } from '../lib/ask/embed';
import type { CorpusChunk, CorpusDocument, DocumentSource } from '../lib/ask/types';
import { loadScriptEnv } from './load-env';

// Must run before any process.env read; standalone scripts get no automatic env loading.
// See scripts/load-env.ts.
loadScriptEnv();

/** Reconciles the corpus tables to content/corpus/*.md and every blog post; see
 *  docs/ask-agent/02-ingest.md. `--force` re-embeds every chunk (an embed model/dimension change). */

/** The only source this script writes. Published gap answers (`source = 'asked'`) are a
 *  separate runtime path the sweep below must never touch. */
const DOCUMENT_SOURCE_FILE: DocumentSource = 'file';

/**
 * Thrown by assertCorpusNotEmpty. An empty desired corpus is never legitimate, and reachable
 * from an ordinary mistake (wrong working directory, a bad CI checkout, a renamed corpus
 * directory: loadCorpus returns `[]` rather than throwing). Without this guard, Postgres's
 * `slug <> all('{}')` is vacuously true for every row, so the sweep below would delete every
 * file-sourced document in one commit. Full reasoning: docs/ask-agent/02-ingest.md.
 */
export class AskIngestEmptyCorpusError extends Error {
  constructor() {
    super(
      'Refusing to reconcile: the loaded corpus is empty. An empty desired state is never ' +
        'a legitimate result of loading content/corpus and the blog, so this almost always ' +
        'means npm run ingest ran from the wrong working directory, content/corpus is ' +
        'missing or was renamed, or a CI checkout did not fetch the content directory. ' +
        'Check the working directory and confirm content/corpus contains the expected ' +
        'files before retrying; do not re-run with any flag that bypasses this check.'
    );
    this.name = 'AskIngestEmptyCorpusError';
  }
}

/** Called as the literal first statement of reconcileCorpus, before any query, embedding
 *  call, or transaction. See AskIngestEmptyCorpusError above for why. */
function assertCorpusNotEmpty(corpus: CorpusDocument[]): void {
  if (corpus.length === 0) {
    throw new AskIngestEmptyCorpusError();
  }
}

/** Thrown when the corpus tables or the `vector` extension are missing: `npm run db:setup`
 *  was never applied to this database. */
export class AskIngestSchemaMissingError extends Error {
  constructor() {
    super(
      'The ask agent schema is not installed on this database: public.documents does not exist, ' +
        'or the vector extension is not installed. Run `npm run db:setup` first, which applies ' +
        'db/schema.sql over DATABASE_ADMIN_URL, then re-run `npm run ingest`.'
    );
    this.name = 'AskIngestSchemaMissingError';
  }
}

/** Thrown when the table exists but ask_ingest lacks a grant on it (distinct from
 *  AskIngestSchemaMissingError); see db/roles.sql "Apply order". */
export class AskIngestMissingGrantError extends Error {
  constructor(table: string) {
    super(
      `ask_ingest does not have the privileges it needs on "${table}" yet. This usually means a ` +
        'table was added to db/schema.sql after db/roles.sql\'s grants were last applied, or ' +
        '`npm run db:roles` ran before `npm run db:setup` created this table and has not been ' +
        'run a second time since. Run `npm run db:setup` (if the table is new) and then ' +
        '`npm run db:roles`, then re-run `npm run ingest`.'
    );
    this.name = 'AskIngestMissingGrantError';
  }
}

/** Postgres's SQLSTATE for insufficient_privilege: a grant is missing, not a bad query. */
const POSTGRES_INSUFFICIENT_PRIVILEGE = '42501';
/** Postgres's SQLSTATE for undefined_table: the relation itself does not exist. */
const POSTGRES_UNDEFINED_TABLE = '42P01';

/** The three tables ingest reads and writes; see db/roles.sql for why these three specifically. */
const CORPUS_TABLES = ['corpus_meta', 'documents', 'chunks'] as const;

function postgresErrorCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const { code } = err as { code?: unknown };
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

/** Preflight: schema check (to_regclass/to_regtype), then a zero-row select per CORPUS_TABLES
 *  to exercise ask_ingest's actual grant, not just connectivity. */
export async function assertSchemaExists(runtimeQuery: AskQueryFn): Promise<void> {
  const result = await runtimeQuery<{ documents_reg: string | null; vector_reg: string | null }>(
    "select to_regclass('public.documents') as documents_reg, to_regtype('vector') as vector_reg",
    []
  );
  const row = result.rows[0];
  if (!row || row.documents_reg === null || row.vector_reg === null) {
    throw new AskIngestSchemaMissingError();
  }

  for (const table of CORPUS_TABLES) {
    try {
      await runtimeQuery(`select 1 from ${table} limit 0`, []);
    } catch (err) {
      const code = postgresErrorCode(err);
      if (code === POSTGRES_INSUFFICIENT_PRIVILEGE) {
        throw new AskIngestMissingGrantError(table);
      }
      if (code === POSTGRES_UNDEFINED_TABLE) {
        throw new AskIngestSchemaMissingError();
      }
      throw err;
    }
  }
}

export interface IngestOptions {
  /** Re-embed every chunk and rewrite corpus_meta, regardless of content_hash. */
  force: boolean;
}

export interface IngestSummary {
  documentsAdded: number;
  documentsUpdated: number;
  documentsDeleted: number;
  chunksEmbedded: number;
  chunksSkipped: number;
  chunksDeleted: number;
  tokensUsed: number;
}

/** The I/O seam: real db.ts/embed.ts functions in production, fakes in tests (no real
 *  connection or OpenAI call). */
export interface IngestRuntime {
  query: AskQueryFn;
  withTransaction: <T>(callback: (txQuery: AskQueryFn) => Promise<T>) => Promise<T>;
  embed: (texts: string[]) => Promise<EmbedBatchResult>;
}

/** A stored chunk's identity for diffing: what ordinal it holds and what it last hashed to. */
export interface ExistingChunkRef {
  ordinal: number;
  contentHash: string;
}

export interface ChunkPlan {
  /** New or edited chunks: content_hash differs from what is stored, or --force. */
  toEmbed: CorpusChunk[];
  /** Chunks whose content_hash already matches the stored row; zero OpenAI calls for these. */
  toSkip: CorpusChunk[];
  /** Ordinals stored in the database that the new chunk list no longer reaches (file got shorter). */
  obsoleteOrdinals: number[];
}

/** Pure diff for one document's chunks (no I/O): which are new/edited, which are unchanged,
 *  which are orphaned. The four staleness causes are in docs/ask-agent/02-ingest.md. */
export function planDocumentChunks(
  newChunks: CorpusChunk[],
  existingChunks: ExistingChunkRef[],
  force: boolean
): ChunkPlan {
  const previousHashByOrdinal = new Map(existingChunks.map((c) => [c.ordinal, c.contentHash]));
  const toEmbed: CorpusChunk[] = [];
  const toSkip: CorpusChunk[] = [];

  for (const chunk of newChunks) {
    const previousHash = previousHashByOrdinal.get(chunk.ordinal);
    const isNewOrEdited = previousHash === undefined || previousHash !== chunk.contentHash;
    (force || isNewOrEdited ? toEmbed : toSkip).push(chunk);
  }

  // Orphaned by a shortened file, not an edit: deleted outright, never re-embedded.
  const newChunkCount = newChunks.length;
  const obsoleteOrdinals = existingChunks
    .map((c) => c.ordinal)
    .filter((ordinal) => ordinal >= newChunkCount);

  return { toEmbed, toSkip, obsoleteOrdinals };
}

interface ExistingDocumentState {
  id: string;
  /** ordinal -> content_hash, for every chunk currently stored under this document. */
  chunks: Map<number, string>;
}

/** Reads current file-sourced state (documents, then their chunks) on the pool-level `query`,
 *  not inside the write transaction: it only informs the diff. See reconcileCorpus below. */
async function fetchExistingState(runtimeQuery: AskQueryFn): Promise<Map<string, ExistingDocumentState>> {
  const documentsResult = await runtimeQuery<{ id: string; slug: string }>(
    'select id, slug from documents where source = $1',
    [DOCUMENT_SOURCE_FILE]
  );

  const bySlug = new Map<string, ExistingDocumentState>();
  const slugById = new Map<string, string>();
  for (const row of documentsResult.rows) {
    bySlug.set(row.slug, { id: row.id, chunks: new Map() });
    slugById.set(row.id, row.slug);
  }

  if (documentsResult.rows.length > 0) {
    const documentIds = documentsResult.rows.map((row) => row.id);
    const chunksResult = await runtimeQuery<{
      document_id: string;
      ordinal: number;
      content_hash: string;
    }>('select document_id, ordinal, content_hash from chunks where document_id = any($1::uuid[])', [
      documentIds,
    ]);

    for (const row of chunksResult.rows) {
      const slug = slugById.get(row.document_id);
      if (!slug) continue;
      bySlug.get(slug)?.chunks.set(row.ordinal, row.content_hash);
    }
  }

  return bySlug;
}

/** pgvector's text input format: bracketed CSV, sent as text and cast with `::vector` (the
 *  `pg` driver has no native vector type). */
function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

/** `${slug}\0${ordinal}` is a stable key across two data structures without object identity. */
function chunkKey(slug: string, ordinal: number): string {
  return `${slug}\u0000${ordinal}`;
}

async function upsertDocument(
  txQuery: AskQueryFn,
  document: CorpusDocument
): Promise<{ id: string; inserted: boolean }> {
  const result = await txQuery<{ id: string; inserted: boolean }>(
    `insert into documents (slug, source, route, external_url, title, kind, verbatim_only)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (slug) do update set
       route = excluded.route,
       external_url = excluded.external_url,
       title = excluded.title,
       kind = excluded.kind,
       verbatim_only = excluded.verbatim_only
     returning id, (xmax = 0) as inserted`,
    [
      document.slug,
      DOCUMENT_SOURCE_FILE,
      document.route,
      document.externalUrl,
      document.title,
      document.kind,
      document.verbatimOnly,
    ]
  );

  const row = result.rows[0];
  return { id: row.id, inserted: row.inserted };
}

async function upsertChunk(
  txQuery: AskQueryFn,
  documentId: string,
  chunk: CorpusChunk,
  embedding: number[]
): Promise<void> {
  await txQuery(
    `insert into chunks (document_id, ordinal, heading, content, content_hash, token_count, embedding)
     values ($1, $2, $3, $4, $5, $6, $7::vector)
     on conflict (document_id, ordinal) do update set
       heading = excluded.heading,
       content = excluded.content,
       content_hash = excluded.content_hash,
       token_count = excluded.token_count,
       embedding = excluded.embedding`,
    [
      documentId,
      chunk.ordinal,
      chunk.heading,
      chunk.content,
      chunk.contentHash,
      chunk.tokenCount,
      toVectorLiteral(embedding),
    ]
  );
}

async function deleteObsoleteChunks(
  txQuery: AskQueryFn,
  documentId: string,
  ordinals: number[]
): Promise<void> {
  await txQuery('delete from chunks where document_id = $1 and ordinal = any($2::int[])', [
    documentId,
    ordinals,
  ]);
}

/** The sweep: driven by desired slugs, not a per-file loop (which never visits a deleted
 *  file). Scoped to `source = 'file'` so a published gap answer is never a candidate. */
async function sweepDeletedDocuments(txQuery: AskQueryFn, desiredSlugs: string[]): Promise<number> {
  const result = await txQuery(
    'delete from documents where source = $1 and slug <> all($2::text[]) returning slug',
    [DOCUMENT_SOURCE_FILE, desiredSlugs]
  );
  return result.rowCount ?? result.rows.length;
}

/** Hash of the whole desired corpus, not one file; feeds corpus_meta.corpus_hash
 *  (docs/ask-agent/03-data-model.md). */
function computeCorpusHash(corpus: CorpusDocument[]): string {
  const combined = corpus.map((doc) => `${doc.slug}\u0000${doc.content}`).join('\u0001');
  return hashContent(combined);
}

async function writeCorpusMeta(txQuery: AskQueryFn, corpus: CorpusDocument[]): Promise<void> {
  await txQuery(
    `insert into corpus_meta (id, embed_model, embed_dims, corpus_hash, ingested_at)
     values (1, $1, $2, $3, now())
     on conflict (id) do update set
       embed_model = excluded.embed_model,
       embed_dims = excluded.embed_dims,
       corpus_hash = excluded.corpus_hash,
       ingested_at = excluded.ingested_at`,
    [EMBED_MODEL, EMBED_DIMENSIONS, computeCorpusHash(corpus)]
  );
}

/** The pure-ish core tests exercise directly: decides everything to embed/skip/upsert/delete.
 *  Embeds before opening the transaction; see docs/ask-agent/02-ingest.md for why that is safe. */
export async function reconcileCorpus(
  corpus: CorpusDocument[],
  options: IngestOptions,
  runtime: IngestRuntime
): Promise<IngestSummary> {
  assertCorpusNotEmpty(corpus);

  const desired = corpus.map((document) => ({ document, chunks: chunkDocument(document.content) }));
  const desiredSlugs = desired.map(({ document }) => document.slug);

  const existing = await fetchExistingState(runtime.query);

  const plans = desired.map(({ document, chunks }) => {
    const existingDocument = existing.get(document.slug);
    const existingChunks: ExistingChunkRef[] = existingDocument
      ? Array.from(existingDocument.chunks.entries()).map(([ordinal, contentHash]) => ({
          ordinal,
          contentHash,
        }))
      : [];
    return { document, chunks, plan: planDocumentChunks(chunks, existingChunks, options.force) };
  });

  // One OpenAI call for the whole corpus (embed.ts batches internally); zero calls if nothing changed.
  const toEmbedTexts = plans.flatMap(({ plan }) => plan.toEmbed.map((chunk) => chunk.content));
  const embedResult: EmbedBatchResult =
    toEmbedTexts.length > 0 ? await runtime.embed(toEmbedTexts) : { embeddings: [], tokensUsed: 0 };

  const embeddingByKey = new Map<string, number[]>();
  let cursor = 0;
  for (const { document, plan } of plans) {
    for (const chunk of plan.toEmbed) {
      embeddingByKey.set(chunkKey(document.slug, chunk.ordinal), embedResult.embeddings[cursor]);
      cursor++;
    }
  }

  // Chunks disappear via `on delete cascade`; counted here only for a readable summary.
  const sweptSlugs = Array.from(existing.keys()).filter((slug) => !desiredSlugs.includes(slug));
  const sweptChunkCount = sweptSlugs.reduce(
    (sum, slug) => sum + (existing.get(slug)?.chunks.size ?? 0),
    0
  );

  return runtime.withTransaction(async (txQuery) => {
    let documentsAdded = 0;
    let documentsUpdated = 0;
    let chunksSkipped = 0;
    let chunksDeleted = 0;

    for (const { document, plan } of plans) {
      const { id: documentId, inserted } = await upsertDocument(txQuery, document);
      if (inserted) documentsAdded++;
      else documentsUpdated++;

      for (const chunk of plan.toEmbed) {
        const embedding = embeddingByKey.get(chunkKey(document.slug, chunk.ordinal));
        if (!embedding) {
          throw new Error(
            `internal error: no embedding computed for ${document.slug} ordinal ${chunk.ordinal}`
          );
        }
        await upsertChunk(txQuery, documentId, chunk, embedding);
      }

      if (plan.obsoleteOrdinals.length > 0) {
        await deleteObsoleteChunks(txQuery, documentId, plan.obsoleteOrdinals);
        chunksDeleted += plan.obsoleteOrdinals.length;
      }

      chunksSkipped += plan.toSkip.length;
    }

    const documentsDeleted = await sweepDeletedDocuments(txQuery, desiredSlugs);
    chunksDeleted += sweptChunkCount;

    await writeCorpusMeta(txQuery, corpus);

    return {
      documentsAdded,
      documentsUpdated,
      documentsDeleted,
      chunksEmbedded: toEmbedTexts.length,
      chunksSkipped,
      chunksDeleted,
      tokensUsed: embedResult.tokensUsed,
    };
  });
}

function createDefaultRuntime(): IngestRuntime {
  return { query: ingestQuery, withTransaction: ingestWithTransaction, embed: embedDocuments };
}

function printSummary(summary: IngestSummary, elapsedMs: number, force: boolean): void {
  const elapsedSeconds = (elapsedMs / 1000).toFixed(1);
  console.log(`Ingest complete in ${elapsedSeconds}s${force ? ' (forced full re-embed)' : ''}.`);
  console.log(
    `Documents: ${summary.documentsAdded} added, ${summary.documentsUpdated} updated, ` +
      `${summary.documentsDeleted} deleted.`
  );
  console.log(
    `Chunks: ${summary.chunksEmbedded} embedded, ${summary.chunksSkipped} skipped, ` +
      `${summary.chunksDeleted} deleted.`
  );
  console.log(`Tokens used: ${summary.tokensUsed}.`);
}

async function main(): Promise<void> {
  const force = process.argv.slice(2).includes('--force');
  const startedAt = Date.now();

  await assertSchemaExists(ingestQuery);

  const corpus = loadCorpus();
  const summary = await reconcileCorpus(corpus, { force }, createDefaultRuntime());

  printSummary(summary, Date.now() - startedAt, force);
}

// Only run when executed directly; tests import this module without triggering main().
const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
