import { loadScriptEnv } from './load-env';
import { askOnce, type AskResult } from '@/lib/ask/ask';
import type { RetrievedChunk } from '@/lib/ask/retrieve';

loadScriptEnv();

function parseQuestions(argv: string[]): string[] {
  const questions = argv.slice(2);
  if (questions.length === 0) {
    throw new Error('Usage: npm run ask -- "question one" ["question two" ...]');
  }
  return questions;
}

function printChunk(chunk: RetrievedChunk): void {
  const heading = chunk.heading ?? '(no heading)';
  console.log(`  ${chunk.similarity.toFixed(4)}  ${chunk.slug}#${chunk.ordinal}  ${heading}`);
}

function printResult(result: AskResult): void {
  console.log(`verdict: ${result.groundingVerdict ?? 'n/a (filtered before retrieval)'}`);
  console.log(`retrieved (${result.retrievedChunks.length}):`);
  result.retrievedChunks.forEach(printChunk);

  if (result.outcome === 'answered') {
    console.log(`answer: ${result.answer}`);
  } else {
    console.log(`refused (${result.refusalReason}): ${result.refusalText}`);
  }
  console.log(`cost: $${result.costUsd.toFixed(6)}`);
}

async function runQuestion(question: string): Promise<void> {
  console.log(`\n=== ${question} ===`);
  const result = await askOnce(question);
  printResult(result);
}

async function main(): Promise<void> {
  const questions = parseQuestions(process.argv);
  for (const question of questions) {
    await runQuestion(question);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
