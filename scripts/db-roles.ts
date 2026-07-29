import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { Client } from 'pg';
import { loadScriptEnv } from './load-env';
import { ADMIN_CONNECT_TIMEOUT_MS, redactSecrets } from './db-shared';

/**
 * Runs before anything else in this module does real work, for the same reason
 * scripts/ingest.ts calls it first: `tsx scripts/db-roles.ts` is plain Node, not `next dev` or
 * `next build`, so without this call none of the variables below are readable from
 * `process.env` even when a developer has them set correctly on disk. See scripts/load-env.ts.
 */
loadScriptEnv();

/**
 * Creates (or converges) the ask_ingest and ask_app roles, their passwords, and their grants,
 * over DATABASE_ADMIN_URL, applying db/roles.sql. Prints the two ready-to-paste connection
 * strings the running app and `npm run ingest` need.
 *
 * This is designed to run *before* `npm run db:setup` creates any table (see db/roles.sql,
 * "Apply order", for the full reasoning): a fresh database has no tables for a `grant ... on
 * <table>` to name, so db/roles.sql leans on `alter default privileges` for a baseline that
 * makes each table usable the instant db/schema.sql creates it, and this script always checks
 * whether the corpus tables exist yet so it can tell you, in its own output, whether that
 * baseline is all that got applied or whether the exact per-table grant matrix did. Both apply
 * orders (roles first, or schema first) are safe; re-running this command is always safe, and is
 * how a password rotation ships.
 *
 * Run with `npm run db:roles`.
 */

const DATABASE_ADMIN_URL_ENV = 'DATABASE_ADMIN_URL';
const ASK_INGEST_PASSWORD_ENV = 'ASK_INGEST_PASSWORD';
const ASK_APP_PASSWORD_ENV = 'ASK_APP_PASSWORD';

const ASK_INGEST_ROLE = 'ask_ingest';
const ASK_APP_ROLE = 'ask_app';

const ROLES_SQL_PATH = path.join(process.cwd(), 'db/roles.sql');

/** 32 bytes (256 bits) of CSPRNG output, base64url-encoded: URL-safe with no padding to escape. */
const PASSWORD_BYTES = 32;

/** Thrown when required configuration is missing, before any connection is attempted. */
export class AskDbRolesConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AskDbRolesConfigError';
  }
}

export type PasswordSource = 'environment' | 'generated';

export interface ResolvedPassword {
  password: string;
  source: PasswordSource;
}

export interface DbRolesConfig {
  adminUrl: string;
  ingest: ResolvedPassword;
  app: ResolvedPassword;
}

/** A fresh, random, URL-safe password. Never derived from anything guessable. */
export function generatePassword(): string {
  return randomBytes(PASSWORD_BYTES).toString('base64url');
}

/**
 * Reproducible reruns: if a password is already set in the environment, this uses it (and a run
 * with the same environment twice rotates the role to the same password, a no-op in effect).
 * Otherwise it generates a fresh one, so nobody has to invent a password by hand.
 */
export function resolvePassword(
  envVarName: string,
  env: Record<string, string | undefined>
): ResolvedPassword {
  const fromEnv = env[envVarName];
  if (fromEnv) {
    return { password: fromEnv, source: 'environment' };
  }
  return { password: generatePassword(), source: 'generated' };
}

/**
 * Reads DATABASE_ADMIN_URL and resolves both role passwords. `env` defaults to `process.env` and
 * is a parameter only so tests can exercise this against a plain object, with no risk of reading
 * (or needing to clear) real process environment state, and no real randomness required to
 * assert on the "read from environment" path.
 */
export function loadDbRolesConfig(
  env: Record<string, string | undefined> = process.env
): DbRolesConfig {
  const adminUrl = env[DATABASE_ADMIN_URL_ENV];
  if (!adminUrl) {
    throw new AskDbRolesConfigError(
      `Missing ${DATABASE_ADMIN_URL_ENV}: not set in this process's environment. db:roles needs ` +
        'the Neon owner connection string (from the Neon project dashboard) to create ask_ingest ' +
        'and ask_app. It is deliberately a different variable from DATABASE_URL and ' +
        'DATABASE_INGEST_URL: this script does not read either of those, it prints them for you ' +
        'instead, once it has run. If you have already set DATABASE_ADMIN_URL in a local ' +
        'configuration file, note that standalone scripts load configuration explicitly rather ' +
        'than picking it up automatically the way next dev and next build do; confirm that ' +
        'loading step ran before this. Never commit a real connection string.'
    );
  }

  return {
    adminUrl,
    ingest: resolvePassword(ASK_INGEST_PASSWORD_ENV, env),
    app: resolvePassword(ASK_APP_PASSWORD_ENV, env),
  };
}

/**
 * Builds a connection string for `roleName` by copying `adminUrl` and substituting only the
 * username and password. `new URL()` parses and re-serializes the host, port, database (the
 * pathname), and every query parameter (sslmode, Neon's pooler host if the admin URL already
 * routes through one) unchanged; only `.username` and `.password` are overwritten before
 * `.toString()` re-encodes the whole thing.
 */
