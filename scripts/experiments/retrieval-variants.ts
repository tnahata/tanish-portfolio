import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { load } from 'js-yaml';
import { z } from 'zod';

import { loadCorpus } from '../../lib/ask/corpus';
import { embedMany } from '../../lib/ask/embed';
import { EMBED_DIMS, EMBED_MODEL, T_FLOOR, T_STRONG, TOP_K } from '../../lib/ask/config';
import { closeDb, getDb } from '../../lib/ask/db';
import { chunks as chunksTable } from '../../lib/ask/schema';
import type { CorpusChunk } from '../../lib/ask/types';
import { loadScriptEnv } from '../load-env';

/**
 * Offline retrieval experiment. Reads the corpus and the live index for a byte-identical
 * before/after check, but every embedding and score in this file is computed in memory: nothing
 * here writes to `chunks`. See scripts/experiments/retrieval-variants.md for the write-up.
 */

const EXPERIMENT_DIR = fileURLToPath(new URL('.', import.meta.url));
const CORPUS_DIR = 'content/corpus';
const QUESTIONS_PATH = 'evals/questions.yaml';

// ---------------------------------------------------------------------------
// Env: the worktree has no .env.local of its own (git worktrees do not share
// untracked files). loadScriptEnv is the sanctioned loader; point it at the
// main repo checkout, found via git, rather than reading the dotenv file
// ourselves.
// ---------------------------------------------------------------------------

function mainRepoRoot(): string {
  const commonGitDir = execSync('git rev-parse --git-common-dir', { encoding: 'utf8' }).trim();
  return dirname(commonGitDir);
}

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

const STRATA = ['injection', 'private', 'off-task', 'unanswerable-fair', 'answerable'] as const;
type Stratum = (typeof STRATA)[number];

const questionSchema = z.object({
  id: z.string(),
  question: z.string(),
  stratum: z.enum(STRATA),
  expect: z.enum(['answer', 'refuse']),
  bypassesFilter: z.boolean().default(false),
});
type QuestionEntry = z.infer<typeof questionSchema>;

function loadQuestions(path: string): QuestionEntry[] {
  const raw = load(readFileSync(path, 'utf8'));
  const parsed = z.array(questionSchema).safeParse(raw);
  if (!parsed.success) throw new Error(`${path} failed schema validation: ${parsed.error.message}`);
  return parsed.data.filter((entry) => entry.question.trim().length > 0);
}

/** Rows this experiment actually retrieves for: injection rows that die in preFilter never
 *  reach retrieval in production and are excluded, except the 5 that bypass the filter. */
function usableForRetrieval(entry: QuestionEntry): boolean {
  return entry.stratum !== 'injection' || entry.bypassesFilter;
}

// ---------------------------------------------------------------------------
// Answering-chunk labels for the 11 answerable rows (read from the corpus by
// hand; NOT written into evals/questions.yaml per the task's constraints).
// Some rows need more than one chunk to fully satisfy their `note` claim.
// ---------------------------------------------------------------------------

const ANSWER_LABELS: Record<string, string[]> = {
  'ans-001': ['identity#name-and-current-role', 'identity#what-he-builds'],
  'ans-002': [
    'project-esmon#the-pdf-threading-deadlock',
    'project-esmon#designing-without-review',
    'disclosure-esmon#two-engineering-problems-worth-naming',
  ],
  'ans-003': ['project-discovery-agent#what-noiseless-is', 'disclosure-discovery-agent#what-is-already-public'],
  'ans-004': ['faq#location-and-remote'],
  'ans-005': ['faq#work-authorisation'],
  'ans-006': ['faq#education'],
  'ans-007': ['project-hybrid-fit#the-n-1-problem-and-caching'],
  'ans-008': ['stack#what-he-has-not-used'],
  'ans-009': ['philosophy#what-he-has-changed-his-mind-about'],
  'unans-002': ['identity#name-and-current-role', 'identity#current-situation', 'experience-fedex#role-and-timeline'],
  'unans-003': ['identity#positioning', 'stack#what-he-has-not-used'],
};

// ---------------------------------------------------------------------------
// Embedding-text variants
// ---------------------------------------------------------------------------

const EMBED_VARIANTS = ['A', 'B', 'C'] as const;
type EmbedVariant = (typeof EMBED_VARIANTS)[number];

