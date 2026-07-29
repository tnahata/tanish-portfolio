import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import { loadScriptEnv } from './load-env';
import { ADMIN_CONNECT_TIMEOUT_MS, redactSecrets } from './db-shared';

/**
 * Runs before anything else in this module does real work, for the same reason
 * scripts/ingest.ts calls it first: `tsx scripts/db-setup.ts` is plain Node, not `next dev` or
 * `next build`, so without this call none of the variables below are readable from
 * `process.env` even when a developer has them set correctly on disk. See scripts/load-env.ts.
 */
loadScriptEnv();

/**
 * Applies db/schema.sql over DATABASE_ADMIN_URL: creates every ask agent table, or brings an
 * existing database up to date with anything added to that file since it last ran.
 *
 * Role creation, passwords, and grants are a separate concern with their own command,
 * `npm run db:roles` (scripts/db-roles.ts, applying db/roles.sql); this script never touches a
 * role and never touches DATABASE_URL or DATABASE_INGEST_URL, only DATABASE_ADMIN_URL. The two
 * commands can run in either order and are each safe to re-run; see db/roles.sql's "Apply order"
 * section for exactly what each ordering means for the running app and `npm run ingest` in the
 * meantime.
 *
 * Re-runnable: db/schema.sql uses `create table if not exists` throughout, so an already-current
 * database is left untouched.
 *
 * Run with `npm run db:setup`.
 */

const DATABASE_ADMIN_URL_ENV = 'DATABASE_ADMIN_URL';
const SCHEMA_SQL_PATH = path.join(process.cwd(), 'db/schema.sql');

/** The two roles db/roles.sql creates. Checked here only to decide what to print, not applied. */
const ASK_ROLE_NAMES = ['ask_ingest', 'ask_app'] as const;

/** Thrown when required configuration is missing, before any connection is attempted. */
export class AskDbSetupConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AskDbSetupConfigError';
  }
}

export interface SetupConfig {
  adminUrl: string;
}

/**
 * Reads and validates DATABASE_ADMIN_URL. `env` defaults to `process.env` and is a parameter
 * only so tests can exercise the missing-configuration path against a plain object, with no risk
 * of reading (or needing to clear) real process environment state.
 */
export function loadSetupConfig(
  env: Record<string, string | undefined> = process.env
): SetupConfig {
  const adminUrl = env[DATABASE_ADMIN_URL_ENV];
  if (!adminUrl) {
    throw new AskDbSetupConfigError(
      `Missing ${DATABASE_ADMIN_URL_ENV}: not set in this process's environment. db:setup needs ` +
        'the Neon owner connection string (from the Neon project dashboard) to apply ' +
        'db/schema.sql. It is deliberately a different variable from DATABASE_URL and ' +
        'DATABASE_INGEST_URL, which this script does not read. If you have already set it in a ' +
        'local configuration file, note that standalone scripts load configuration explicitly ' +
        'rather than picking it up automatically the way next dev and next build do; confirm ' +
        'that loading step ran before this. Never commit a real connection string.'
    );
  }
  return { adminUrl };
}

/**
 * Names of ASK_ROLE_NAMES entries that do not exist on this database yet. Purely informational:
 * db/schema.sql grants nothing, so this has no effect on what this script does, only on what it
 * tells the developer to run next.
 */
async function findMissingAskRoles(client: Client): Promise<string[]> {
  const result = await client.query<{ rolname: string }>(
    'select rolname from pg_roles where rolname = any($1::text[])',
    [ASK_ROLE_NAMES]
  );
  const present = new Set(result.rows.map((row) => row.rolname));
  return ASK_ROLE_NAMES.filter((name) => !present.has(name));
}

/**
 * Applies db/schema.sql as a single multi-statement query, the same shape `psql -f` uses and the
 * shape the file's own header already documents: Postgres runs the whole file as one implicit
 * transaction, so either every statement lands or none of it does.
 */
async function applySchema(config: SetupConfig): Promise<{ missingRoles: string[] }> {
  const client = new Client({
    connectionString: config.adminUrl,
    connectionTimeoutMillis: ADMIN_CONNECT_TIMEOUT_MS,
  });

  try {
    await client.connect();
    const schemaSql = fs.readFileSync(SCHEMA_SQL_PATH, 'utf-8');
    await client.query(schemaSql);
    const missingRoles = await findMissingAskRoles(client);
    return { missingRoles };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    throw new Error(redactSecrets(raw, [config.adminUrl]));
  } finally {
    // A failed `end()` here would replace the real error above with a secondary connection-
    // teardown error; swallowing it mirrors the same rollback-failure handling in
    // lib/ask/db.ts's withTransaction.
    await client.end().catch(() => undefined);
  }
}

function printSummary(missingRoles: string[]): void {
  console.log('Database setup complete.');
  console.log('');
  console.log(
    '- db/schema.sql applied: corpus_meta, documents, chunks, users, sessions, turns, ' +
      'gap_questions, login_nonces, rate_counters, spend_reservations (create table if not ' +
      'exists; already-existing tables were left untouched).'
  );

  if (missingRoles.length > 0) {
    const verb = missingRoles.length > 1 ? 'do' : 'does';
    console.log('');
    console.log(
      `${missingRoles.join(' and ')} ${verb} not exist yet on this database. Run \`npm run ` +
        'db:roles\` next; it creates them and grants them access to the tables this command just ' +
        'created.'
    );
  }
}

async function main(): Promise<void> {
  const config = loadSetupConfig();
  const { missingRoles } = await applySchema(config);
  printSummary(missingRoles);
}

// Only run when executed directly (`npm run db:setup`), never on import, matching the same guard
// scripts/ingest.ts uses so tests can import this module's exports without triggering a real run.
const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
