import { loadEnvConfig } from '@next/env';

/** Loads local configuration the way `next dev`/`next build` do (standalone scripts get none of
 *  this for free). Call first, before any process.env read; see docs/ask-agent.md. */
export function loadScriptEnv(dir: string = process.cwd(), forceReload = false): void {
  loadEnvConfig(dir, true, console, forceReload);
}
