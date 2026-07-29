import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

/**
 * Postgres client for the ask agent: lazily-created pools, a typed query helper, and a
 * transaction helper for the ingest reconcile transaction (see docs/ask-agent/02-ingest.md).
 *
 * This is the only module in `lib/ask` that touches the database driver. Everything else
 * calls `query` or `withTransaction`, never `pg` directly, so parameterization and pool
 * lifecycle stay enforced in one place.
 *
 * Two roles, two connection strings, on the request path this module serves: the running app
 * connects as `ask_app` over `DATABASE_URL` (`query`, `withTransaction`, unchanged names and
 * signatures), and `npm run ingest` connects as `ask_ingest` over `DATABASE_INGEST_URL`
 * (`ingestQuery`, `ingestWithTransaction`). See db/roles.sql for why those two roles hold
 * different grants. `DATABASE_ADMIN_URL`, the third connection string, is never used from this
 * module: only scripts/db-setup.ts and scripts/db-roles.ts read it, each opening its own
 * short-lived `pg.Client` directly rather than going through the pool this file manages.
 */

const DATABASE_URL_ENV = 'DATABASE_URL';
const DATABASE_INGEST_URL_ENV = 'DATABASE_INGEST_URL';

/**
 * Small, serverless-appropriate pool settings. This runs on Vercel's Node runtime
 * (docs/ask-agent/05-runtime.md), where a warm function instance reuses this module's
 * globals but many instances can exist at once, and each holds its own pool. A generous
 * `max` per instance multiplies across instances and burns through Neon's connection limit
 * fast; this site's own traffic estimate is ~60 turns/day/user, so a handful of connections
 * per instance is already more than the request path ever needs concurrently.
 */
const POOL_MAX = 5;

/**
 * Idle connections are released quickly rather than held open. Serverless instances are
 * ephemeral and a connection sitting idle in a pool that may freeze mid-request is a
 * connection Neon still counts against its limit for no benefit.
 */
const IDLE_TIMEOUT_MS = 10_000;

/**
 * Generous enough to survive a cold Neon wake. docs/ask-agent/05-runtime.md notes cold
 * start plus Neon scale-to-zero can cost 0.5 to 5 seconds before the first byte; doubling
 * the worst case leaves room for that wake without making a genuinely dead database hang
 * the request for a long time.
 */
const CONNECT_TIMEOUT_MS = 10_000;

/** Thrown when the database is unreachable or misconfigured before any query runs. */
export class AskDbConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AskDbConfigError';
  }
}

declare global {
  // Next.js dev mode re-evaluates this module on every hot reload, but the Node process
  // (and therefore globalThis) survives across reloads. Caching pools on globalThis instead
  // of a plain module-level variable is what stops each reload from opening a new pool on
  // top of the last one and slowly exhausting Neon's connection limit.
  //
  // Keyed by env var name (`DATABASE_URL`, `DATABASE_INGEST_URL`), not a single `Pool`: this
  // module now serves two different roles over two different connection strings (`ask_app` /
  // `ask_ingest`, see db/roles.sql), each of which needs its own pool. A single cached `Pool`
  // would silently hand ingest's connection the app's pool (or vice versa) whichever env var
  // happened to be resolved first in a process where both are read, which is a correctness
  // bug, not a cosmetic one: every query after that point would run as the wrong role. A Map
  // keyed by env var name gives each connection string its own pool while still surviving hot
  // reload the same way the single-pool version did.
  // `var` is required syntax for ambient global augmentation; `let`/`const` are not allowed here.
  var __askPgPools: Map<string, Pool> | undefined;
}

function getPoolCache(): Map<string, Pool> {
  if (!globalThis.__askPgPools) {
    globalThis.__askPgPools = new Map<string, Pool>();
  }
  return globalThis.__askPgPools;
}

function createPool(envVar: string): Pool {
  const connectionString = process.env[envVar];
  if (!connectionString) {
    throw new AskDbConfigError(
      `Missing ${envVar}: it is not set in this process's environment. If you have ` +
        'already set it in a local configuration file, note that standalone scripts load ' +
        'configuration explicitly rather than picking it up automatically the way next dev ' +
        'and next build do; confirm that loading step ran before this. For preview and ' +
        'production, set it in the deployment environment (Vercel project settings). Never ' +
        'commit a real connection string.'
    );
  }

  return new Pool({
    connectionString,
    max: POOL_MAX,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    // Lets the process exit once the pool has nothing outstanding, instead of an idle
    // client keeping a serverless function instance alive past its work.
    allowExitOnIdle: true,
  });
}

