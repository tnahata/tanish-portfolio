/** Environment guard for `/api/ask`: refuse unless `VERCEL_ENV === 'production'` and `Host`
 *  matches `APEX_HOST`. Never `NODE_ENV`. See docs/ask-agent/07-identity-gate.md. */

export class AskEnvironmentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AskEnvironmentConfigError';
  }
}

export const PRODUCTION_VERCEL_ENV = 'production';

export type EnvironmentGuardDecision = 'allow' | 'block';

/** Pure decision function, no `process.env`/`Request` reads, so it's testable with plain
 *  arguments. `checkAskEnvironmentGuard()` below is the thin wrapper reading real values. */
export function evaluateEnvironmentGuard(
  vercelEnv: string | undefined,
  apexHost: string | undefined,
  requestHost: string | null
): EnvironmentGuardDecision {
  if (vercelEnv !== PRODUCTION_VERCEL_ENV) {
    return 'block';
  }
  if (!apexHost) {
    // Missing APEX_HOST in production is invalid config, not "not production yet": throwing
    // keeps it from looking identical, in the logs, to a correctly configured non-prod guard.
    throw new AskEnvironmentConfigError(
      'VERCEL_ENV is "production" but APEX_HOST is not set. Refusing to guess whether this ' +
        'request arrived on the apex domain: set APEX_HOST in the production environment ' +
        '(Vercel project settings) rather than let the guard silently pass or silently block.'
    );
  }
  return requestHost === apexHost ? 'allow' : 'block';
}

/** Reads `VERCEL_ENV`/`APEX_HOST`/the `Host` header and runs them through
 *  `evaluateEnvironmentGuard`; the only place here touching `process.env` or `Request`. */
export function checkAskEnvironmentGuard(request: Request): EnvironmentGuardDecision {
  const vercelEnv = process.env.VERCEL_ENV;
  const apexHost = process.env.APEX_HOST;
  const requestHost = request.headers.get('host');
  return evaluateEnvironmentGuard(vercelEnv, apexHost, requestHost);
}
