import fs from 'node:fs';
import path from 'node:path';
import { loadScriptEnv } from './load-env';
import { getPool } from '@/lib/ask/db';

loadScriptEnv();

async function main(): Promise<void> {
  const schemaPath = path.join(process.cwd(), 'db/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  const pool = getPool();
  await pool.query(schemaSql);
  await pool.end();
  console.log(`Applied ${schemaPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
