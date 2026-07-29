import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import { loadScriptEnv } from './load-env';
import { ADMIN_CONNECT_TIMEOUT_MS, redactSecrets } from './db-shared';

// Must run before any process.env read; standalone scripts get no automatic env loading.
// See scripts/load-env.ts.
loadScriptEnv();

/** Applies db/schema.sql over DATABASE_ADMIN_URL: creates or updates every ask agent table.
 *  Roles/grants are the separate `npm run db:roles`; both are safe in either order and to re-run. */

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

/** Reads and validates DATABASE_ADMIN_URL. `env` defaults to `process.env`; a parameter only so
 *  tests can exercise the missing-configuration path against a plain object. */
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

/** Purely informational: db/schema.sql grants nothing, so this only affects what the summary
 *  tells the developer to run next. */
async function findMissingAskRoles(client: Client): Promise<string[]> {
  const result = await client.query<{ rolname: string }>(
    'select rolname from pg_roles where rolname = any($1::text[])',
    [ASK_ROLE_NAMES]
  );
  const present = new Set(result.rows.map((row) => row.rolname));
  return ASK_ROLE_NAMES.filter((name) => !present.has(name));
}

/** Applies db/schema.sql as one multi-statement query (same shape `psql -f` uses): Postgres
 *  runs the whole file as one implicit transaction, so either every statement lands or none does. */
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
    // Swallowed so a teardown failure never masks the real error above.
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

// Only run when executed directly; tests import this module without triggering main().
const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
