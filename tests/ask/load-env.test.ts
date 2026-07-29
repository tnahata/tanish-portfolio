import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadScriptEnv } from '../../scripts/load-env';

/** Regression test for scripts/load-env.ts (docs/ask-agent/12-delivery.md): a variable set only
 *  in a config file becomes readable via process.env, using a throwaway fixture dir. */

const PROBE_VAR = 'ASK_LOAD_ENV_TEST_PROBE';

function makeFixtureDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ask-load-env-test-'));
}

afterEach(() => {
  delete process.env[PROBE_VAR];
});

describe('loadScriptEnv', () => {
  it('makes a variable defined only in a configuration file readable via process.env', () => {
    const fixtureDir = makeFixtureDir();
    try {
      expect(process.env[PROBE_VAR]).toBeUndefined();
      // `.env`, not `.env.local`: @next/env excludes `.env.local` whenever NODE_ENV=test (vitest's default).
      fs.writeFileSync(path.join(fixtureDir, '.env'), `${PROBE_VAR}=present-from-file\n`);

      // forceReload bypasses @next/env's internal cache, independent of what ran earlier in this suite.
      loadScriptEnv(fixtureDir, true);

      expect(process.env[PROBE_VAR]).toBe('present-from-file');
    } finally {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });

  it('does not throw when the target directory has no configuration files at all', () => {
    const emptyDir = makeFixtureDir();
    try {
      expect(() => loadScriptEnv(emptyDir, true)).not.toThrow();
      expect(process.env[PROBE_VAR]).toBeUndefined();
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });
});
