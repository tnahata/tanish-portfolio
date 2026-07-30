import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export type AskDatabase = NodePgDatabase<typeof schema>;
type AskTransactionCallback = Parameters<AskDatabase['transaction']>[0];
export type AskExecutor = AskDatabase | Parameters<AskTransactionCallback>[0];

export class AskDatabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AskDatabaseConfigError';
  }
}

const MISSING_DATABASE_URL_MESSAGE =
  'DATABASE_URL is not set in process.env. Either configure it for this environment, or, if this ' +
  'is a standalone script, call loadScriptEnv() (scripts/load-env.ts) before this import runs.';

declare global {
  var __askPgPool: Pool | undefined;
  var __askDb: AskDatabase | undefined;
}

function readDatabaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) throw new AskDatabaseConfigError(MISSING_DATABASE_URL_MESSAGE);
  return value;
}

export function getPool(): Pool {
  if (!globalThis.__askPgPool) {
    globalThis.__askPgPool = new Pool({ connectionString: readDatabaseUrl() });
  }
  return globalThis.__askPgPool;
}

export function getDb(): AskDatabase {
  if (!globalThis.__askDb) {
    globalThis.__askDb = drizzle(getPool(), { schema });
  }
  return globalThis.__askDb;
}
