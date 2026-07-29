import { describe, expect, it } from 'vitest';
import { AskDbSetupConfigError, loadSetupConfig } from '../../scripts/db-setup';

/**
 * `loadSetupConfig` is the one piece of `scripts/db-setup.ts` that is safe to test without a
 * database: it is a pure function from an environment object to either a config or a thrown
 * error, and never opens a connection. `applySchema` (which actually connects and runs
 * db/schema.sql) is not covered by any test here, for the same reason `applyRoles` in
 * scripts/db-roles.ts is not: exercising it would mean connecting to a real Postgres, which the
 * brief for this work explicitly rules out.
 */

describe('loadSetupConfig', () => {
  it('throws AskDbSetupConfigError naming DATABASE_ADMIN_URL when it is missing', () => {
    expect(() => loadSetupConfig({})).toThrow(AskDbSetupConfigError);
    expect(() => loadSetupConfig({})).toThrow(/DATABASE_ADMIN_URL/);
  });

  it('returns the admin URL unchanged when it is set', () => {
    const env = { DATABASE_ADMIN_URL: 'postgres://owner-fake-host/db' };
    expect(loadSetupConfig(env)).toEqual({ adminUrl: env.DATABASE_ADMIN_URL });
  });

  it('never requires DATABASE_URL, DATABASE_INGEST_URL, or a role password', () => {
    // Only DATABASE_ADMIN_URL is read by this script; role creation and passwords moved to
    // scripts/db-roles.ts. This is the regression test for that split staying split.
    const env = { DATABASE_ADMIN_URL: 'postgres://owner-fake-host/db' };
    expect(() => loadSetupConfig(env)).not.toThrow();
  });
});
