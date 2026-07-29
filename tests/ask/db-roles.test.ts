import { describe, expect, it } from 'vitest';
import {
  AskDbRolesConfigError,
  buildRoleConnectionUrl,
  generatePassword,
  loadDbRolesConfig,
  resolvePassword,
} from '../../scripts/db-roles';

/** The pure parts of db-roles.ts: password resolution/generation, connection-string construction.
 *  `applyRoles` is untested here; db/roles.sql itself is covered by roles-sql.test.ts. */

// Node's base64url encoding of exactly 32 random bytes is always exactly 43 characters, with no
// padding characters (verified directly against Node's crypto/Buffer implementation, not assumed).
const BASE64URL_LENGTH_FOR_32_BYTES = 43;

describe('loadDbRolesConfig', () => {
  it('throws AskDbRolesConfigError naming DATABASE_ADMIN_URL when it is missing', () => {
    expect(() => loadDbRolesConfig({})).toThrow(AskDbRolesConfigError);
    expect(() => loadDbRolesConfig({})).toThrow(/DATABASE_ADMIN_URL/);
  });

  it('never reads DATABASE_URL or DATABASE_INGEST_URL: only DATABASE_ADMIN_URL is required', () => {
    const env = {
      DATABASE_ADMIN_URL: 'postgres://owner-fake-host/db',
      DATABASE_URL: 'postgres://should-not-be-read/db',
      DATABASE_INGEST_URL: 'postgres://should-not-be-read-either/db',
    };

    const config = loadDbRolesConfig(env);

    expect(config.adminUrl).toBe(env.DATABASE_ADMIN_URL);
  });

  it('resolves each password independently: one from the environment, one generated', () => {
    const env = {
      DATABASE_ADMIN_URL: 'postgres://owner-fake-host/db',
      ASK_INGEST_PASSWORD: 'a-pinned-ingest-password',
      // ASK_APP_PASSWORD deliberately absent.
    };

    const config = loadDbRolesConfig(env);

    expect(config.ingest).toEqual({ password: 'a-pinned-ingest-password', source: 'environment' });
    expect(config.app.source).toBe('generated');
    expect(config.app.password).not.toBe('');
  });
});

describe('resolvePassword', () => {
  it('uses the environment value when set, and reports that source', () => {
    const resolved = resolvePassword('SOME_PASSWORD_VAR', { SOME_PASSWORD_VAR: 'fixed-value' });
    expect(resolved).toEqual({ password: 'fixed-value', source: 'environment' });
  });

  it('generates a password when the environment value is unset, and reports that source', () => {
    const resolved = resolvePassword('SOME_PASSWORD_VAR', {});
    expect(resolved.source).toBe('generated');
    expect(resolved.password.length).toBe(BASE64URL_LENGTH_FOR_32_BYTES);
  });

  it('treats an empty-string environment value the same as unset (still generates)', () => {
    const resolved = resolvePassword('SOME_PASSWORD_VAR', { SOME_PASSWORD_VAR: '' });
    expect(resolved.source).toBe('generated');
  });
});

describe('generatePassword', () => {
  it('produces a URL-safe string with at least 32 bytes of entropy', () => {
    const password = generatePassword();
    expect(password.length).toBe(BASE64URL_LENGTH_FOR_32_BYTES);
    // base64url alphabet only: no '+', '/', or '=' that would need escaping in a URL.
    expect(password).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('never repeats across calls', () => {
    const passwords = new Set(Array.from({ length: 20 }, () => generatePassword()));
    expect(passwords.size).toBe(20);
  });
});

describe('buildRoleConnectionUrl', () => {
  const adminUrl = 'postgresql://owner_role:owner-secret@ep-fake-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require';

  it('substitutes only the username and password, preserving host, database, and query params', () => {
    const result = buildRoleConnectionUrl(adminUrl, 'ask_app', 'app-secret');
    const parsed = new URL(result);

    expect(parsed.username).toBe('ask_app');
    expect(parsed.password).toBe('app-secret');
    expect(parsed.hostname).toBe('ep-fake-pooler.us-east-2.aws.neon.tech');
    expect(parsed.pathname).toBe('/neondb');
    expect(parsed.searchParams.get('sslmode')).toBe('require');
  });

  it('round-trips a password containing URL-reserved characters', () => {
    const trickyPassword = 'p@ss/word#with&reserved=chars';
    const result = buildRoleConnectionUrl(adminUrl, 'ask_ingest', trickyPassword);

    // URL#password returns the percent-encoded form; decoding it proves the value survives unchanged.
    expect(decodeURIComponent(new URL(result).password)).toBe(trickyPassword);
  });

  it('produces a different connection string for each role name, from the same admin URL', () => {
    const ingestUrl = buildRoleConnectionUrl(adminUrl, 'ask_ingest', 'shared-secret');
    const appUrl = buildRoleConnectionUrl(adminUrl, 'ask_app', 'shared-secret');

    expect(ingestUrl).not.toBe(appUrl);
    expect(new URL(ingestUrl).username).toBe('ask_ingest');
    expect(new URL(appUrl).username).toBe('ask_app');
  });
});
