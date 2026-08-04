import type { Grading, RetrievedChunk } from './types';

/** Thrown when chunks.metadata records a different embed model than config declares. */
export class IngestConfigMismatchError extends Error {}

/** Embeds the question and returns the TOP_K nearest chunks by cosine distance, best first. */
export function retrieve(question: string): Promise<RetrievedChunk[]> {
  throw new Error(`not implemented: retrieve(${question.length} chars)`);
}

/**
 * Turns scores into a verdict. The top score decides; the context is every chunk at or above
 * T_STRONG, so a low scorer riding along on a good query never reaches the prompt.
 */
export function grade(chunks: RetrievedChunk[]): Grading {
  throw new Error(`not implemented: grade(${chunks.length} chunks)`);
}
