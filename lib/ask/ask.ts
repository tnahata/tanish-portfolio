import { retrieve, type RetrievedChunk } from './retrieve';
import { grade, type GroundingVerdict } from './ground';
import { generate } from './generate';
import { ASK_VERSION, type HistoryPair } from './prompt';

/** `askOnce()`: retrieve, grade, generate or refuse. Pure and HTTP-free so evals call it
 *  directly. See docs/ask-agent/04-retrieval-grounding.md for the grounding ladder and taxonomy. */

/** The subset of `turns.outcome` this module's `askOnce()` can produce. */
export type AskOutcome =
  | 'answered'
  | 'refused_no_grounding'
  | 'refused_off_task'
  | 'refused_unanswerable';

/** One entry of `turns.retrieved`'s stored shape: a copy, not a pointer, since ingest destroys
 *  chunk identity every run. See docs/ask-agent/03-data-model.md. */
export interface RetrievedSnapshot {
  slug: string;
  title: string;
  route: string | null;
  score: number;
  excerpt: string;
}

export interface AskOnceResult {
  outcome: AskOutcome;
  grounding: GroundingVerdict;
  /** Generated prose (strong+generate), a verbatim quote (strong+verbatim-only), or null on
   *  refusal. */
  answer: string | null;
  /** True only for a verbatim quote from a `verbatim_only` document; no model call was made. */
  verbatim: boolean;
  topScore: number;
  /** Every retrieved chunk, in `turns.retrieved`'s stored shape. See `RetrievedSnapshot`. */
  retrieved: RetrievedSnapshot[];
  askVersion: string;
  latencyMs: number;
  embedTokens: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface AskOnceParams {
  question: string;
  /** Previous turn's question, passed only when that turn was `answered`. Threaded straight
   *  through to lib/ask/retrieve.ts's `retrieve()`. */
  previousQuestion?: string | null;
  /** Full prior conversation, budgeted and shaped by the caller (lib/ask/history.ts); passed
   *  straight through to `generate()`. */
  history?: HistoryPair[];
}

/** Excerpt length for the stored snapshot only; the full `content` is what was actually scored
 *  and (on the strong path) sent to the model. */
const EXCERPT_LENGTH = 160;

function excerptFor(content: string): string {
  const collapsed = content.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= EXCERPT_LENGTH) return collapsed;
  return `${collapsed.slice(0, EXCERPT_LENGTH).trimEnd()}...`;
}

function snapshotOf(chunks: readonly RetrievedChunk[]): RetrievedSnapshot[] {
  return chunks.map((c) => ({
    slug: c.slug,
    title: c.title,
    route: c.route,
    score: c.score,
    excerpt: excerptFor(c.content),
  }));
}

/** Shared shape for the `none`/`weak` refusal returns: no model call on either path, so token
 *  and cost accounting is zero and `answer` is always null. */
function refusalResult(
  outcome: AskOutcome,
  grounding: GroundingVerdict,
  topScore: number,
  retrieved: RetrievedSnapshot[],
  startedAt: number,
  embedTokens: number
): AskOnceResult {
  return {
    outcome,
    grounding,
    answer: null,
    verbatim: false,
    topScore,
    retrieved,
    askVersion: ASK_VERSION,
    latencyMs: Date.now() - startedAt,
    embedTokens,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
  };
}

/** Retrieve, grade, and either generate, quote verbatim, or refuse. See the module doc above. */
export async function askOnce(params: AskOnceParams): Promise<AskOnceResult> {
  const startedAt = Date.now();
  const { question, previousQuestion = null, history = [] } = params;

  const { chunks, embedTokensUsed } = await retrieve(question, previousQuestion);
  const outcome = grade(chunks);
  const retrieved = snapshotOf(chunks);

  if (outcome.verdict === 'none') {
    return refusalResult('refused_off_task', 'none', outcome.topScore, retrieved, startedAt, embedTokensUsed);
  }

  if (outcome.verdict === 'weak') {
    return refusalResult(
      'refused_no_grounding',
      'weak',
      outcome.topScore,
      retrieved,
      startedAt,
      embedTokensUsed
    );
  }

  // outcome.verdict === 'strong' from here on.
  const topChunk = chunks[0];

  // Verbatim-only documents skip generation entirely: clearance was granted on authored
  // sentences, and paraphrasing would produce new ones nobody cleared.
  if (topChunk?.verbatimOnly) {
    return {
      outcome: 'answered',
      grounding: 'strong',
      answer: topChunk.content,
      verbatim: true,
      topScore: outcome.topScore,
      retrieved,
      askVersion: ASK_VERSION,
      latencyMs: Date.now() - startedAt,
      embedTokens: embedTokensUsed,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    };
  }

  // Exactly one Anthropic request either way: the answerability judgment is folded into this
  // same generate() call, not a second round trip. See lib/ask/generate.ts and lib/ask/prompt.ts.
  const generated = await generate(outcome.strong, question, history);

  if (generated.answer === null) {
    return {
      outcome: 'refused_unanswerable',
      grounding: 'strong',
      answer: null,
      verbatim: false,
      topScore: outcome.topScore,
      retrieved,
      askVersion: ASK_VERSION,
      latencyMs: Date.now() - startedAt,
      embedTokens: embedTokensUsed,
      inputTokens: generated.inputTokens,
      outputTokens: generated.outputTokens,
      costUsd: generated.costUsd,
    };
  }

  return {
    outcome: 'answered',
    grounding: 'strong',
    answer: generated.answer,
    verbatim: false,
    topScore: outcome.topScore,
    retrieved,
    askVersion: ASK_VERSION,
    latencyMs: Date.now() - startedAt,
    embedTokens: embedTokensUsed,
    inputTokens: generated.inputTokens,
    outputTokens: generated.outputTokens,
    costUsd: generated.costUsd,
  };
}
