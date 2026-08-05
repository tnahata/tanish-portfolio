import { readFileSync } from 'node:fs';

import { load } from 'js-yaml';

import { T_STRONG, TOP_K } from '../../lib/ask/config';
import { loadCorpus } from '../../lib/ask/corpus';
import type { CorpusChunk } from '../../lib/ask/types';
import { embedMany } from '../../lib/ask/embed';
import { loadScriptEnv } from '../load-env';

loadScriptEnv();

const CORPUS_DIR = 'content/corpus';

/** Best answering chunk ids per answerable row, updated to the current corpus headings. */
const ANSWER_LABELS: Record<string, string[]> = {
  'ans-001': ['identity#name-and-current-role', 'identity#what-he-builds'],
  'ans-002': [
    'project-esmon#the-pdf-threading-deadlock',
    'project-esmon#designing-without-review',
    'disclosure-esmon#two-engineering-problems-worth-naming',
  ],
  'ans-003': ['project-discovery-agent#what-noiseless-is', 'disclosure-discovery-agent#what-is-already-public'],
  'ans-004': ['faq#location-and-remote'],
  'ans-005': ['faq#visa-sponsorship'],
  'ans-006': ['faq#education'],
  'ans-007': ['project-hybrid-fit#the-n-1-problem-and-caching'],
  'ans-008': ['stack#what-he-has-not-used'],
  'ans-009': ['philosophy#what-he-has-changed-his-mind-about'],
  'unans-002': ['identity#name-and-current-role', 'identity#current-situation', 'experience-fedex#role-and-timeline'],
  'unans-003': ['identity#positioning', 'stack#what-he-has-not-used'],
};

/**
 * Person-shaped probes for the title-halo failure class. Not in the eval yaml. `wantDoc` is the
 * file whose chunks should carry the answer; for `values` no direct content exists yet, so the
 * fair outcomes are a philosophy-grounded answer or a refusal, never a contact-links context.
 */
const HALO_PROBES: { id: string; question: string; wantDoc: string }[] = [
  { id: 'halo-values', question: "what are Tanish's values?", wantDoc: 'philosophy' },
  { id: 'halo-thinks', question: 'how does Tanish think about engineering?', wantDoc: 'philosophy' },
  { id: 'halo-workwith', question: 'what is Tanish like to work with?', wantDoc: 'personal' },
  { id: 'halo-outside', question: 'what does Tanish do outside of work?', wantDoc: 'personal' },
  { id: 'halo-who', question: 'tell me about Tanish', wantDoc: 'identity' },
];

const VARIANTS = {
  B: (chunk: CorpusChunk) => `${chunk.metadata.heading}\n\n${chunk.content}`,
  C: (chunk: CorpusChunk) => `${chunk.metadata.title}\n${chunk.metadata.heading}\n\n${chunk.content}`,
} as const;
type VariantKey = keyof typeof VARIANTS;

interface EvalRow {
  id: string;
  question: string;
  stratum: string;
}

function loadEvalRows(): EvalRow[] {
  const raw = load(readFileSync('evals/questions.yaml', 'utf-8')) as EvalRow[];
  return raw.filter((row) => row.stratum === 'answerable' || row.stratum === 'unanswerable-fair');
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) dot += a[i] * b[i];
  return dot;
}

/** ROC AUC by rank comparison over every (positive, negative) pair. */
function auc(positives: number[], negatives: number[]): number {
  let wins = 0;
  for (const p of positives) {
    for (const n of negatives) {
      if (p > n) wins += 1;
      else if (p === n) wins += 0.5;
    }
  }
  return wins / (positives.length * negatives.length);
}

interface Ranked {
  id: string;
  score: number;
}

function docOf(chunkId: string): string {
  return chunkId.split('#')[0];
}

