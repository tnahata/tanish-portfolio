import { sql } from 'drizzle-orm';

import { closeDb, getDb } from '../lib/ask/db';
import { embedOne } from '../lib/ask/embed';
import { loadScriptEnv } from './load-env';

loadScriptEnv();

async function main(): Promise<void> {
  const question = process.argv.slice(2).join(' ').trim();
  if (!question) throw new Error('usage: rank-probe "<question>"');

  const vector = await embedOne(question);
  const db = getDb();
  const rows = await db.execute<{ id: string; score: number }>(sql.raw(`
    select id, 1 - (embedding <=> '[${vector.join(',')}]'::vector) as score
    from chunks order by embedding <=> '[${vector.join(',')}]'::vector limit 20
  `));

  console.log(`\n"${question}"\n`);
  rows.rows.forEach((r, i) => {
    const gate = r.score >= 0.4 ? 'IN ' : '   ';
    console.log(`${gate}${String(i + 1).padStart(2)}. ${r.score.toFixed(4)}  ${r.id}`);
  });
}

main()
  .then(() => closeDb())
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    await closeDb();
    process.exitCode = 1;
  });
