import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadScriptEnv } from '../../scripts/load-env';

/**
 * Regression test for the bug where `npm run ingest` reported `DATABASE_URL`/`VOYAGE_API_KEY`
 * as missing even when a developer had them set correctly on disk. The root cause: `tsx
 * scripts/ingest.ts` is plain Node, which never reads local configuration files into
 * `process.env` the way `next dev`/`next build` do, so those variables were undefined
 * regardless of what was configured locally.
 *
 * The valuable assertion here is not "loadEnvConfig was called" (a call-count assertion proves
 * nothing about whether the value actually ends up usable); it is that a variable which exists
 * only in a configuration file on disk, and nowhere else, becomes readable via `process.env`
 * after `loadScriptEnv` runs. That is the exact mechanism that was missing. Before this fix
 * existed there was no loader at all, so `process.env.ASK_LOAD_ENV_TEST_PROBE` below would have
 * stayed undefined and this test would fail; `loadScriptEnv` didn't exist as a function to call.
 *
 * Uses a synthetic, throwaway fixture directory outside the repository, with a fabricated
 * variable name and value invented only for this test. This never touches a real configuration
 * file: the fixture directory is created fresh under the OS temp dir and removed afterwards, and
 * the probe variable is not read by any other part of this codebase.
 *
 * The fixture file is named `.env`, not `.env.local`. Vitest sets `NODE_ENV=test`, and
 * `@next/env`'s own precedence logic deliberately excludes `.env.local` whenever `NODE_ENV` is
 * `test` (so local secrets never leak into an automated test run); `.env` is the one file name
 * loaded in every mode, which is what makes it the right choice to prove the loading mechanism
 * itself works, independent of which specific file a real run would pick up.
 */

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
      fs.writeFileSync(path.join(fixtureDir, '.env'), `${PROBE_VAR}=present-from-file\n`);

      // forceReload: true so this test does not depend on whether some other module in this
      // test run already called loadScriptEnv/loadEnvConfig first; @next/env caches its result
      // internally and otherwise returns that cached result unchanged.
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
