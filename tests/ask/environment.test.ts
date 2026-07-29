import { describe, expect, it } from 'vitest';
import {
  AskEnvironmentConfigError,
  checkAskEnvironmentGuard,
  evaluateEnvironmentGuard,
} from '../../lib/ask/environment';

/** Pure-logic tests for the environment guard: no mock needed for evaluateEnvironmentGuard();
 *  checkAskEnvironmentGuard() uses a real Request and monkeypatched process.env. */

describe('evaluateEnvironmentGuard: non-production', () => {
  it('blocks when VERCEL_ENV is undefined, regardless of host', () => {
    expect(evaluateEnvironmentGuard(undefined, 'tanishnahata.com', 'tanishnahata.com')).toBe('block');
  });

  it('blocks when VERCEL_ENV is "preview"', () => {
    expect(evaluateEnvironmentGuard('preview', 'tanishnahata.com', 'tanishnahata.com')).toBe('block');
  });

  it('blocks when VERCEL_ENV is "development"', () => {
    expect(evaluateEnvironmentGuard('development', 'tanishnahata.com', 'tanishnahata.com')).toBe('block');
  });

  it('never consults APEX_HOST outside production: an unset APEX_HOST does not throw', () => {
    expect(() => evaluateEnvironmentGuard('preview', undefined, 'tanishnahata.com')).not.toThrow();
    expect(evaluateEnvironmentGuard('preview', undefined, 'tanishnahata.com')).toBe('block');
  });
});

describe('evaluateEnvironmentGuard: production', () => {
  it('allows when the host matches APEX_HOST exactly', () => {
    expect(evaluateEnvironmentGuard('production', 'tanishnahata.com', 'tanishnahata.com')).toBe('allow');
  });

  it('blocks when the host does not match APEX_HOST (a stale immutable deployment URL)', () => {
    expect(
      evaluateEnvironmentGuard('production', 'tanishnahata.com', 'my-app-git-main-abc123.vercel.app')
    ).toBe('block');
  });

  it('blocks when the request has no Host header at all', () => {
    expect(evaluateEnvironmentGuard('production', 'tanishnahata.com', null)).toBe('block');
  });

  it('throws AskEnvironmentConfigError when APEX_HOST is unset: invalid production configuration fails loudly', () => {
    expect(() => evaluateEnvironmentGuard('production', undefined, 'tanishnahata.com')).toThrow(
      AskEnvironmentConfigError
    );
    expect(() => evaluateEnvironmentGuard('production', undefined, 'tanishnahata.com')).toThrow(/APEX_HOST/);
  });
});

describe('checkAskEnvironmentGuard: reads process.env and the request Host header', () => {
  const originalVercelEnv = process.env.VERCEL_ENV;
  const originalApexHost = process.env.APEX_HOST;

  function restoreEnv(): void {
    if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalVercelEnv;
    if (originalApexHost === undefined) delete process.env.APEX_HOST;
    else process.env.APEX_HOST = originalApexHost;
  }

  it('allows a production request on the apex host', () => {
    process.env.VERCEL_ENV = 'production';
    process.env.APEX_HOST = 'tanishnahata.com';
    try {
      const request = new Request('https://tanishnahata.com/api/ask', {
        method: 'POST',
        headers: { host: 'tanishnahata.com' },
      });
      expect(checkAskEnvironmentGuard(request)).toBe('allow');
    } finally {
      restoreEnv();
    }
  });

  it('blocks a request with no VERCEL_ENV set (local dev)', () => {
    delete process.env.VERCEL_ENV;
    try {
      const request = new Request('http://localhost:3000/api/ask', { method: 'POST' });
      expect(checkAskEnvironmentGuard(request)).toBe('block');
    } finally {
      restoreEnv();
    }
  });
});
