import { describe, expect, it } from 'vitest';
import {
  AskVerifyRolesConfigError,
  classifyOutcome,
  loadVerifyRolesConfig,
} from '../../scripts/verify-roles';

/** Pure-logic tests for verify-roles.ts: config loading and SQLSTATE classification. `runAssertion`/
 *  `main` are untested here, same as db-roles.ts's applyRoles and db-setup.ts's applySchema. */

const POSTGRES_INSUFFICIENT_PRIVILEGE = '42501';

function pgError(code: string, message: string): Error & { code: string } {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
}

describe('loadVerifyRolesConfig', () => {
  it('throws AskVerifyRolesConfigError naming DATABASE_URL when it is missing', () => {
    expect(() => loadVerifyRolesConfig({})).toThrow(AskVerifyRolesConfigError);
    expect(() => loadVerifyRolesConfig({})).toThrow(/DATABASE_URL/);
  });

  it('throws naming DATABASE_INGEST_URL when only that one is missing', () => {
    const env = { DATABASE_URL: 'postgres://app-fake-host/db' };
    expect(() => loadVerifyRolesConfig(env)).toThrow(/DATABASE_INGEST_URL/);
  });

  it('distinguishes "not set in this process" from a file this process never loaded, and never tells the user to edit a file by name', () => {
    let message = '';
    try {
      loadVerifyRolesConfig({});
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    expect(message).toMatch(/not set in this process's environment/);
    expect(message).toMatch(/standalone scripts load configuration explicitly/);
    // No dotenv-style filename literal anywhere in the message.
    expect(message).not.toMatch(/\.env/);
  });

  it('returns both connection strings unchanged when set', () => {
    const env = {
      DATABASE_URL: 'postgres://app-fake-host/db',
      DATABASE_INGEST_URL: 'postgres://ingest-fake-host/db',
    };
    expect(loadVerifyRolesConfig(env)).toEqual({
      appUrl: env.DATABASE_URL,
      ingestUrl: env.DATABASE_INGEST_URL,
    });
  });
});

describe('classifyOutcome: positive cases (expected to succeed)', () => {
  it('passes when the action succeeded', () => {
    const outcome = classifyOutcome('ask_app can SELECT from documents', 'succeeds', { ok: true });
    expect(outcome).toEqual({ description: 'ask_app can SELECT from documents', passed: true });
  });

  it('fails, with the underlying error in the detail, when a should-succeed action failed', () => {
    const outcome = classifyOutcome('ask_app can SELECT from documents', 'succeeds', {
      ok: false,
      error: pgError(POSTGRES_INSUFFICIENT_PRIVILEGE, 'permission denied for table documents'),
    });
    expect(outcome.passed).toBe(false);
    expect(outcome.detail).toMatch(/expected to succeed but failed/);
    expect(outcome.detail).toMatch(/permission denied for table documents/);
  });
});

describe('classifyOutcome: negative cases (expected to fail with insufficient_privilege)', () => {
  it('passes when the failure is exactly SQLSTATE 42501', () => {
    const outcome = classifyOutcome('ask_app CANNOT UPDATE documents', 'fails-with-insufficient-privilege', {
      ok: false,
      error: pgError(POSTGRES_INSUFFICIENT_PRIVILEGE, 'permission denied for table documents'),
    });
    expect(outcome).toEqual({ description: 'ask_app CANNOT UPDATE documents', passed: true });
  });

  it('fails loudly when the statement unexpectedly succeeded', () => {
    const outcome = classifyOutcome('ask_app CANNOT UPDATE documents', 'fails-with-insufficient-privilege', {
      ok: true,
    });
    expect(outcome.passed).toBe(false);
    expect(outcome.detail).toMatch(/unexpectedly SUCCEEDED/);
  });

  it('fails when the failure happened but was not insufficient_privilege (a different SQLSTATE)', () => {
    // e.g. 42P01 (undefined_table): a real failure, but not proof the grant is missing, so this
    // must not be misclassified as a passing negative assertion.
    const outcome = classifyOutcome('ask_app CANNOT UPDATE documents', 'fails-with-insufficient-privilege', {
      ok: false,
      error: pgError('42P01', 'relation "documents" does not exist'),
    });
    expect(outcome.passed).toBe(false);
    expect(outcome.detail).toMatch(/not with insufficient_privilege/);
    expect(outcome.detail).toMatch(/42P01/);
  });

  it('fails when the failure has no SQLSTATE at all (e.g. a plain JS error, not a pg error)', () => {
    const outcome = classifyOutcome('ask_app CANNOT UPDATE documents', 'fails-with-insufficient-privilege', {
      ok: false,
      error: new Error('connection reset'),
    });
    expect(outcome.passed).toBe(false);
    expect(outcome.detail).toMatch(/not with insufficient_privilege/);
  });

  it('classifies by the error code field, not by string-matching the message', () => {
    // A message that happens to mention "permission" but carries a different SQLSTATE must not
    // pass: classification is strictly by `.code`.
    const outcome = classifyOutcome('probe', 'fails-with-insufficient-privilege', {
      ok: false,
      error: pgError('08006', 'permission-sounding message but this is a connection failure'),
    });
    expect(outcome.passed).toBe(false);
  });
});
