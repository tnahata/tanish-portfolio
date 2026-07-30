import type { RetrievedChunk } from './retrieve';
import { buildPrompt, type ConversationTurn } from './prompt';
import { streamGeneration, type GenerateStream } from './generate';

// Provisional: measured against the live index at 94 chunks, not yet checked against a filled eval set.
// See docs/ask-agent/02-retrieval.md.
export const T_STRONG = 0.4;
export const T_FLOOR = 0.25;

export type GroundingVerdict = 'strong' | 'weak' | 'none';

const STRONG_GROUNDING_BRAND: unique symbol = Symbol('StrongGrounding');

/**
 * Constructible only by `grade()` below: the brand key is a non-exported `unique symbol`, so no
 * object literal outside this module can satisfy this type without an explicit cast.
 */
export interface StrongGrounding {
  readonly [STRONG_GROUNDING_BRAND]: true;
  readonly chunks: RetrievedChunk[];
  readonly topScore: number;
}

export interface WeakGrounding {
  readonly verdict: 'weak';
  readonly chunks: RetrievedChunk[];
  readonly topScore: number;
  readonly closestSlug: string | null;
  readonly closestTitle: string | null;
}

export interface NoneGrounding {
  readonly verdict: 'none';
  readonly topScore: number;
}

export type GradedGrounding = { verdict: 'strong'; strong: StrongGrounding; topScore: number } | WeakGrounding | NoneGrounding;

/** The ladder. Only `strong` generates; `weak` and `none` are graded but never reach the model. */
export function grade(chunks: RetrievedChunk[]): GradedGrounding {
  const topScore = chunks[0]?.similarity ?? 0;

  if (topScore >= T_STRONG) {
    const strong: StrongGrounding = { [STRONG_GROUNDING_BRAND]: true, chunks, topScore };
    return { verdict: 'strong', strong, topScore };
  }
  if (topScore >= T_FLOOR) {
    const closest = chunks[0] as RetrievedChunk | undefined;
    return { verdict: 'weak', chunks, topScore, closestSlug: closest?.slug ?? null, closestTitle: closest?.title ?? null };
  }
  return { verdict: 'none', topScore };
}

export interface GenerateParams {
  question: string;
  history: ConversationTurn[];
}

/**
 * The only path to a model call. Structurally unreachable without a `StrongGrounding` value, which
 * only `grade()` in this module can construct.
 */
export function generate(strong: StrongGrounding, params: GenerateParams): GenerateStream {
  const prompt = buildPrompt({
    question: params.question,
    history: params.history,
    chunks: strong.chunks.map((chunk) => ({ title: chunk.title, heading: chunk.heading, content: chunk.content })),
  });

  return streamGeneration({
    system: prompt.system,
    messages: prompt.messages,
    unanswerableMarker: prompt.unanswerableMarker,
  });
}
