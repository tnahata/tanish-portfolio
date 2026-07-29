/**
 * Small helpers shared by scripts/db-setup.ts and scripts/db-roles.ts. Both open a one-shot
 * `pg.Client` against DATABASE_ADMIN_URL and have to handle the same two concerns identically: a
 * generous connect timeout for a cold Neon wake, and never letting a secret leak into a thrown
 * error's message. Factored out once so the two scripts cannot drift on either.
 */

/**
 * Generous enough to survive a cold Neon wake, matching the reasoning documented next to
 * `CONNECT_TIMEOUT_MS` in lib/ask/db.ts: Neon scale-to-zero plus a cold start can cost several
 * seconds before the first byte, and these scripts each run once, by hand or in CI, so there is
 * no cost to waiting longer than the app's own request-path budget would allow.
 */
export const ADMIN_CONNECT_TIMEOUT_MS = 10_000;

/**
 * Replaces every occurrence of each non-empty secret with a fixed placeholder. Used defensively
 * on any error message these scripts are about to print: `pg` does not put a password or
 * connection string into its own error messages, but this does not depend on that remaining true.
 */
export function redactSecrets(message: string, secrets: string[]): string {
  return secrets.reduce(
    (redacted, secret) => (secret ? redacted.split(secret).join('[redacted]') : redacted),
    message
  );
}
