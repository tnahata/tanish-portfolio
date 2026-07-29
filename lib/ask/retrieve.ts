import { searchChunks } from './chunks';
import { fetchCorpusMeta } from './corpus-meta';
import { embedQuery, EMBED_MODEL, EMBED_DIMENSIONS } from './embed';

/**
 * Retrieval for the ask agent: embeds a question, runs an exact cosine scan over `chunks`,
 * and returns the top-K for lib/ask/ground.ts to grade. See docs/ask-agent/04-retrieval-grounding.md.
 */

/** Chunks taken before grading. Not itself a tuned threshold; just enough rows for the grading
 *  ladder to work with. See docs/ask-agent/04-retrieval-grounding.md. */
const TOP_K = 8;

/** Thrown when `corpus_meta` is missing or disagrees with the running embedding config. See
 *  docs/ask-agent/03-data-model.md for the mismatch this guards against and the 503 it maps to. */
export class AskCorpusMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AskCorpusMismatchError';
  }
}

/** One retrieved chunk, joined with its parent document's citation fields. This is the shape
 * lib/ask/ground.ts grades and lib/ask/ask.ts snapshots into `turns.retrieved`. */
export interface RetrievedChunk {
  slug: string;
  title: string;
  route: string | null;
  heading: string | null;
  content: string;
  /** Cosine similarity in [-1, 1] in principle; in practice these are unit embeddings of
   * natural-language text, so observed scores cluster in roughly [0, 0.6]. */
  score: number;
  /** When true, this chunk's document is quoted verbatim rather than paraphrased by the model.
   * See docs/ask-agent/04-retrieval-grounding.md and lib/ask/ask.ts's verbatim-quote path. */
  verbatimOnly: boolean;
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  /** OpenAI tokens billed for embedding the query text, for `turns.embed_tokens`. */
  embedTokensUsed: number;
}

/** Confirms the running embedding config matches whatever produced the live index. Run on
 *  every call, not cached: cheap, and caching risks a stale answer across a mid-process re-ingest. */
export async function assertCorpusMatchesRunningConfig(): Promise<void> {
  const meta = await fetchCorpusMeta();
  if (!meta) {
    throw new AskCorpusMismatchError(
      'corpus_meta has no row (id = 1): the index has never been ingested successfully. ' +
        'Run npm run ingest before retrieving.'
    );
  }
  if (meta.embedModel !== EMBED_MODEL || meta.embedDims !== EMBED_DIMENSIONS) {
    throw new AskCorpusMismatchError(
      `corpus_meta reports embed_model=${meta.embedModel} embed_dims=${meta.embedDims}, but ` +
        `the running config is embed_model=${EMBED_MODEL} embed_dims=${EMBED_DIMENSIONS}. The ` +
        'grounding thresholds are calibrated against one embedding space; scoring a query ' +
        'vector from a different one is meaningless. Re-ingest, or fix the config drift, ' +
        'before retrieving.'
    );
  }
}

/** Embeds `question` (or `previousQuestion + ' ' + question` for a follow-up to an answered
 *  turn) and returns the top TOP_K chunks by similarity, best first. See docs/ask-agent/04-retrieval-grounding.md. */
export async function retrieve(
  question: string,
  previousQuestion?: string | null
): Promise<RetrievalResult> {
  await assertCorpusMatchesRunningConfig();
  const queryText = previousQuestion ? `${previousQuestion} ${question}` : question;
  const { embedding, tokensUsed } = await embedQuery(queryText);
  const chunks = await searchChunks(embedding, TOP_K);
  return { chunks, embedTokensUsed: tokensUsed };
}
