import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chainMock } from './drizzle-mock';

/** Behavioural tests for lib/ask/session.ts; database access mocked at the `./db` boundary
 *  (`db()`, Drizzle-shaped). */

const dbMock = vi.fn();

vi.mock('../../lib/ask/db', () => ({
  db: (...args: unknown[]) => dbMock(...args),
}));

import {
  ASK_SESSION_COOKIE,
  AskSessionConfigError,
  buildSessionCookie,
  extractClientIp,
  hashIp,
  isWellFormedSessionId,
  readSessionCookie,
  resolveSession,
} from '../../lib/ask/session';
import { sessions } from '../../lib/ask/schema';

beforeEach(() => {
  dbMock.mockReset();
});

describe('isWellFormedSessionId / readSessionCookie', () => {
  it('accepts a well-formed UUID', () => {
    expect(isWellFormedSessionId('3fa85f64-5717-4562-b3fc-2c963f66afa6')).toBe(true);
  });

  it('rejects a non-UUID string', () => {
    expect(isWellFormedSessionId('not-a-uuid')).toBe(false);
    expect(isWellFormedSessionId('')).toBe(false);
  });

  it('reads the session cookie out of a Cookie header', () => {
    const id = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
    expect(readSessionCookie(`other=1; ${ASK_SESSION_COOKIE}=${id}; another=2`)).toBe(id);
  });

  it('returns null when the cookie is absent', () => {
    expect(readSessionCookie('other=1; another=2')).toBeNull();
    expect(readSessionCookie(null)).toBeNull();
  });

  it('returns null when the cookie value is malformed (forged or corrupted)', () => {
    expect(readSessionCookie(`${ASK_SESSION_COOKIE}=not-a-uuid; other=1`)).toBeNull();
  });
});

describe('buildSessionCookie', () => {
  it('marks the cookie HttpOnly, SameSite=Lax, and Secure over HTTPS', () => {
    const cookie = buildSessionCookie('3fa85f64-5717-4562-b3fc-2c963f66afa6', true);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('Path=/');
  });

  it('omits Secure over plain HTTP, so local next dev can still read the cookie back', () => {
    const cookie = buildSessionCookie('3fa85f64-5717-4562-b3fc-2c963f66afa6', false);
    expect(cookie).not.toContain('Secure');
  });
});

describe('extractClientIp', () => {
  it('uses the first entry of X-Forwarded-For', () => {
    const request = new Request('https://tanishnahata.com/api/ask', {
      headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
    });
    expect(extractClientIp(request)).toBe('203.0.113.5');
  });

  it('falls back to X-Real-Ip when X-Forwarded-For is absent', () => {
    const request = new Request('https://tanishnahata.com/api/ask', {
      headers: { 'x-real-ip': '203.0.113.9' },
    });
    expect(extractClientIp(request)).toBe('203.0.113.9');
  });

  it('falls back to a fixed placeholder when neither header is present (local next dev)', () => {
    const request = new Request('http://localhost:3000/api/ask');
    expect(extractClientIp(request)).toBe('local-dev');
  });
});

describe('hashIp', () => {
  const originalSeed = process.env.IP_HASH_SALT_SEED;

  afterEach(() => {
    if (originalSeed === undefined) delete process.env.IP_HASH_SALT_SEED;
    else process.env.IP_HASH_SALT_SEED = originalSeed;
  });

  it('throws AskSessionConfigError when IP_HASH_SALT_SEED is unset', () => {
    delete process.env.IP_HASH_SALT_SEED;
    expect(() => hashIp('203.0.113.5')).toThrow(AskSessionConfigError);
    expect(() => hashIp('203.0.113.5')).toThrow(/IP_HASH_SALT_SEED/);
  });

  it('is deterministic for the same IP and the same UTC day', () => {
    process.env.IP_HASH_SALT_SEED = 'test-seed';
    const now = new Date('2026-07-29T12:00:00.000Z');
    expect(hashIp('203.0.113.5', now)).toBe(hashIp('203.0.113.5', now));
  });

  it('never returns the raw IP itself', () => {
    process.env.IP_HASH_SALT_SEED = 'test-seed';
    const now = new Date('2026-07-29T12:00:00.000Z');
    expect(hashIp('203.0.113.5', now)).not.toBe('203.0.113.5');
  });

  it('produces a different hash for a different UTC day (daily rotation)', () => {
    process.env.IP_HASH_SALT_SEED = 'test-seed';
    const day1 = new Date('2026-07-29T23:59:59.000Z');
    const day2 = new Date('2026-07-30T00:00:01.000Z');
    expect(hashIp('203.0.113.5', day1)).not.toBe(hashIp('203.0.113.5', day2));
  });

  it('produces a different hash for a different IP on the same day', () => {
    process.env.IP_HASH_SALT_SEED = 'test-seed';
    const now = new Date('2026-07-29T12:00:00.000Z');
    expect(hashIp('203.0.113.5', now)).not.toBe(hashIp('203.0.113.6', now));
  });
});

describe('resolveSession', () => {
  it('resumes an existing session and touches last_seen_at, without inserting a new row', async () => {
    const existingId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
    const selectChain = chainMock([{ id: existingId }]);
    const updateChain = chainMock(undefined);
    dbMock.mockReturnValueOnce(selectChain).mockReturnValueOnce(updateChain);

    const result = await resolveSession(existingId, 'iphash', {
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
    });

    expect(result).toEqual({ id: existingId, isNew: false });
    expect(dbMock).toHaveBeenCalledTimes(2);
    expect(selectChain.from).toHaveBeenCalledWith(sessions);
    expect(updateChain.update).toHaveBeenCalledWith(sessions);
    expect(updateChain.set).toHaveBeenCalledTimes(1);
  });

  it('creates a new session when no cookie is present', async () => {
    const insertChain = chainMock(undefined);
    dbMock.mockReturnValueOnce(insertChain);

    const result = await resolveSession(null, 'iphash', {
      utmSource: 'linkedin',
      utmMedium: 'social',
      utmCampaign: 'portfolio',
    });

    expect(result.isNew).toBe(true);
    expect(isWellFormedSessionId(result.id)).toBe(true);
    expect(dbMock).toHaveBeenCalledTimes(1);
    expect(insertChain.insert).toHaveBeenCalledWith(sessions);
    expect(insertChain.values).toHaveBeenCalledWith({
      id: result.id,
      ipHash: 'iphash',
      utmSource: 'linkedin',
      utmMedium: 'social',
      utmCampaign: 'portfolio',
    });
  });

  it('creates a new session when the cookie names a session that no longer exists', async () => {
    const staleId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
    const selectChain = chainMock([]); // select finds nothing
    const insertChain = chainMock(undefined);
    dbMock.mockReturnValueOnce(selectChain).mockReturnValueOnce(insertChain);

    const result = await resolveSession(staleId, 'iphash', {
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
    });

    expect(result.isNew).toBe(true);
    expect(result.id).not.toBe(staleId);
    // One select (miss) plus one insert; never an update against a session that was not found.
    expect(dbMock).toHaveBeenCalledTimes(2);
    expect(insertChain.insert).toHaveBeenCalledWith(sessions);
  });
});
