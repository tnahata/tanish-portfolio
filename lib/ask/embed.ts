import { embed, embedMany as embedManyValues } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { EMBED_MODEL, EMBED_DIMS, MAX_RETRIES } from './config';

/** Thrown when the OpenAI response dimension count does not match EMBED_DIMS. */
export class EmbeddingDimensionError extends Error {}

function embeddingModel() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set; embedding calls require it.');
  }
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai.embedding(EMBED_MODEL);
}

function assertDims(dims: number): void {
  if (dims !== EMBED_DIMS) {
    throw new EmbeddingDimensionError(`expected ${EMBED_DIMS} dimensions, got ${dims}`);
  }
}

/** Embeds one question. Uses the AI SDK's `embed` with MAX_RETRIES set explicitly. */
export async function embedOne(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel(),
    value: text,
    maxRetries: MAX_RETRIES,
    providerOptions: { openai: { dimensions: EMBED_DIMS } },
  });
  assertDims(embedding.length);
  return embedding;
}

/** Embeds a batch for ingest. Uses `embedMany`; order of the result matches the input. */
export async function embedMany(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedManyValues({
    model: embeddingModel(),
    values: texts,
    maxRetries: MAX_RETRIES,
    providerOptions: { openai: { dimensions: EMBED_DIMS } },
  });
  embeddings.forEach((embedding) => assertDims(embedding.length));
  return embeddings;
}
