import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema';

let pool: Pool | null = null;
let db: NodePgDatabase<typeof schema> | null = null;

function readDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Set it in .env.local for local dev and scripts, or in the ' +
        'Vercel project environment variables for deployed and preview environments.',
    );
  }
  return url;
}

/** Lazily built singleton drizzle client over a pg Pool. Throws if DATABASE_URL is absent. */
export function getDb(): NodePgDatabase<typeof schema> {
  if (!db) {
    pool = new Pool({ connectionString: readDatabaseUrl() });
    db = drizzle(pool, { schema });
  }
  return db;
}

/** Closes the pool. Scripts call this to exit; the route never does. */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
  }
  pool = null;
  db = null;
}