async function main(): Promise<void> {
  const chunks = loadCorpus(CORPUS_DIR);
  const evalRows = loadEvalRows();
  const questions = [
    ...evalRows.map((row) => ({ id: row.id, question: row.question, stratum: row.stratum })),
    ...HALO_PROBES.map((probe) => ({ id: probe.id, question: probe.question, stratum: 'halo' })),
  ];

  console.log(`chunks: ${chunks.length} | eval rows: ${evalRows.length} | halo probes: ${HALO_PROBES.length}\n`);

  const questionVectors = await embedMany(questions.map((q) => q.question));

  const rankedByVariant = new Map<VariantKey, Map<string, Ranked[]>>();
  for (const key of Object.keys(VARIANTS) as VariantKey[]) {
    const chunkVectors = await embedMany(chunks.map((chunk) => VARIANTS[key](chunk)));
    const perQuestion = new Map<string, Ranked[]>();
    questions.forEach((q, qi) => {
      const ranked = chunks
        .map((chunk, ci) => ({ id: chunk.id, score: cosine(questionVectors[qi], chunkVectors[ci]) }))
        .sort((a, b) => b.score - a.score);
      perQuestion.set(q.id, ranked);
    });
    rankedByVariant.set(key, perQuestion);
  }

  console.log('== AUC (answerable positives vs unanswerable-fair negatives, top score) ==');
  for (const key of Object.keys(VARIANTS) as VariantKey[]) {
    const ranked = rankedByVariant.get(key)!;
    const positives = evalRows.filter((r) => r.stratum === 'answerable').map((r) => ranked.get(r.id)![0].score);
    const negatives = evalRows.filter((r) => r.stratum === 'unanswerable-fair').map((r) => ranked.get(r.id)![0].score);
    console.log(`  ${key}: AUC ${auc(positives, negatives).toFixed(4)}  (n+ ${positives.length}, n- ${negatives.length})`);
  }

  console.log('\n== Context recall: answering chunk ships (rank <= TOP_K and score >= T_STRONG) ==');
  const shipCounts: Record<VariantKey, number> = { B: 0, C: 0 };
  for (const [qid, labels] of Object.entries(ANSWER_LABELS)) {
    const parts: string[] = [];
    for (const key of Object.keys(VARIANTS) as VariantKey[]) {
      const ranked = rankedByVariant.get(key)!.get(qid)!;
      let best = { rank: Infinity, score: -Infinity, id: '' };
      for (const label of labels) {
        const rank = ranked.findIndex((r) => r.id === label) + 1;
        if (rank === 0) throw new Error(`label ${label} not found for ${qid}`);
        if (rank < best.rank) best = { rank, score: ranked[rank - 1].score, id: label };
      }
      const ships = best.rank <= TOP_K && best.score >= T_STRONG;
      if (ships) shipCounts[key] += 1;
      parts.push(`${key}: ${best.rank}/${best.score.toFixed(3)} ${ships ? 'SHIPS' : 'no   '}`);
    }
    console.log(`  ${qid.padEnd(10)} ${parts.join('   ')}`);
  }
  console.log(`  totals     B: ${shipCounts.B}/11   C: ${shipCounts.C}/11`);

  console.log('\n== Halo probes: gate-clearing context composition per variant ==');
  for (const probe of HALO_PROBES) {
    console.log(`\n  ${probe.id} "${probe.question}" (want: ${probe.wantDoc})`);
    for (const key of Object.keys(VARIANTS) as VariantKey[]) {
      const ranked = rankedByVariant.get(key)!.get(probe.id)!;
      const inContext = ranked.slice(0, TOP_K).filter((r) => r.score >= T_STRONG);
      const byDoc = new Map<string, number>();
      for (const r of inContext) byDoc.set(docOf(r.id), (byDoc.get(docOf(r.id)) ?? 0) + 1);
      const composition = [...byDoc.entries()].map(([doc, n]) => `${doc}:${n}`).join(' ') || 'EMPTY (refuses)';
      const bestWanted = ranked.find((r) => docOf(r.id) === probe.wantDoc)!;
      const wantedRank = ranked.indexOf(bestWanted) + 1;
      console.log(
        `    ${key}: top ${ranked[0].score.toFixed(3)} ${ranked[0].id} | context [${composition}] | best ${probe.wantDoc} chunk rank ${wantedRank} @ ${bestWanted.score.toFixed(3)}`,
      );
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
