import { sql } from 'drizzle-orm';

import { closeDb, getDb } from '../lib/ask/db';
import { loadScriptEnv } from './load-env';

loadScriptEnv();

async function main(): Promise<void> {
  const db = getDb();
  const limit = Number(process.argv[2] ?? 16);
  const rows = await db.execute<{
    created_at: string; question: string; locked_reason: string | null; model: string | null;
    answer: string | null; top: string | null;
  }>(sql.raw(`
    select created_at::text, question, locked_reason, model,
           left(coalesce(answer, ''), 200) as answer,
           (select string_agg(format('%s=%s', e->>'id', round((e->>'score')::numeric, 4)), E'\\n     ' order by (e->>'score')::numeric desc)
              from jsonb_array_elements(retrieved) e) as top
    from user_interactions
    order by created_at desc
    limit ${limit}
  `));
  for (const r of rows.rows.reverse()) {
    console.log('\n' + r.created_at.slice(11, 19), '|', r.locked_reason ?? 'ANSWERED', '| model:', r.model ?? 'none');
    console.log('  Q:', r.question.slice(0, 120));
    if (r.answer) console.log('  A:', r.answer);
    if (r.top) console.log('  R:', r.top);
  }
}

main()
  .then(() => closeDb())
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    await closeDb();
    process.exitCode = 1;
  });