const EMBED_VARIANT_LABEL: Record<EmbedVariant, string> = {
  A: 'content only (shipped baseline)',
  B: 'heading + content',
  C: 'title + heading + content',
};

function variantText(variant: EmbedVariant, chunk: CorpusChunk): string {
  const { title, heading } = chunk.metadata;
  if (variant === 'A') return chunk.content;
  if (variant === 'B') return `${heading}\n\n${chunk.content}`;
  return `${title}\n${heading}\n\n${chunk.content}`;
}

// ---------------------------------------------------------------------------
// Dense scoring
// ---------------------------------------------------------------------------

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ---------------------------------------------------------------------------
// Lexical scoring: BM25 over three fields (title, heading, content), indexed
// separately so heading/title can be weighted above body prose. Tokenisation
// is lowercase + split on non-alphanumeric runs; no stopword list, no
// stemming. BM25's idf term already suppresses near-universal tokens, so a
// stopword list buys little at this corpus size and costs inspectability.
// ---------------------------------------------------------------------------

const BM25_K1 = 1.5;
const BM25_B = 0.75;
type Field = 'title' | 'heading' | 'content';
const FIELD_WEIGHTS: Record<Field, number> = { title: 3, heading: 3, content: 1 };

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

interface FieldIndex {
  docTokens: string[][];
  docLen: number[];
  avgLen: number;
  df: Map<string, number>;
  n: number;
}

function buildFieldIndex(texts: string[]): FieldIndex {
  const docTokens = texts.map(tokenize);
  const docLen = docTokens.map((t) => t.length);
  const avgLen = docLen.reduce((a, b) => a + b, 0) / docLen.length;
  const df = new Map<string, number>();
  for (const tokens of docTokens) {
    for (const t of new Set(tokens)) df.set(t, (df.get(t) ?? 0) + 1);
  }
  return { docTokens, docLen, avgLen, df, n: texts.length };
}

function idf(index: FieldIndex, term: string): number {
  const df = index.df.get(term) ?? 0;
  return Math.log(1 + (index.n - df + 0.5) / (df + 0.5));
}

function bm25FieldScore(index: FieldIndex, docIdx: number, queryTokens: string[]): number {
  const tokens = index.docTokens[docIdx];
  const len = index.docLen[docIdx];
  if (tokens.length === 0) return 0;
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  let score = 0;
  for (const qt of queryTokens) {
    const f = tf.get(qt) ?? 0;
    if (f === 0) continue;
    const denom = f + BM25_K1 * (1 - BM25_B + BM25_B * (len / (index.avgLen || 1)));
    score += idf(index, qt) * ((f * (BM25_K1 + 1)) / denom);
  }
  return score;
}

interface LexicalIndex {
  ids: string[];
  fields: Record<Field, FieldIndex>;
}

function buildLexicalIndex(chunkRecords: CorpusChunk[]): LexicalIndex {
  return {
    ids: chunkRecords.map((c) => c.id),
    fields: {
      title: buildFieldIndex(chunkRecords.map((c) => c.metadata.title)),
      heading: buildFieldIndex(chunkRecords.map((c) => c.metadata.heading)),
      content: buildFieldIndex(chunkRecords.map((c) => c.content)),
    },
  };
}

function lexicalScores(index: LexicalIndex, question: string): Map<string, number> {
  const queryTokens = tokenize(question);
  const scores = new Map<string, number>();
  index.ids.forEach((id, docIdx) => {
    let total = 0;
    for (const field of Object.keys(FIELD_WEIGHTS) as Field[]) {
      total += FIELD_WEIGHTS[field] * bm25FieldScore(index.fields[field], docIdx, queryTokens);
    }
    scores.set(id, total);
  });
  return scores;
}

// ---------------------------------------------------------------------------
// Ranking, normalisation, fusion
// ---------------------------------------------------------------------------

interface Scored {
  id: string;
  score: number;
}

function ranked(scores: Map<string, number>, ids: string[]): Scored[] {
  return ids
    .map((id) => ({ id, score: scores.get(id) ?? 0 }))
    .sort((a, b) => b.score - a.score);
}