export function buildRoleConnectionUrl(adminUrl: string, roleName: string, password: string): string {
  const url = new URL(adminUrl);
  url.username = roleName;
  url.password = password;
  return url.toString();
}

export interface ApplyRolesResult {
  /** Whether the corpus tables already existed when this run started (see db/roles.sql). */
  tablesExistedBefore: boolean;
}

/** True once `public.documents` resolves, the same signal scripts/ingest.ts's preflight uses. */
async function checkCorpusTablesExist(client: Client): Promise<boolean> {
  const result = await client.query<{ reg: string | null }>("select to_regclass('public.documents') as reg");
  return (result.rows[0]?.reg ?? null) !== null;
}

/**
 * Applies db/roles.sql over one connection (never a pool: the password GUCs it reads back with
 * `current_setting` are session-scoped, so this has to be the same session throughout). See
 * db/roles.sql's header for the full explanation of the `set_config` indirection this relies on.
 */
async function applyRoles(config: DbRolesConfig): Promise<ApplyRolesResult> {
  const client = new Client({
    connectionString: config.adminUrl,
    connectionTimeoutMillis: ADMIN_CONNECT_TIMEOUT_MS,
  });

  try {
    await client.connect();
    const tablesExistedBefore = await checkCorpusTablesExist(client);

    await client.query('select set_config($1, $2, false)', ['ask.ingest_password', config.ingest.password]);
    await client.query('select set_config($1, $2, false)', ['ask.app_password', config.app.password]);

    const rolesSql = fs.readFileSync(ROLES_SQL_PATH, 'utf-8');
    await client.query(rolesSql);

    return { tablesExistedBefore };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    throw new Error(redactSecrets(raw, [config.adminUrl, config.ingest.password, config.app.password]));
  } finally {
    // A failed `end()` here would replace the real error above with a secondary connection-
    // teardown error; swallowing it mirrors the same rollback-failure handling in
    // lib/ask/db.ts's withTransaction.
    await client.end().catch(() => undefined);
  }
}

function describePasswordSource(source: PasswordSource, envVarName: string): string {
  return source === 'environment'
    ? `read from ${envVarName} (rotated the role to that value)`
    : `freshly generated (${envVarName} was not set)`;
}

/**
 * Never prints DATABASE_ADMIN_URL, and never prints a password on its own line: the only two
 * places a password appears below are inside the two constructed connection strings, which the
 * user explicitly asked this command to print (there is no other way to hand over a generated
 * password). Everything else about DATABASE_ADMIN_URL, including its own password, stays out of
 * this output entirely.
 */
function printSummary(config: DbRolesConfig, result: ApplyRolesResult): void {
  console.log('Role setup complete.');
  console.log('');
  console.log(`- ask_ingest password: ${describePasswordSource(config.ingest.source, ASK_INGEST_PASSWORD_ENV)}.`);
  console.log(`- ask_app password: ${describePasswordSource(config.app.source, ASK_APP_PASSWORD_ENV)}.`);
  console.log('');

  if (result.tablesExistedBefore) {
    console.log(
      'The corpus tables already existed, so the exact per-table grant matrix in db/roles.sql ' +
        'was applied directly: ask_ingest and ask_app now hold exactly the privileges documented ' +
        'there, nothing broader.'
    );
  } else {
    console.log(
      'No tables exist on this database yet, so only the default-privilege baseline in ' +
        'db/roles.sql could be applied (ask_ingest: full CRUD by default; ask_app: SELECT and ' +
        'INSERT by default, which is broader than intended on a corpus_meta-shaped table until ' +
        'the next step). Run `npm run db:setup` next to create the tables, then run `npm run ' +
        'db:roles` a second time so the exact per-table grants land on top of this baseline.'
    );
  }

  console.log('');
  console.log(
    'Connection strings below are derived from DATABASE_ADMIN_URL by swapping only the role name ' +
      'and password; host, database, and every query parameter (sslmode, a pooler host if ' +
      'DATABASE_ADMIN_URL already routes through one) are unchanged. Each prints once: a ' +
      'generated password cannot be recovered later, only rotated by running this command again. ' +
      'Copy these into your environment now.'
  );
  console.log('');
  console.log(`DATABASE_INGEST_URL=${buildRoleConnectionUrl(config.adminUrl, ASK_INGEST_ROLE, config.ingest.password)}`);
  console.log(`DATABASE_URL=${buildRoleConnectionUrl(config.adminUrl, ASK_APP_ROLE, config.app.password)}`);
}

async function main(): Promise<void> {
  const config = loadDbRolesConfig();
  const result = await applyRoles(config);
  printSummary(config, result);
}

// Only run when executed directly (`npm run db:roles`), never on import, matching the same guard
// scripts/ingest.ts uses so tests can import this module's exports without triggering a real run.
const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
