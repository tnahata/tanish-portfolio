import { chunkDocument, hashContent } from '../lib/ask/chunk';
import { loadCorpus } from '../lib/ask/corpus';
import { ingestQuery, ingestWithTransaction, type AskQueryFn } from '../lib/ask/db';
import { embedDocuments, EMBED_MODEL, EMBED_DIMENSIONS, type EmbedBatchResult } from '../lib/ask/embed';
import type { CorpusChunk, CorpusDocument, DocumentSource } from '../lib/ask/types';
import { loadScriptEnv } from './load-env';

/**
 * Runs as the first statement after the imports above, before anything else in this module
 * does real work. `tsx scripts/ingest.ts` is plain Node, not `next dev`/`next build`, so
 * without this call `DATABASE_URL` and `OPENAI_API_KEY` are undefined in this process
 * regardless of what a developer has set locally: see the module doc on `loadScriptEnv` in
 * ./load-env for why this placement is correct even though ES imports are hoisted above it.
 * `lib/ask/db.ts` and `lib/ask/embed.ts` both confirmed to read `process.env` lazily inside
 * functions, not at their own module top level, so running this after the import statements
 * (but before `main()`) is sufficient.
 */
loadScriptEnv();

/**
 * Ingest: reconciles the corpus tables to the desired state declared by
 * `content/corpus/*.md` and every blog post. See docs/ask-agent/02-ingest.md, which this
 * follows exactly.
 *
 * This is a reconcile, not a rebuild: read the files, compute what the index *should*
 * contain, diff against what it *does* contain, apply only the difference. The deletion
 * sweep (`sweepDeletedDocuments`) is the one correctness-critical step: it is driven by set
 * difference against the on-disk manifest, not by a per-file loop, because a per-file loop
 * never visits a file that no longer exists and its rows would keep being retrieved forever.
 *
 * Run with `npm run ingest`. Add `--force` to re-embed every chunk regardless of
 * `content_hash` and rewrite `corpus_meta` unconditionally; that flag exists for the one case
 * hashing cannot detect, an embedding model or dimension change, where every existing vector
 * is stale even though the text did not change.
 */

/** The only source this script writes. Published gap answers (`source = 'asked'`) are a
 *  separate, runtime code path and must never be touched here; that is what makes it safe for
 *  the sweep below to delete anything file-sourced that disk no longer declares. */
const DOCUMENT_SOURCE_FILE: DocumentSource = 'file';

/**
 * Thrown when `reconcileCorpus` is asked to reconcile against an empty desired corpus.
 *
 * An empty desired state is never a legitimate reconcile: authored content in
 * `content/corpus` and the blog is never intentionally reduced to nothing. In Postgres,
 * `slug <> all($1::text[])` with an empty `$1` is vacuously true for every row (the ALL
 * quantifier over an empty set has nothing to fail the comparison), so
 * `sweepDeletedDocuments` would match and delete every file-sourced document, cascading to
 * every chunk, and commit before anyone could notice. `loadCorpus` (lib/ask/corpus.ts)
 * returns `[]` silently rather than throwing when `content/corpus` does not exist, so this
 * is reachable from an ordinary mistake (wrong working directory, a bad CI checkout, a
 * renamed corpus directory), not just a hypothetical.
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

/**
 * The guard against the empty-corpus wipe, called as the first statement of
 * `reconcileCorpus` so it runs before `fetchExistingState` reads a single row, before any
 * OpenAI call, and before `withTransaction` opens. Kept as its own function rather than an
 * inline `if` so the check reads as a precondition of the reconcile, not a rule buried among
 * the rest of the function's logic; a future refactor that reorders `reconcileCorpus` still
 * has to consciously delete this call to lose the protection, rather than accidentally
 * routing around an `if` sitting mid-function.
 */
function assertCorpusNotEmpty(corpus: CorpusDocument[]): void {
  if (corpus.length === 0) {
    throw new AskIngestEmptyCorpusError();
  }
}

/**
 * Thrown when the corpus tables or the `vector` extension are missing entirely: this is the
 * failure the user actually hit, running `npm run ingest` against a database that had never had
 * `npm run db:setup` applied to it. Without this check, the first thing to reach Postgres would
 * be `fetchExistingState`'s `select ... from documents`, and the error a developer would see
 * would be a raw `relation "documents" does not exist`, with no pointer to the fix.
 */
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

/**
 * Thrown when the corpus tables exist but ask_ingest lacks a grant on one of them. This is a
 * distinct failure from `AskIngestSchemaMissingError`: db/roles.sql deliberately does not use
 * `alter default privileges` for the exact per-table grant matrix (see that file's "Deliberately
 * no alter default privileges" section), so a table added to db/schema.sql after db/roles.sql
 * last ran has no grant for ask_ingest until `npm run db:roles` runs again. Without this check,
 * that would surface as a raw `permission denied for table <name>`, indistinguishable at a
 * glance from a genuine bug in this script.
 */
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