function rankOf(rankedList: Scored[], id: string): number {
  const index = rankedList.findIndex((c) => c.id === id);
  return index === -1 ? rankedList.length + 1 : index + 1;
}

function minMaxNormalize(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 0.5);
  return values.map((v) => (v - min) / (max - min));
}

const RRF_K = 60;
const FUSION_ALPHA = 0.5;

function fuseRRF(denseRanked: Scored[], lexRanked: Scored[], ids: string[]): Map<string, number> {
  const denseRank = new Map(denseRanked.map((c, i) => [c.id, i + 1]));
  const lexRank = new Map(lexRanked.map((c, i) => [c.id, i + 1]));
  const out = new Map<string, number>();
  for (const id of ids) {
    out.set(id, 1 / (RRF_K + (denseRank.get(id) ?? ids.length + 1)) + 1 / (RRF_K + (lexRank.get(id) ?? ids.length + 1)));
  }
  return out;
}

function fuseWeighted(denseScores: Map<string, number>, lexScores: Map<string, number>, ids: string[]): Map<string, number> {
  const denseVals = minMaxNormalize(ids.map((id) => denseScores.get(id) ?? 0));
  const lexVals = minMaxNormalize(ids.map((id) => lexScores.get(id) ?? 0));
  const out = new Map<string, number>();
  ids.forEach((id, i) => out.set(id, FUSION_ALPHA * denseVals[i] + (1 - FUSION_ALPHA) * lexVals[i]));
  return out;
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

interface LabeledScore {
  score: number;
  label: 0 | 1;
}

function computeAUC(samples: LabeledScore[]): number {
  const nPos = samples.filter((s) => s.label === 1).length;
  const nNeg = samples.filter((s) => s.label === 0).length;
  const sorted = [...samples].sort((a, b) => a.score - b.score);
  const ranks = new Array<number>(sorted.length);
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1].score === sorted[i].score) j += 1;
    const avgRank = (i + 1 + (j + 1)) / 2;
    for (let k = i; k <= j; k += 1) ranks[k] = avgRank;
    i = j + 1;
  }
  let sumRanksPos = 0;
  sorted.forEach((s, k) => {
    if (s.label === 1) sumRanksPos += ranks[k];
  });
  return (sumRanksPos - (nPos * (nPos + 1)) / 2) / (nPos * nNeg);
}

function bestThreshold(samples: LabeledScore[]): { threshold: number; accuracy: number } {
  const uniqueScores = [...new Set(samples.map((s) => s.score))].sort((a, b) => a - b);
  const candidates: number[] = [uniqueScores[0] - 1];
  for (let i = 1; i < uniqueScores.length; i += 1) candidates.push((uniqueScores[i - 1] + uniqueScores[i]) / 2);
  candidates.push(uniqueScores[uniqueScores.length - 1] + 1);

  let best = { threshold: candidates[0], accuracy: -1 };
  for (const t of candidates) {
    const correct = samples.filter((s) => (s.score >= t ? 1 : 0) === s.label).length;
    const accuracy = correct / samples.length;
    if (accuracy > best.accuracy) best = { threshold: t, accuracy };
  }
  return best;
}

// ---------------------------------------------------------------------------
// Live-index verification (read-only)
// ---------------------------------------------------------------------------

interface IndexSnapshot {
  count: number;
  hash: string;
}

