/** Shared vocabulary for the ask pipeline. Every other module imports its nouns from here. */

/**
 * Why a turn produced no answer. Null on a turn that did.
 * Persisted to `user_interactions.locked_reason` and sent in the `refusal` stream part.
 */
export type LockedReason =
  | 'injection'
  | 'private'
  | 'sign_in_required'
  | 'rate_limited'
  | 'off_topic'
  | 'no_grounding'
  | 'unanswerable';

/** Grounding strength derived from the top retrieval score. Only `strong` may generate. */
export type Verdict = 'strong' | 'weak' | 'off_topic';

/** What ingest writes about each chunk. `embedModel` and `dims` let retrieval detect a model swap. */
export interface ChunkMetadata {
  file: string;
  heading: string;
  title: string;
  embedModel: string;
  dims: number;
  contentHash: string;
}

/** One `##` section of a corpus file, before embedding. `id` is `${file}#${heading-slug}`. */
export interface CorpusChunk {
  id: string;
  content: string;
  metadata: ChunkMetadata;
}

/** A chunk returned by retrieval, with its cosine similarity to the question. */
export interface RetrievedChunk {
  id: string;
  content: string;
  score: number;
  metadata: ChunkMetadata;
}

declare const strongGroundingBrand: unique symbol;

/**
 * Proof that retrieval cleared `T_STRONG`. Only `grade()` mints one and `generate()` accepts
 * nothing else, so an ungrounded generation does not typecheck.
 */
export interface StrongGrounding {
  readonly [strongGroundingBrand]: true;
  readonly chunks: readonly RetrievedChunk[];
  readonly topScore: number;
}

/** Who is asking. `userId` set when signed in, `anonId` when not; never both. */
export interface Identity {
  userId: string | null;
  anonId: string | null;
}

/** A prior turn on this identity, used to rebuild history server-side. */
export interface PriorTurn {
  question: string;
  answer: string | null;
}

/** The outcome of grading. `strong` carries the brand; the others carry the reason to log. */
export type Grading =
  | { verdict: 'strong'; grounding: StrongGrounding }
  | { verdict: 'weak'; reason: Extract<LockedReason, 'no_grounding'>; chunks: RetrievedChunk[] }
  | { verdict: 'off_topic'; reason: Extract<LockedReason, 'off_topic'>; chunks: RetrievedChunk[] };
