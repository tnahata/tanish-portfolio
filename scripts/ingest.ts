import { closeDb } from '../lib/ask/db';
import { ingest, type IngestPlan } from '../lib/ask/ingest';
import { loadScriptEnv } from './load-env';

/** CLI: embeds content/corpus and reconciles it into `chunks`. Prints the plan it applied. */

const CORPUS_DIR = 'content/corpus';

function report(plan: IngestPlan): void {
  const changed = plan.insert.length + plan.update.length + plan.deleteIds.length;

  console.log(`inserted: ${plan.insert.length}`);
  console.log(`updated:  ${plan.update.length}`);
  console.log(`deleted:  ${plan.deleteIds.length}`);
  console.log(`unchanged: ${plan.unchanged}`);
  console.log(changed === 0 ? 'no-op: index already matches the corpus' : `applied ${changed} change(s)`);
}

async function main(): Promise<void> {
  loadScriptEnv();
  const plan = await ingest(CORPUS_DIR);
  report(plan);
}

main()
  .then(() => closeDb())
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    await closeDb();
    process.exitCode = 1;
  });
