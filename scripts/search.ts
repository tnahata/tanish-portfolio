import { count, eq } from 'drizzle-orm';
import { searchChunks } from '../lib/ask/chunks';
import { db } from '../lib/ask/db';
import { embedQuery } from '../lib/ask/embed';
import { chunks, corpusMeta, documents } from '../lib/ask/schema';
import { loadScriptEnv } from './load-env';

// Must run before any process.env read; standalone scripts get no automatic env loading.
// See scripts/load-env.ts.
loadScriptEnv();

/** Read-only retrieval probe: ranks every chunk by cosine similarity to a question and prints
 *  the numbers used to tune thresholds. Connects as `ask_app`, doubling as a live grant check. */

/** Top-N results printed per question, unless overridden with `--limit`. */
const DEFAULT_LIMIT = 8;

/** Excerpt length is a readability choice for a terminal line, not a retrieval parameter. */
const EXCERPT_LENGTH = 100;

/** Thrown for a usage error: no question given, or a malformed `--limit`. Never reads stdin. */
export class AskSearchArgsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AskSearchArgsError';
  }
}

export interface SearchArgs {
  questions: string[];
  limit: number;
}

const USAGE = 'Usage: npm run ask:search -- "your question" ["another question" ...] [--limit N]';

/** Pure arg parsing (no I/O). `--limit` may appear anywhere among the questions; every other
 *  argument is treated as a question, in order. */
export function parseArgs(argv: string[]): SearchArgs {
  const questions: string[] = [];
  let limit = DEFAULT_LIMIT;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--limit') {
      const raw = argv[i + 1];
      const parsed = raw !== undefined ? Number(raw) : NaN;
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new AskSearchArgsError(
          `--limit requires a positive integer, got ${raw === undefined ? '(nothing)' : `"${raw}"`}. ${USAGE}`
        );
      }
      limit = parsed;
      i++; // consumed the value alongside the flag
      continue;
    }
    questions.push(arg);
  }

  if (questions.length === 0) {
    throw new AskSearchArgsError(USAGE);
  }

  return { questions, limit };
}

export interface SearchResultRow {
  slug: string;
  heading: string | null;
  content: string;
  similarity: number;
}

/** Display concern only: the full `content`, not this excerpt, is what got embedded and retrieved. */
export function excerptFor(content: string): string {
  const collapsed = content.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= EXCERPT_LENGTH) return collapsed;
  return `${collapsed.slice(0, EXCERPT_LENGTH).trimEnd()}...`;
}

const NO_HEADING_PLACEHOLDER = '(no heading)';

/** One printed line per ranked result: similarity (4dp), document slug, heading, excerpt. */
export function formatResultLine(rank: number, row: SearchResultRow): string {
  const heading = row.heading ?? NO_HEADING_PLACEHOLDER;
  return `${String(rank).padStart(2, ' ')}. ${row.similarity.toFixed(4)}  ${row.slug}  ${heading}  "${excerptFor(row.content)}"`;
}

export interface SearchSummary {
  topScore: number;
  distinctDocumentsInTop3: number;
  distinctDocumentsInResults: number;
}

/** Diagnostics for tuning T_STRONG by hand: top score, plus how spread out the results are
 *  across documents. Not a corroboration signal; strong grounding is top-score-only. */
export function computeSummary(results: SearchResultRow[]): SearchSummary {
  const topScore = results[0]?.similarity ?? 0;
  const top3Slugs = new Set(results.slice(0, 3).map((r) => r.slug));
  const allSlugs = new Set(results.map((r) => r.slug));
  return {
    topScore,
    distinctDocumentsInTop3: top3Slugs.size,
    distinctDocumentsInResults: allSlugs.size,
  };
}

interface IndexCounts {
  chunkCount: number;
  documentCount: number;
}

/** One round trip per table, run in parallel; a diagnostic script, so the extra round trip
 *  (vs. one combined query) costs nothing that matters. */
async function fetchIndexCounts(): Promise<IndexCounts> {
  const [[chunkRow], [documentRow]] = await Promise.all([
    db().select({ value: count() }).from(chunks),
    db().select({ value: count() }).from(documents),
  ]);
  return {
    chunkCount: chunkRow?.value ?? 0,
    documentCount: documentRow?.value ?? 0,
  };
}

interface CorpusMetaInfo {
  embedModel: string;
  ingestedAt: Date;
}

/** Null when corpus_meta has no row yet, i.e. `npm run ingest` has never completed successfully. */
async function fetchCorpusMeta(): Promise<CorpusMetaInfo | null> {
  const rows = await db()
    .select({ embedModel: corpusMeta.embedModel, ingestedAt: corpusMeta.ingestedAt })
    .from(corpusMeta)
    .where(eq(corpusMeta.id, 1))
    .limit(1);
  const row = rows[0];
  return row ? { embedModel: row.embedModel, ingestedAt: row.ingestedAt } : null;
}

/** Printed at startup so a stale index (wrong embed_model, old ingested_at) is visible before
 *  spending an OpenAI call against it. */
async function printIndexSummary(): Promise<void> {
  const [counts, meta] = await Promise.all([fetchIndexCounts(), fetchCorpusMeta()]);
  console.log(`Index: ${counts.chunkCount} chunks across ${counts.documentCount} documents.`);
  if (meta) {
    console.log(`corpus_meta: embed_model=${meta.embedModel}, ingested_at=${meta.ingestedAt.toISOString()}`);
  } else {
    console.log('corpus_meta: no row found (id = 1). The index has never been ingested.');
  }
  console.log('');
}

/** Ranks every chunk by pgvector cosine distance to `embedding`, via the same repository query
 *  the request path uses (lib/ask/chunks.ts), so this probe can never silently diverge from it. */
async function runSearch(embedding: number[], limit: number): Promise<SearchResultRow[]> {
  const rows = await searchChunks(embedding, limit);
  return rows.map((row) => ({
    slug: row.slug,
    heading: row.heading,
    content: row.content,
    similarity: row.score,
  }));
}

async function runOneQuestion(question: string, limit: number): Promise<void> {
  console.log(`Q: ${question}`);

  const { embedding } = await embedQuery(question);
  const results = await runSearch(embedding, limit);

  if (results.length === 0) {
    console.log('  (no results: the index has no chunks to rank)');
  } else {
    results.forEach((row, index) => console.log(formatResultLine(index + 1, row)));
  }

  const summary = computeSummary(results);
  console.log('');
  console.log(
    `Top score: ${summary.topScore.toFixed(4)}. ` +
      `Distinct documents in top 3: ${summary.distinctDocumentsInTop3}. ` +
      `Distinct documents in full result set: ${summary.distinctDocumentsInResults}.`
  );
  console.log('');
}

/** Ends only pools this process actually created; checking the cache (not calling `getPool()`)
 *  matters on the no-arguments path, where no pool exists yet and `getPool()` could itself throw. */
async function closeAnyOpenPools(): Promise<void> {
  const cache = globalThis.__askPgPools;
  if (!cache) return;
  await Promise.all(Array.from(cache.values()).map((pool) => pool.end().catch(() => undefined)));
}

async function main(): Promise<void> {
  let args: SearchArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
    return;
  }

  try {
    await printIndexSummary();
    for (const question of args.questions) {
      await runOneQuestion(question, args.limit);
    }
  } finally {
    // Deterministic cleanup, not a race against allowExitOnIdle or a process.exit() workaround.
    await closeAnyOpenPools();
  }
}

// Only run when executed directly; tests import this module without triggering main().
const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
