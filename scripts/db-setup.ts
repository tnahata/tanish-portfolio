import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { sql } from 'drizzle-orm';

import { closeDb, getDb } from '../lib/ask/db';
import { loadScriptEnv } from './load-env';

/** Applies db/schema.sql to DATABASE_URL. Idempotent; safe against an existing database. */

type Database = ReturnType<typeof getDb>;

const LEGACY_TABLES = ['documents', 'chunks', 'users', 'ask_events'] as const;
const CHUNKS_EXPECTED_COLUMNS = ['id', 'content', 'metadata', 'embedding'];
const NEW_TABLES = ['chunks', 'user_interactions'] as const;
const NEW_INDEXES = ['user_interactions_user_created_idx', 'user_interactions_anon_created_idx'] as const;

const schemaSqlPath = fileURLToPath(new URL('../db/schema.sql', import.meta.url));

function sameColumns(actual: string[], expected: string[]): boolean {
  const a = [...actual].sort();
  const e = [...expected].sort();
  return a.length === e.length && a.every((column, i) => column === e[i]);
}

/** Columns of any of the four legacy tables that still exist, keyed by table name. */
async function findLegacyTableColumns(database: Database): Promise<Map<string, string[]>> {
  const tableList = LEGACY_TABLES.map((name) => `'${name}'`).join(', ');
  const result = await database.execute<{ table_name: string; column_name: string }>(
    sql.raw(
      `select table_name, column_name from information_schema.columns
       where table_schema = 'public' and table_name in (${tableList})
       order by table_name, ordinal_position`,
    ),
  );
  const byTable = new Map<string, string[]>();
  for (const row of result.rows) {
    const columns = byTable.get(row.table_name) ?? [];
    columns.push(row.column_name);
    byTable.set(row.table_name, columns);
  }
  return byTable;
}

/** Destructive: drops all four tables from the previous schema, and everything in them. */
async function dropLegacyTables(database: Database, existing: Map<string, string[]>): Promise<void> {
  console.log(
    '--drop-existing: dropping documents, chunks, users, and ask_events (and everything in ' +
      'them) before applying the schema.',
  );
  for (const table of LEGACY_TABLES) {
    await database.execute(sql.raw(`drop table if exists ${table} cascade`));
    console.log(existing.has(table) ? `  dropped ${table}` : `  ${table}: did not exist`);
  }
}

function reportMismatchedLegacyTables(existing: Map<string, string[]>): void {
  for (const table of LEGACY_TABLES) {
    const columns = existing.get(table);
    if (!columns) continue;
    if (table === 'chunks' && sameColumns(columns, CHUNKS_EXPECTED_COLUMNS)) continue;
    console.warn(
      `pre-existing table "${table}" found [${columns.join(', ')}]; the new schema does not ` +
        're-create it, so it was left as is. Re-run with --drop-existing to replace it.',
    );
  }
}

async function applySchema(database: Database): Promise<void> {
  const schemaSql = await readFile(schemaSqlPath, 'utf8');
  await database.execute(sql.raw(schemaSql));
}

interface VerifyResult {
  extension: boolean;
  tables: string[];
  indexes: string[];
}

async function verifySchema(database: Database): Promise<VerifyResult> {
  const tableList = NEW_TABLES.map((name) => `'${name}'`).join(', ');
  const indexList = NEW_INDEXES.map((name) => `'${name}'`).join(', ');

  const extensionResult = await database.execute<{ extname: string }>(
    sql`select extname from pg_extension where extname = 'vector'`,
  );
  const tablesResult = await database.execute<{ table_name: string }>(
    sql.raw(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_name in (${tableList})
       order by table_name`,
    ),
  );
  const indexesResult = await database.execute<{ indexname: string }>(
    sql.raw(
      `select indexname from pg_indexes
       where schemaname = 'public' and indexname in (${indexList})
       order by indexname`,
    ),
  );

  return {
    extension: extensionResult.rows.length > 0,
    tables: tablesResult.rows.map((row) => row.table_name),
    indexes: indexesResult.rows.map((row) => row.indexname),
  };
}

async function main(): Promise<void> {
  loadScriptEnv();

  const dropExisting = process.argv.includes('--drop-existing');
  const database = getDb();
  const legacyTables = await findLegacyTableColumns(database);

  if (dropExisting) {
    await dropLegacyTables(database, legacyTables);
  } else {
    reportMismatchedLegacyTables(legacyTables);
  }

  await applySchema(database);
  console.log('Applied db/schema.sql.');

  const result = await verifySchema(database);
  console.log(`vector extension: ${result.extension ? 'present' : 'MISSING'}`);
  console.log(`tables: ${result.tables.join(', ') || 'none'}`);
  console.log(`indexes: ${result.indexes.join(', ') || 'none'}`);

  if (
    !result.extension ||
    result.tables.length !== NEW_TABLES.length ||
    result.indexes.length !== NEW_INDEXES.length
  ) {
    throw new Error('Schema verification failed after applying db/schema.sql; see the output above.');
  }
}

main()
  .then(() => closeDb())
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    await closeDb();
    process.exitCode = 1;
  });
