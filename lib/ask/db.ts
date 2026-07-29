import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

/**
 * Postgres client for the ask agent: lazy per-role pools, a query/transaction helper, and
 * Drizzle handles over the same pools. See docs/ask-agent/03-data-model.md for the role split.
 */

const DATABASE_URL_ENV = 'DATABASE_URL';
const DATABASE_INGEST_URL_ENV = 'DATABASE_INGEST_URL';

/** Small: each serverless instance holds its own pool, and a generous `max` multiplies across
 *  every instance running at once against Neon's shared connection limit. */
const POOL_MAX = 5;

/** Released quickly: an idle connection in a pool that may freeze mid-request still counts
 *  against Neon's connection limit for no benefit. */
const IDLE_TIMEOUT_MS = 10_000;

/** Generous enough to survive a cold Neon wake (0.5-5s, see docs/ask-agent/05-runtime.md)
 *  without hanging on a genuinely dead database for long. */
const CONNECT_TIMEOUT_MS = 10_000;

/** Thrown when the database is unreachable or misconfigured before any query runs. */
export class AskDbConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AskDbConfigError';
  }
}

declare global {
  // Cached on globalThis (survives hot reload), keyed per env var so ask_app and ask_ingest
  // never share a pool. `var` is required syntax here. See docs/ask-agent/03-data-model.md.
  var __askPgPools: Map<string, Pool> | undefined;

  // Same reasoning as __askPgPools. A NodePgDatabase is a stateless wrapper around that pool,
  // so caching it is about object identity, not avoiding a real connection.
  var __askDrizzleDbs: Map<string, NodePgDatabase<typeof schema>> | undefined;
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

/** Returns the pool for `envVar` (default `DATABASE_URL`), creating it on first use. Never
 *  logs the connection string; only `pg` itself sees it. */
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

function getDrizzleCache(): Map<string, NodePgDatabase<typeof schema>> {
  if (!globalThis.__askDrizzleDbs) {
    globalThis.__askDrizzleDbs = new Map<string, NodePgDatabase<typeof schema>>();
  }
  return globalThis.__askDrizzleDbs;
}

/** Returns the Drizzle handle for `envVar`, wrapping and caching `getPool(envVar)` the same
 *  way. Not exported: `db()` and `ingestDb()` below are the only call sites this project needs. */
function getDrizzleDb(envVar: string = DATABASE_URL_ENV): NodePgDatabase<typeof schema> {
  const cache = getDrizzleCache();
  const cached = cache.get(envVar);
  if (cached) {
    return cached;
  }
  const instance = drizzle(getPool(envVar), { schema });
  cache.set(envVar, instance);
  return instance;
}

/** The app's own Drizzle handle. A function, not a top-level const, because eagerly reading
 *  `process.env` would run before scripts finish loading their own env vars. Call as `db().select()...`. */
export function db(): NodePgDatabase<typeof schema> {
  return getDrizzleDb(DATABASE_URL_ENV);
}

/** Ingest's Drizzle handle (`ask_ingest` over `DATABASE_INGEST_URL`). Same laziness reasoning
 *  as `db()`. Used by scripts/ingest.ts only; the running app never imports this. */
export function ingestDb(): NodePgDatabase<typeof schema> {
  return getDrizzleDb(DATABASE_INGEST_URL_ENV);
}

/** A query function shaped like `query` below, scoped to one client, so a transaction callback
 *  runs every statement on the same connection instead of a fresh one from the pool. */
export type AskQueryFn = <Row extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[]
) => Promise<QueryResult<Row>>;

/** Runs a parameterized query against the pool for `envVar` (defaults to `DATABASE_URL`).
 *  `params` is required, not optional, so no call site can pass an unparameterized string as safe. */
async function queryOn<Row extends QueryResultRow = QueryResultRow>(
  envVar: string,
  text: string,
  params: unknown[]
): Promise<QueryResult<Row>> {
  return getPool(envVar).query<Row>(text, params);
}

/** Runs `callback` inside one transaction on the pool for `envVar`: begin, callback, commit,
 *  rollback and rethrow on failure. See docs/ask-agent/02-ingest.md for the transaction this serves. */
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

/** The app's own connection (`ask_app` over `DATABASE_URL`). */
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

/** Ingest's connection (`ask_ingest` over `DATABASE_INGEST_URL`). Used only by scripts/ingest.ts;
 *  the running app never imports this. Same shape as `query`, over its own cached pool. */
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
