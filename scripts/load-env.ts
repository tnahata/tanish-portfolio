import { loadEnvConfig } from '@next/env';

/**
 * Loads local configuration files the same way `next dev` and `next build` do, before any
 * code in the calling process reads `process.env`.
 *
 * Next.js loads local config files automatically for `next dev`/`next build`, but a standalone
 * script run via `tsx` (or plain `node`) gets none of that: nothing ever reads those files into
 * `process.env`, so variables like `DATABASE_URL` and `OPENAI_API_KEY` are undefined even when
 * a developer has them set correctly on disk. Call this once, as early as possible, from every
 * script in this project that talks to the database or an external API outside of the Next.js
 * request lifecycle. `scripts/ingest.ts` is the only such script today; the eval harness planned
 * in docs/ask-agent/11-evaluation.md will need the same call when it is built, which is why this
 * lives in its own module instead of being copied inline.
 *
 * `@next/env` (not the `dotenv` package, not Node's `--env-file` flag): this resolves variables
 * with the exact file precedence Next itself uses, so a script and the running app never
 * disagree about which file wins. `dev: true` because every caller of this function is a manual
 * or CI dev-time tool, never part of a deployment; it matches the precedence `next dev` uses,
 * which is what a developer running a script locally expects to see.
 *
 * Import-hoisting caveat for callers: this only has to run before the *first* `process.env`
 * read in the process, not before every import. ES module imports are evaluated before any
 * top-level statement in the importing file runs, so a module that reads `process.env` at its
 * own top level would already have run before this function's call site executes, no matter
 * where that call site sits in the file. `lib/ask/db.ts` and `lib/ask/embed.ts` both read
 * `process.env` lazily, inside functions invoked later at runtime, not at import time, so
 * calling this after a script's imports (but before it does any real work) is sufficient today.
 * A future `lib/ask` module that reads configuration at module scope would break that
 * assumption and would need this call moved ahead of its import instead.
 *
 * `dir` and `forceReload` default to production use (the process's actual working directory,
 * loaded once) and exist as parameters only so tests can point this at a fixture directory
 * without depending on call order across a test run; `@next/env` caches its result internally
 * and skips re-reading files unless `forceReload` is set.
 */
export function loadScriptEnv(dir: string = process.cwd(), forceReload = false): void {
  loadEnvConfig(dir, true, console, forceReload);
}
