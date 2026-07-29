import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AskDbConfigError, db, getPool, ingestDb } from '../../lib/ask/db';

/**
 * getPool/db()/ingestDb() do no I/O until a query runs, so asserting on object identity against
 * a fake connection string is a genuine cache test, not a mock. Regression coverage for a real
 * bug: caching one pool on globalThis meant the second connection string resolved in a process
 * silently reused the first role's pool. The four query/transaction wrappers, thin passthroughs
 * to getPool, are not exercised here; calling one would need a real network connection.
 */

const APP_URL_VAR = 'DATABASE_URL';
const INGEST_URL_VAR = 'DATABASE_INGEST_URL';

const originalAppUrl = process.env[APP_URL_VAR];
const originalIngestUrl = process.env[INGEST_URL_VAR];

function clearPoolCache(): void {
  globalThis.__askPgPools = undefined;
  globalThis.__askDrizzleDbs = undefined;
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

describe('db() / ingestDb(): missing configuration', () => {
  it('throws AskDbConfigError naming DATABASE_URL when db() is called with it unset', () => {
    delete process.env[APP_URL_VAR];

    expect(() => db()).toThrow(AskDbConfigError);
    expect(() => db()).toThrow(/DATABASE_URL/);
    // The lazy, function-shaped export never touches process.env until called, so a failed
    // call must not have left a half-built handle behind for either cache.
    expect(globalThis.__askDrizzleDbs?.has(APP_URL_VAR)).not.toBe(true);
    expect(globalThis.__askPgPools?.has(APP_URL_VAR)).not.toBe(true);
  });

  it('throws AskDbConfigError naming DATABASE_INGEST_URL when ingestDb() is called with it unset', () => {
    delete process.env[INGEST_URL_VAR];

    expect(() => ingestDb()).toThrow(AskDbConfigError);
    expect(() => ingestDb()).toThrow(/DATABASE_INGEST_URL/);
  });
});

describe('db() / ingestDb(): caching per connection-string env var', () => {
  it('returns the same handle object on a second call', () => {
    process.env[APP_URL_VAR] = 'postgres://app-fake-host/db';

    const first = db();
    const second = db();

    expect(second).toBe(first);
  });

  it('creates two independent handles for db() and ingestDb(), not a shared one', () => {
    process.env[APP_URL_VAR] = 'postgres://app-fake-host/app_db';
    process.env[INGEST_URL_VAR] = 'postgres://ingest-fake-host/app_db';

    const appDb = db();
    const ingestDbHandle = ingestDb();

    expect(appDb).not.toBe(ingestDbHandle);
    expect(db()).toBe(appDb);
    expect(ingestDb()).toBe(ingestDbHandle);
  });

  it('wraps the same pool getPool(envVar) would return, not a second connection', () => {
    process.env[APP_URL_VAR] = 'postgres://app-fake-host/db';

    db();

    // db() must reuse getPool's cached pool, not open its own: exactly one pool should exist.
    expect(globalThis.__askPgPools?.size).toBe(1);
    expect(globalThis.__askPgPools?.get(APP_URL_VAR)).toBe(getPool(APP_URL_VAR));
  });
});
