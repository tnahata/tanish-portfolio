import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { prepareTurn, runTurn } from '../lib/ask/ask';
import { closeDb } from '../lib/ask/db';
import { refusalCopy } from '../lib/ask/refusals';
import type { Identity } from '../lib/ask/types';
import { loadScriptEnv } from './load-env';

/** CLI: runs one question through prepareTurn/runTurn and prints the verdict and streamed answer. */

const ANON_ID_PATH = join(tmpdir(), 'ask-cli-anon-id');

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
    const { done: finished, value } = await reader.read();
    if (finished) break;
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
  const { stream, outcome, done } = runTurn(prepared);
  outcome.catch(() => {}); // mark handled now; read below for the verdict, independent of done
  done.catch(() => {}); // mark handled now; the await below still sees the rejection
  await printStream(stream);

  const result = await outcome.catch(() => null);
  if (result?.unanswerable) {
    console.log('refused: unanswerable');
    console.log(refusalCopy('unanswerable'));
  }

  try {
    await done;
  } catch (error) {
    console.error(`turn write failed after streaming: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

main()
  .then(() => closeDb())
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    await closeDb();
    process.exitCode = 1;
  });
