/** Thrown when the OpenAI response dimension count does not match EMBED_DIMS. */
export class EmbeddingDimensionError extends Error {}

/** Embeds one question. Uses the AI SDK's `embed` with MAX_RETRIES set explicitly. */
export function embedOne(text: string): Promise<number[]> {
  throw new Error(`not implemented: embedOne(${text.length} chars)`);
}

/** Embeds a batch for ingest. Uses `embedMany`; order of the result matches the input. */
export function embedMany(texts: string[]): Promise<number[][]> {
  throw new Error(`not implemented: embedMany(${texts.length} texts)`);
}
