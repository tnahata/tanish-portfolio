import type { RetrievedChunk } from './retrieve';

/** The grounding ladder: classifies a ranked chunk list as `strong`/`weak`/`none`, and is the
 *  only place that can construct a `StrongGrounding` value. See docs/ask-agent/04-retrieval-grounding.md. */

// PROVISIONAL: set by manual probing against the live index, not a labelled eval set (none
// exists yet). See docs/ask-agent/04-retrieval-grounding.md for the numbers behind these.

/** Minimum top-chunk score to generate at all. 0.40: comfortably above the 0.0960 off-task
 *  ceiling, just under the tightest known on-task score, 0.4171. See docs/ask-agent/04-retrieval-grounding.md. */
export const T_STRONG = 0.4;

/** Minimum top-chunk score to be "in the neighborhood" (verdict `weak`, not `none`). 0.25:
 *  well above the 0.0960 off-task ceiling, below the on-task range. See docs/ask-agent/04-retrieval-grounding.md. */
export const T_FLOOR = 0.25;

/** Not exported: a `StrongGrounding` object literal can only be written inside this module,
 *  since nowhere else can name this key. See the module doc above. */
const STRONG_GROUNDING_BRAND: unique symbol = Symbol('ask.StrongGrounding');

/** A grounding verdict of `strong`, carrying the evidence `generate()` is allowed to read.
 *  Structurally unconstructable outside this module; see the module doc above. */
export interface StrongGrounding {
  readonly [STRONG_GROUNDING_BRAND]: true;
  readonly topScore: number;
  readonly chunks: readonly RetrievedChunk[];
}

export type GroundingVerdict = 'strong' | 'weak' | 'none';

export interface StrongGroundingOutcome {
  verdict: 'strong';
  topScore: number;
  chunks: RetrievedChunk[];
  strong: StrongGrounding;
}

export interface WeakGroundingOutcome {
  verdict: 'weak';
  topScore: number;
  chunks: RetrievedChunk[];
  /** The best-scoring chunk, for refusal copy naming the closest source. Null only when chunks
   *  is empty, which weak's own condition (topScore >= T_FLOOR > 0) makes unreachable in practice. */
  closestChunk: RetrievedChunk | null;
}

export interface NoneGroundingOutcome {
  verdict: 'none';
  topScore: number;
  chunks: RetrievedChunk[];
}

export type GroundingOutcome = StrongGroundingOutcome | WeakGroundingOutcome | NoneGroundingOutcome;

/** Grades a ranked chunk list: strong if top >= T_STRONG, weak if top >= T_FLOOR, else none.
 *  `chunks` is assumed pre-ranked descending (`retrieve()`'s guarantee). See docs/ask-agent/04-retrieval-grounding.md. */
export function grade(chunks: RetrievedChunk[]): GroundingOutcome {
  const topScore = chunks[0]?.score ?? 0;

  if (topScore < T_FLOOR) {
    return { verdict: 'none', topScore, chunks };
  }

  if (topScore >= T_STRONG) {
    const strong: StrongGrounding = {
      [STRONG_GROUNDING_BRAND]: true,
      topScore,
      chunks,
    };
    return { verdict: 'strong', topScore, chunks, strong };
  }

  return { verdict: 'weak', topScore, chunks, closestChunk: chunks[0] ?? null };
}
