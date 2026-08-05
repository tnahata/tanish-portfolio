import { loadCorpus } from '../../lib/ask/corpus';
import { closeDb } from '../../lib/ask/db';
import { embedMany, embedOne } from '../../lib/ask/embed';
import { loadScriptEnv } from '../load-env';

loadScriptEnv();

const QUESTION = "what are Tanish's values?";
const FILES = ['identity', 'philosophy', 'personal'];
const CORPUS_DIR = 'content/corpus';

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) dot += a[i] * b[i];
  return dot;
}

interface Variant {
  label: string;
  text: (title: string, heading: string, body: string) => string;
}

const VARIANTS: Variant[] = [
  { label: 'title+heading+body (live)', text: (t, h, b) => `${t}\n${h}\n\n${b}` },
  { label: 'heading+body', text: (_t, h, b) => `${h}\n\n${b}` },
  { label: 'body only', text: (_t, _h, b) => b },
];

async function main(): Promise<void> {
  const chunks = loadCorpus(CORPUS_DIR).filter((chunk) => FILES.includes(chunk.metadata.file));
  const questionVector = await embedOne(QUESTION);

  console.log(`\n"${QUESTION}"  ${chunks.length} chunks from ${FILES.join(', ')}\n`);

  const scoresByVariant = new Map<string, Map<string, number>>();
  for (const variant of VARIANTS) {
    const vectors = await embedMany(
      chunks.map((chunk) => variant.text(chunk.metadata.title, chunk.metadata.heading, chunk.content)),
    );
    const scores = new Map<string, number>();
    chunks.forEach((chunk, i) => scores.set(chunk.id, cosine(questionVector, vectors[i])));
    scoresByVariant.set(variant.label, scores);
  }

  for (const variant of VARIANTS) {
    const scores = scoresByVariant.get(variant.label)!;
    const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
    console.log(`--- ${variant.label} ---`);
    ranked.forEach(([id, score], i) => {
      console.log(`  ${String(i + 1).padStart(2)}. ${score.toFixed(4)}  ${score >= 0.4 ? 'IN ' : '   '} ${id}`);
    });
    console.log();
  }

  console.log('--- title text alone, against the question ---');
  const titles = [...new Set(chunks.map((chunk) => chunk.metadata.title))];
  const titleVectors = await embedMany(titles);
  titles.forEach((title, i) => {
    console.log(`  ${cosine(questionVector, titleVectors[i]).toFixed(4)}  "${title}"`);
  });
}

main()
  .then(() => closeDb())
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    await closeDb();
    process.exitCode = 1;
  });
