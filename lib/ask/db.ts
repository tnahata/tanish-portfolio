import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

/**
 * Postgres client for the ask agent: one lazily-created pool, a typed query helper, and a
 * transaction helper for the ingest reconcile transaction (see docs/ask-agent/02-ingest.md).
 *
 * This is the only module in `lib/ask` that touches the database driver. Everything else
 * calls `query` or `withTransaction`, never `pg` directly, so parameterization and pool
 * lifecycle stay enforced in one place.
 */

const DATABASE_URL_ENV = 'DATABASE_URL';

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
  // (and therefore globalThis) survives across reloads. Caching the pool on globalThis
  // instead of a plain module-level variable is what stops each reload from opening a new
  // pool on top of the last one and slowly exhausting Neon's connection limit.
  // `var` is required syntax for ambient global augmentation; `let`/`const` are not allowed here.
  var __askPgPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env[DATABASE_URL_ENV];
  if (!connectionString) {
    throw new AskDbConfigError(
      `Missing ${DATABASE_URL_ENV}. Set it in .env.local for local development, or in the ` +
        'deployment environment (Vercel project settings) for preview and production. Never ' +
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
 * Returns the process-wide pool, creating it on first use. Never logs or otherwise exposes
 * the connection string: only `pg` itself sees it, via `connectionString`.
 */
export function getPool(): Pool {
  if (!globalThis.__askPgPool) {
    globalThis.__askPgPool = createPool();
  }
  return globalThis.__askPgPool;
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
 * Runs a parameterized query against the pool.
 *
 * `params` is required, not optional, so a call site cannot pass a single pre-built string
 * and read as safe: every query has to name its bound values, even when there are none
 * (`query(sql, [])`). SQL is never built by concatenation in this file or expected to be
 * for callers of this function.
 */
export async function query<Row extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[]
): Promise<QueryResult<Row>> {
  return getPool().query<Row>(text, params);
}

/**
 * Runs `callback` inside a single transaction: `begin`, the callback, `commit`. Any throw
 * from the callback (or from `commit` itself) triggers a `rollback` and rethrows the
 * original error. This is the shape the ingest reconcile needs (see
 * docs/ask-agent/02-ingest.md): upsert documents and chunks, sweep deleted ones, and update
 * `corpus_meta`, all atomically so MVCC keeps concurrent readers on the previous snapshot
 * until commit.
 *
 * The callback gets its own `AskQueryFn` bound to the transaction's client, not the
 * module-level `query`, so every statement inside the callback runs on the same connection
 * and participates in the transaction.
 *
 * Rollback is defensive: if it fails too, that failure is not what gets thrown. Masking the
 * original error with a rollback error would hide the actual cause and leave a future
 * reader debugging the wrong problem.
 */
export async function withTransaction<T>(
  callback: (query: AskQueryFn) => Promise<T>
): Promise<T> {
  const client: PoolClient = await getPool().connect();
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
