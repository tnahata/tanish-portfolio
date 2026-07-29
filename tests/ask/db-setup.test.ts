import { describe, expect, it } from 'vitest';
import { AskDbSetupConfigError, loadSetupConfig } from '../../scripts/db-setup';

/** loadSetupConfig is the pure part of db-setup.ts (env object in, config or thrown error out).
 *  applySchema (opens a real connection) is untested here, same as db-roles.ts's applyRoles. */

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
