import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type * as schema from './schema';

/** Lazily built singleton drizzle client over a pg Pool. Throws if DATABASE_URL is absent. */
export function getDb(): NodePgDatabase<typeof schema> {
  throw new Error('not implemented: getDb');
}

/** Closes the pool. Scripts call this to exit; the route never does. */
export function closeDb(): Promise<void> {
  throw new Error('not implemented: closeDb');
}