async function snapshotChunksTable(): Promise<IndexSnapshot> {
  const db = getDb();
  const rows = await db
    .select({ id: chunksTable.id, metadata: chunksTable.metadata })
    .from(chunksTable)
    .orderBy(chunksTable.id);
  const serialized = rows.map((r) => `${r.id}:${r.metadata.contentHash}`).join('|');
  return { count: rows.length, hash: createHash('sha256').update(serialized).digest('hex') };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

type VariantKey = 'A' | 'B' | 'C' | 'A-RRF' | 'A-Weighted' | 'B-RRF' | 'B-Weighted' | 'C-RRF' | 'C-Weighted';
const ALL_VARIANT_KEYS: VariantKey[] = ['A', 'B', 'C', 'A-RRF', 'A-Weighted', 'B-RRF', 'B-Weighted', 'C-RRF', 'C-Weighted'];

interface QuestionScoreRow {
  chunkId: string;
  score: number;
  rank: number;
}

interface TopKRecord {
  questionId: string;
  question: string;
  stratum: Stratum;
  top: QuestionScoreRow[];
}

async function main(): Promise<void> {
  loadScriptEnv(mainRepoRoot());

  console.log('Snapshotting live chunks table (read-only)...');
  const before = await snapshotChunksTable();
  console.log(`  ${before.count} rows, hash ${before.hash.slice(0, 12)}...`);

  const corpusChunks = loadCorpus(CORPUS_DIR);
  if (corpusChunks.length !== 86) {
    throw new Error(`expected 86 corpus chunks, found ${corpusChunks.length}`);
  }
  const chunkIds = corpusChunks.map((c) => c.id);

  const allQuestions = loadQuestions(QUESTIONS_PATH);
  const usable = allQuestions.filter(usableForRetrieval);
  console.log(`Corpus: ${corpusChunks.length} chunks. Questions usable for retrieval: ${usable.length} of ${allQuestions.length} filled.`);

  // --- Embedding (cached: each variant's corpus and the question set are each embedded once) ---
  let embeddingCalls = 0;
  let embeddingItems = 0;

  const denseVectors: Record<EmbedVariant, Map<string, number[]>> = { A: new Map(), B: new Map(), C: new Map() };
  for (const variant of EMBED_VARIANTS) {
    const texts = corpusChunks.map((c) => variantText(variant, c));
    console.log(`Embedding corpus variant ${variant} (${texts.length} chunks)...`);
    const vectors = await embedMany(texts);
    embeddingCalls += 1;
    embeddingItems += texts.length;
    corpusChunks.forEach((c, i) => denseVectors[variant].set(c.id, vectors[i]));
  }

  console.log(`Embedding ${usable.length} questions...`);
  const questionVectors = new Map<string, number[]>();
  {
    const texts = usable.map((q) => q.question);
    const vectors = await embedMany(texts);
    embeddingCalls += 1;
    embeddingItems += texts.length;
    usable.forEach((q, i) => questionVectors.set(q.id, vectors[i]));
  }

  console.log(`Embedding calls: ${embeddingCalls}. Embedding items: ${embeddingItems}.`);

  // --- Lexical index (variant-independent: built once over title/heading/content) ---
  const lexicalIndex = buildLexicalIndex(corpusChunks);
  const lexicalScoresByQuestion = new Map<string, Map<string, number>>();
  for (const q of usable) {
    lexicalScoresByQuestion.set(q.id, lexicalScores(lexicalIndex, q.question));
  }

  // --- Per-variant, per-question ranked lists ---
  const rankedByVariant: Record<VariantKey, Map<string, Scored[]>> = {
    A: new Map(), B: new Map(), C: new Map(),
    'A-RRF': new Map(), 'A-Weighted': new Map(),
    'B-RRF': new Map(), 'B-Weighted': new Map(),
    'C-RRF': new Map(), 'C-Weighted': new Map(),
  };

  for (const dv of EMBED_VARIANTS) {
    for (const q of usable) {
      const qVec = questionVectors.get(q.id)!;
      const denseScoreMap = new Map<string, number>();
      for (const id of chunkIds) denseScoreMap.set(id, cosineSimilarity(qVec, denseVectors[dv].get(id)!));
      const denseRanked = ranked(denseScoreMap, chunkIds);
      rankedByVariant[dv].set(q.id, denseRanked);

      const lexScoreMap = lexicalScoresByQuestion.get(q.id)!;
      const lexRanked = ranked(lexScoreMap, chunkIds);

      const rrfScores = fuseRRF(denseRanked, lexRanked, chunkIds);
      rankedByVariant[`${dv}-RRF` as VariantKey].set(q.id, ranked(rrfScores, chunkIds));

      const weightedScores = fuseWeighted(denseScoreMap, lexScoreMap, chunkIds);
      rankedByVariant[`${dv}-Weighted` as VariantKey].set(q.id, ranked(weightedScores, chunkIds));
    }
  }

  // --- Top-K raw dump (for the committed JSON) ---
  const topKDump: Record<VariantKey, TopKRecord[]> = {} as Record<VariantKey, TopKRecord[]>;
  for (const vk of ALL_VARIANT_KEYS) {
    topKDump[vk] = usable.map((q) => {
      const rl = rankedByVariant[vk].get(q.id)!;
      return {
        questionId: q.id,
        question: q.question,
        stratum: q.stratum,
        top: rl.slice(0, 10).map((c, i) => ({ chunkId: c.id, score: c.score, rank: i + 1 })),
      };
    });
  }

  // --- Separation (AUC) on answerable vs unanswerable-fair, dense variants first ---
  const answerableIds = new Set(usable.filter((q) => q.stratum === 'answerable').map((q) => q.id));
  const unanswerableFairIds = new Set(usable.filter((q) => q.stratum === 'unanswerable-fair').map((q) => q.id));

  function separationSamples(vk: VariantKey): LabeledScore[] {
    const samples: LabeledScore[] = [];
    for (const q of usable) {
      if (!answerableIds.has(q.id) && !unanswerableFairIds.has(q.id)) continue;
      const top = rankedByVariant[vk].get(q.id)![0];
      samples.push({ score: top.score, label: answerableIds.has(q.id) ? 1 : 0 });
    }
    return samples;
  }

  const auc: Record<VariantKey, { auc: number; bestThreshold: number; bestAccuracy: number; nPos: number; nNeg: number }> =
    {} as Record<VariantKey, { auc: number; bestThreshold: number; bestAccuracy: number; nPos: number; nNeg: number }>;
  for (const vk of ALL_VARIANT_KEYS) {
    const samples = separationSamples(vk);
    const a = computeAUC(samples);
    const bt = bestThreshold(samples);
    auc[vk] = {
      auc: a,
      bestThreshold: bt.threshold,
      bestAccuracy: bt.accuracy,
      nPos: samples.filter((s) => s.label === 1).length,
      nNeg: samples.filter((s) => s.label === 0).length,
    };
    console.log(`AUC[${vk}] = ${a.toFixed(4)}  bestAcc=${bt.accuracy.toFixed(4)} @ t=${bt.threshold.toFixed(4)}`);
  }

  // --- Context recall for the 11 answerable rows ---
  interface ContextRecallRow {
    questionId: string;
    question: string;
    labelChunkIds: string[];
    bestRank: number;
    bestChunkId: string;
    bestScore: number;
    shippedRuleClears: boolean;
    altRuleClears: boolean;
  }

  const contextRecall: Record<VariantKey, ContextRecallRow[]> = {} as Record<VariantKey, ContextRecallRow[]>;
  for (const vk of ALL_VARIANT_KEYS) {
    contextRecall[vk] = Object.entries(ANSWER_LABELS).map(([qid, labelIds]) => {
      const q = usable.find((u) => u.id === qid)!;
      const rl = rankedByVariant[vk].get(qid)!;
      let best = { rank: Infinity, id: '', score: -Infinity };
      for (const id of labelIds) {
        const r = rankOf(rl, id);
        const s = rl.find((c) => c.id === id)!.score;
        if (r < best.rank) best = { rank: r, id, score: s };
      }
      const isDense = vk === 'A' || vk === 'B' || vk === 'C';
      const shippedRuleClears = isDense
        ? best.rank <= TOP_K && best.score >= T_STRONG
        : best.rank <= TOP_K; // fused scales are not comparable to T_STRONG; rank-only proxy
      const altRuleClears = isDense
        ? best.rank <= TOP_K && best.score >= T_FLOOR
        : best.rank <= TOP_K;
      return {
        questionId: qid,
        question: q.question,
        labelChunkIds: labelIds,
        bestRank: best.rank,
        bestChunkId: best.id,
        bestScore: best.score,
        shippedRuleClears,
        altRuleClears,
      };
    });
  }

  // --- Refusal preservation: unanswerable-fair, off-task, private ---
  interface RefusalRow {
    questionId: string;
    question: string;
    stratum: Stratum;
    topScore: number;
    topChunkId: string;
    clearsTStrong: boolean;
  }

  const refusalStrata: Stratum[] = ['unanswerable-fair', 'off-task', 'private'];
  const refusalPreservation: Record<VariantKey, RefusalRow[]> = {} as Record<VariantKey, RefusalRow[]>;
  for (const vk of ALL_VARIANT_KEYS) {
    const isDense = vk === 'A' || vk === 'B' || vk === 'C';
    refusalPreservation[vk] = usable
      .filter((q) => refusalStrata.includes(q.stratum))
      .map((q) => {
        const top = rankedByVariant[vk].get(q.id)![0];
        return {
          questionId: q.id,
          question: q.question,
          stratum: q.stratum,
          topScore: top.score,
          topChunkId: top.id,
          clearsTStrong: isDense ? top.score >= T_STRONG : false, // fused scale: see auc[vk].bestThreshold instead
        };
      });
  }

  // --- Bypass-injection rows (context recall reporting only, not separation) ---
  const bypassInjectionRows: Record<VariantKey, RefusalRow[]> = {} as Record<VariantKey, RefusalRow[]>;
  for (const vk of ALL_VARIANT_KEYS) {
    const isDense = vk === 'A' || vk === 'B' || vk === 'C';
    bypassInjectionRows[vk] = usable
      .filter((q) => q.stratum === 'injection' && q.bypassesFilter)
      .map((q) => {
        const top = rankedByVariant[vk].get(q.id)![0];
        return {
          questionId: q.id,
          question: q.question,
          stratum: q.stratum,
          topScore: top.score,
          topChunkId: top.id,
          clearsTStrong: isDense ? top.score >= T_STRONG : false,
        };
      });
  }

  // --- Threshold sensitivity sweep (dense variants only; T_STRONG is defined on cosine scale) ---
  interface SweepPoint {
    threshold: number;
    answerableRecall: number;
    unanswerableRefusal: number;
  }

  function sweep(vk: EmbedVariant): SweepPoint[] {
    const answerableTop = usable.filter((q) => answerableIds.has(q.id)).map((q) => rankedByVariant[vk].get(q.id)![0].score);
    const unanswerableTop = usable.filter((q) => unanswerableFairIds.has(q.id)).map((q) => rankedByVariant[vk].get(q.id)![0].score);
    const points: SweepPoint[] = [];
    for (let t = 0.1; t <= 0.7 + 1e-9; t += 0.02) {
      const recall = answerableTop.filter((s) => s >= t).length / answerableTop.length;
      const refusal = unanswerableTop.filter((s) => s < t).length / unanswerableTop.length;
      points.push({ threshold: Math.round(t * 1000) / 1000, answerableRecall: recall, unanswerableRefusal: refusal });
    }
    return points;
  }

  const thresholdSweep: Record<EmbedVariant, SweepPoint[]> = {
    A: sweep('A'),
    B: sweep('B'),
    C: sweep('C'),
  };

  // --- Live index verification ---
  console.log('Re-snapshotting live chunks table (read-only) to verify no writes occurred...');
  const after = await snapshotChunksTable();
  const unchanged = before.count === after.count && before.hash === after.hash;
  console.log(`  ${after.count} rows, hash ${after.hash.slice(0, 12)}...  unchanged=${unchanged}`);
  if (!unchanged) {
    throw new Error('Live chunks table changed during this experiment. This must never happen.');
  }

  // --- Write results ---
  const results = {
    meta: {
      generatedAt: new Date().toISOString(),
      corpusChunkCount: corpusChunks.length,
      questionsFilled: allQuestions.length,
      questionsUsedForRetrieval: usable.length,
      embeddingCalls,
      embeddingItems,
      embedModel: EMBED_MODEL,
      embedDims: EMBED_DIMS,
      tStrong: T_STRONG,
      tFloor: T_FLOOR,
      topK: TOP_K,
      embedVariants: EMBED_VARIANT_LABEL,
      bm25: { k1: BM25_K1, b: BM25_B, fieldWeights: FIELD_WEIGHTS, tokenization: 'lowercase, split on [^a-z0-9]+, no stemming, no stopwords' },
      rrfK: RRF_K,
      weightedFusionAlpha: FUSION_ALPHA,
      dbVerification: { before, after, unchanged },
    },
    auc,
    contextRecall,
    refusalPreservation,
    bypassInjectionRows,
    thresholdSweep,
    topKDump,
  };

  mkdirSync(EXPERIMENT_DIR, { recursive: true });
  const outPath = join(EXPERIMENT_DIR, 'retrieval-variants-results.json');
  writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`Results written to ${outPath}`);
}

main()
  .then(() => closeDb())
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    await closeDb();
    process.exitCode = 1;
  });
