// Shared by db-setup.ts and db-roles.ts, both one-shot pg.Client scripts against
// DATABASE_ADMIN_URL, so they cannot drift on connect timeout or secret redaction.

/** Generous enough to survive a cold Neon wake (see CONNECT_TIMEOUT_MS in lib/ask/db.ts); these
 *  scripts run once, by hand or in CI, so waiting longer than the app's own budget costs nothing. */
export const ADMIN_CONNECT_TIMEOUT_MS = 10_000;

/** Defensive: replaces every non-empty secret with a placeholder before an error message is
 *  printed, regardless of whether `pg` itself ever puts one there. */
export function redactSecrets(message: string, secrets: string[]): string {
  return secrets.reduce(
    (redacted, secret) => (secret ? redacted.split(secret).join('[redacted]') : redacted),
    message
  );
}
