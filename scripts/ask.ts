import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import { prepareTurn, runTurn } from '../lib/ask/ask';
import { closeDb } from '../lib/ask/db';
import type { Identity } from '../lib/ask/types';
import { loadScriptEnv } from './load-env';

/** CLI: runs one question through prepareTurn/runTurn and prints the verdict and streamed answer. */

const ANON_ID_PATH = join(tmpdir(), 'ask-cli-anon-id');

/**
 * runTurn logs the answer in the background after the stream drains, the way the route does; the
 * route never closes its pool, so nothing there waits on that write. This CLI does close its pool,
 * so it gives the write a moment to land first instead of racing it.
 */
const LOG_WRITE_GRACE_MS = 500;

/** Persists one anonymous identity per machine across separate invocations, like a browser cookie. */
function loadOrCreateAnonId(): string {
  if (existsSync(ANON_ID_PATH)) {
    return readFileSync(ANON_ID_PATH, 'utf8').trim();
  }
  const anonId = randomUUID();
  writeFileSync(ANON_ID_PATH, anonId, 'utf8');
  return anonId;
}

function readQuestion(): string {
  const question = process.argv.slice(2).join(' ').trim();
  if (!question) {
    throw new Error('usage: npm run ask -- "<question>"');
  }
  return question;
}

async function printStream(stream: ReadableStream<string>): Promise<void> {
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    process.stdout.write(value);
  }
  process.stdout.write('\n');
}

async function main(): Promise<void> {
  loadScriptEnv();

  const question = readQuestion();
  const identity: Identity = { userId: null, anonId: loadOrCreateAnonId() };

  const prepared = await prepareTurn({ question, identity });

  if (prepared.kind === 'refused') {
    console.log(`refused: ${prepared.reason}`);
    console.log(prepared.text);
    return;
  }

  if (prepared.kind === 'gated') {
    console.log(`gated: ${prepared.gate.reason}`);
    return;
  }

  console.log('ready: streaming answer');
  await printStream(runTurn(prepared));
  await sleep(LOG_WRITE_GRACE_MS);
}

main()
  .then(() => closeDb())
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    await closeDb();
    process.exitCode = 1;
  });