/**
 * The guard against running a reconcile with no schema to reconcile against, or with a schema
 * that exists but ask_ingest cannot yet read or write. Called as the first statement of `main`,
 * before `loadCorpus` reads a single file and before any OpenAI call, so a missing or
 * under-granted database is reported before any other work happens.
 *
 * Two checks, in order: first `to_regclass('public.documents')` and `to_regtype('vector')` in
 * one round trip (the exact technique named in the brief for this check), which distinguishes
 * "schema never installed" from everything else. Then, only if that passes, a zero-row `select 1
 * from <table> limit 0` against each corpus table, which touches no data but does exercise
 * ask_ingest's actual SELECT grant on that table; the table names come from the fixed
 * `CORPUS_TABLES` constant above, never from external input, so building that one clause with a
 * template string is safe despite table names not being bindable as query parameters.
 */
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

/**
 * The seam between reconcile logic and I/O. `query` and `withTransaction` are the same
 * functions `lib/ask/db.ts` exports; `embed` is `embedDocuments`. Injected so tests can drive
 * `reconcileCorpus` against fakes, with no real database connection and no OpenAI call.
 */
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

/**
 * Pure diff for one document's chunks: no I/O, no OpenAI, no database. Exported so the
 * decision logic (which four causes of staleness apply, see docs/ask-agent/02-ingest.md) can
 * be tested directly against plain objects, independent of how the rows were fetched or how
 * the plan gets applied.
 */
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

  // Anything stored at an ordinal the new chunk list no longer reaches is orphaned by a
  // shortened file, not by an edit; those rows are deleted outright, never re-embedded.
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

/**
 * Reads the current file-sourced state in two queries: documents, then their chunks. This
 * runs on the pool-level `query` (not inside the write transaction) because it only informs
 * the diff; see the module doc comment on `reconcileCorpus` for why the transaction boundary
 * starts later.
 */
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

/**
 * pgvector's text input format for a `vector` column is a bracketed, comma-separated list of
 * numbers (`[0.1,0.2,...]`), the same shape `Array.prototype.join` produces. The `pg` driver
 * has no native vector type, so the value is sent as text and cast explicitly with `::vector`
 * in the SQL rather than left for Postgres to infer.
 */
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

/**
 * The sweep. Driven by the full set of slugs found on disk, not by iterating documents one at
 * a time: a per-file loop never visits a file that has been deleted, so its row would survive
 * and keep being retrieved forever. Scoped to `source = 'file'`, so a published gap answer
 * (`source = 'asked'`) is never a candidate no matter what `desiredSlugs` contains.
 */
async function sweepDeletedDocuments(txQuery: AskQueryFn, desiredSlugs: string[]): Promise<number> {
  const result = await txQuery(
    'delete from documents where source = $1 and slug <> all($2::text[]) returning slug',
    [DOCUMENT_SOURCE_FILE, desiredSlugs]
  );
  return result.rowCount ?? result.rows.length;
}

/**
 * A hash of the entire desired corpus (every document's slug and content), not any single
 * file. Changes whenever content is edited, added, or removed, which is exactly the signal
 * `corpus_meta.corpus_hash` needs to exist for (see docs/ask-agent/03-data-model.md).
 */
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

/**
 * Runs the full reconcile and returns a summary. This is the pure-ish core the tests exercise
 * directly: given a `corpus` and an `IngestRuntime` (real or faked), it makes every decision
 * about what to embed, skip, upsert, and delete, with no hidden dependency on the filesystem,
 * `process.argv`, or wall-clock time.
 *
 * Where the OpenAI calls sit relative to the transaction: `runtime.embed` is called before
 * `runtime.withTransaction` opens, not inside it. The correctness property the doc asks for
 * (MVCC keeps concurrent readers on the previous snapshot; no window where the index is
 * empty) only constrains the *write* window: every database write has to land in one commit.
 * It says nothing about when the embeddings were computed. OpenAI calls are slow, rate
 * limited, and themselves retry with backoff (see lib/ask/embed.ts); holding a pooled
 * Postgres connection open for that entire span, inside a transaction, would tie an unrelated
 * failure domain (OpenAI flakiness) to a scarce resource (`POOL_MAX = 5` in lib/ask/db.ts) and
 * turn a slow OpenAI retry storm into a long-running transaction, which is its own liability
 * (lock contention, vacuum bloat). Ingest is a single-writer manual/CI script, so the brief
 * gap between reading existing state and opening the write transaction is not a real race in
 * practice. Embedding first, then writing everything atomically, gets the same guarantee the
 * doc asks for at a lower cost.
 */
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

  // One OpenAI call site for the whole corpus: embed.ts batches internally, so calling it
  // once with every changed chunk (instead of once per document) lets it pack requests
  // optimally. Skipped entirely when nothing changed, so an unchanged corpus costs zero calls.
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

  // Reported separately from the sweep's own row count: the sweep deletes documents, and
  // their chunks disappear via `on delete cascade`, so this is purely for a readable summary.
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

  // Before any real work: confirm the schema exists and ask_ingest can actually read and write
  // the corpus tables, not just that DATABASE_INGEST_URL points at a live database. See
  // `assertSchemaExists` above for exactly what this does and does not catch.
  await assertSchemaExists(ingestQuery);

  const corpus = loadCorpus();
  const summary = await reconcileCorpus(corpus, { force }, createDefaultRuntime());

  printSummary(summary, Date.now() - startedAt, force);
}

// Only run when executed directly (`npm run ingest`), never on import. Tests import this
// module for `reconcileCorpus` and `planDocumentChunks`; without this guard, importing the
// file would call `main()` and fail on a missing DATABASE_URL or OPENAI_API_KEY.
const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
