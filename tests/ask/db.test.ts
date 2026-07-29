import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AskDbConfigError, getPool } from '../../lib/ask/db';

/**
 * `getPool` is the one piece of lib/ask/db.ts that is safe to exercise without a real database:
 * the `pg` `Pool` constructor does no I/O (it only connects lazily, on `.connect()`/`.query()`),
 * so constructing one against a fake, unreachable connection string and asserting on which
 * object comes back is a genuine test of the caching logic, not a mock standing in for one.
 *
 * This is a regression test for the bug the brief called out directly: caching a single `Pool`
 * on `globalThis` (as this module did before it needed to serve two roles, `ask_app` over
 * DATABASE_URL and `ask_ingest` over DATABASE_INGEST_URL) means the second connection string
 * ever resolved in a process would silently reuse the first one's pool, and every query after
 * that point would run as the wrong role. The fix keys the cache by env var name instead of
 * holding one pool; the tests below would fail against the single-pool version (the "two
 * different connection strings" test would see `appPool === ingestPool`).
 *
 * `query`, `withTransaction`, `ingestQuery`, and `ingestWithTransaction` are not exercised here:
 * each is a thin, directly-inspectable wrapper around `getPool(ENV_VAR).query(...)` /
 * `getPool(ENV_VAR).connect()`, and actually calling one would attempt a real network connection
 * to whatever fake connection string is configured, which is not meaningfully testable without a
 * database. `getPool` is where the caching behavior these wrappers depend on actually lives.
 */

const APP_URL_VAR = 'DATABASE_URL';
const INGEST_URL_VAR = 'DATABASE_INGEST_URL';

const originalAppUrl = process.env[APP_URL_VAR];
const originalIngestUrl = process.env[INGEST_URL_VAR];

function clearPoolCache(): void {
  globalThis.__askPgPools = undefined;
}

async function endCachedPools(): Promise<void> {
  const cache = globalThis.__askPgPools;
  if (!cache) return;
  await Promise.all(Array.from(cache.values()).map((pool) => pool.end().catch(() => undefined)));
}

beforeEach(() => {
  clearPoolCache();
});

afterEach(async () => {
  await endCachedPools();
  clearPoolCache();

  if (originalAppUrl === undefined) delete process.env[APP_URL_VAR];
  else process.env[APP_URL_VAR] = originalAppUrl;

  if (originalIngestUrl === undefined) delete process.env[INGEST_URL_VAR];
  else process.env[INGEST_URL_VAR] = originalIngestUrl;
});

describe('getPool: missing configuration', () => {
  it('throws AskDbConfigError naming the missing env var, before creating a pool', () => {
    delete process.env[APP_URL_VAR];

    expect(() => getPool(APP_URL_VAR)).toThrow(AskDbConfigError);
    expect(() => getPool(APP_URL_VAR)).toThrow(/DATABASE_URL/);
    expect(globalThis.__askPgPools?.has(APP_URL_VAR)).not.toBe(true);
  });

  it('names DATABASE_INGEST_URL specifically when that is the one missing', () => {
    delete process.env[INGEST_URL_VAR];

    expect(() => getPool(INGEST_URL_VAR)).toThrow(/DATABASE_INGEST_URL/);
  });
});

describe('getPool: caching per connection-string env var', () => {
  it('returns the same pool object on a second call for the same env var', () => {
    process.env[APP_URL_VAR] = 'postgres://app-fake-host/db';

    const first = getPool(APP_URL_VAR);
    const second = getPool(APP_URL_VAR);

    expect(second).toBe(first);
  });

  it('defaults to DATABASE_URL when no env var name is given', () => {
    process.env[APP_URL_VAR] = 'postgres://app-fake-host/db';

    expect(getPool()).toBe(getPool(APP_URL_VAR));
  });

  it('creates two independent pools for two different connection strings, not a shared one', () => {
    process.env[APP_URL_VAR] = 'postgres://app-fake-host/app_db';
    process.env[INGEST_URL_VAR] = 'postgres://ingest-fake-host/app_db';

    const appPool = getPool(APP_URL_VAR);
    const ingestPool = getPool(INGEST_URL_VAR);

    expect(appPool).not.toBe(ingestPool);
    // And each stays independently cached afterward, not just distinct on first creation.
    expect(getPool(APP_URL_VAR)).toBe(appPool);
    expect(getPool(INGEST_URL_VAR)).toBe(ingestPool);
  });
});