/**
 * Returns the pool for `envVar`, creating it on first use and reusing it after. Defaults to
 * `DATABASE_URL`, the app's own connection, so existing callers that never think about which
 * connection they want keep getting the one they always got. Never logs or otherwise exposes
 * the connection string: only `pg` itself sees it, via `connectionString`.
 */
export function getPool(envVar: string = DATABASE_URL_ENV): Pool {
  const cache = getPoolCache();
  const cached = cache.get(envVar);
  if (cached) {
    return cached;
  }
  const pool = createPool(envVar);
  cache.set(envVar, pool);
  return pool;
}

/**
 * A query function shaped like `query` below, scoped to one client. The transaction
 * callback receives this instead of the module-level `query` so every statement inside a
 * transaction runs on the same connection, not a fresh one pulled from the pool.
 */
export type AskQueryFn = <Row extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[]
) => Promise<QueryResult<Row>>;

/**
 * Runs a parameterized query against the pool for `envVar` (`getPool`'s own default,
 * `DATABASE_URL`, if omitted).
 *
 * `params` is required, not optional, so a call site cannot pass a single pre-built string
 * and read as safe: every query has to name its bound values, even when there are none
 * (`query(sql, [])`). SQL is never built by concatenation in this file or expected to be
 * for callers of this function.
 */
async function queryOn<Row extends QueryResultRow = QueryResultRow>(
  envVar: string,
  text: string,
  params: unknown[]
): Promise<QueryResult<Row>> {
  return getPool(envVar).query<Row>(text, params);
}

/**
 * Runs `callback` inside a single transaction on the pool for `envVar`: `begin`, the
 * callback, `commit`. Any throw from the callback (or from `commit` itself) triggers a
 * `rollback` and rethrows the original error. This is the shape the ingest reconcile needs
 * (see docs/ask-agent/02-ingest.md): upsert documents and chunks, sweep deleted ones, and
 * update `corpus_meta`, all atomically so MVCC keeps concurrent readers on the previous
 * snapshot until commit.
 *
 * The callback gets its own `AskQueryFn` bound to the transaction's client, not `query` or
 * `ingestQuery`, so every statement inside the callback runs on the same connection and
 * participates in the transaction.
 *
 * Rollback is defensive: if it fails too, that failure is not what gets thrown. Masking the
 * original error with a rollback error would hide the actual cause and leave a future
 * reader debugging the wrong problem.
 */
async function withTransactionOn<T>(
  envVar: string,
  callback: (query: AskQueryFn) => Promise<T>
): Promise<T> {
  const client: PoolClient = await getPool(envVar).connect();
  const txQuery: AskQueryFn = <Row extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[]
  ) => client.query<Row>(text, params);

  try {
    await client.query('begin');
    const result = await callback(txQuery);
    await client.query('commit');
    return result;
  } catch (err) {
    try {
      await client.query('rollback');
    } catch (rollbackErr) {
      // The original error is the one the caller needs to see and act on; a failed
      // rollback is a secondary problem, surfaced here rather than thrown in its place.
      console.error('Rollback failed after a transaction error:', rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * The app's own connection (`ask_app` over `DATABASE_URL`). Signature and behavior unchanged
 * from before this module supported more than one connection string, so every existing call
 * site keeps compiling and keeps talking to the same role it always did.
 */
export async function query<Row extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[]
): Promise<QueryResult<Row>> {
  return queryOn<Row>(DATABASE_URL_ENV, text, params);
}

/** The app's own transaction helper (`ask_app` over `DATABASE_URL`). See `withTransactionOn`. */
export async function withTransaction<T>(
  callback: (query: AskQueryFn) => Promise<T>
): Promise<T> {
  return withTransactionOn(DATABASE_URL_ENV, callback);
}

/**
 * Ingest's connection (`ask_ingest` over `DATABASE_INGEST_URL`). Used only by
 * scripts/ingest.ts; the running app never imports this. Same shape as `query`, over a
 * separate pool cached under its own key (see the `globalThis.__askPgPools` comment above).
 */
export async function ingestQuery<Row extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[]
): Promise<QueryResult<Row>> {
  return queryOn<Row>(DATABASE_INGEST_URL_ENV, text, params);
}

/** Ingest's transaction helper (`ask_ingest` over `DATABASE_INGEST_URL`). See `withTransactionOn`. */
export async function ingestWithTransaction<T>(
  callback: (query: AskQueryFn) => Promise<T>
): Promise<T> {
  return withTransactionOn(DATABASE_INGEST_URL_ENV, callback);
}
