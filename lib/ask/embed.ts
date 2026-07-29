import { estimateTokens } from './tokens';

/** Thin client wrapper around OpenAI's embeddings API. Only this module calls fetch for
 *  embeddings or defines EMBED_MODEL/EMBED_DIMENSIONS. See docs/ask-agent/02-ingest.md#embedding-provider. */

const OPENAI_API_KEY_ENV = 'OPENAI_API_KEY';
const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';

/** The one definition of model and dimensionality. Change here, re-run `npm run ingest --force`. */
export const EMBED_MODEL = 'text-embedding-3-large';
export const EMBED_DIMENSIONS = 1024;

/** Sent explicitly rather than relying on the documented default, so a future default change
 *  can't silently switch this module from parsing floats to a base64 string it can't handle. */
const ENCODING_FORMAT = 'float';

/** OpenAI's documented per-request limits. Batches are split to stay under both. */
const MAX_TEXTS_PER_REQUEST = 2048;
const MAX_TOKENS_PER_REQUEST = 300_000;

/** 429 (rate limit) and 5xx (server-side) are worth retrying; other 4xx are not. */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 500;

/** Thrown when `OPENAI_API_KEY` is missing, before any request is attempted. */
export class AskEmbedConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AskEmbedConfigError';
  }
}

/** Thrown for an OpenAI request that failed permanently, or exhausted its retry budget. */
export class AskEmbedApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AskEmbedApiError';
    this.status = status;
  }
}

interface OpenAiEmbeddingDatum {
  object: string;
  embedding: number[];
  index: number;
}

interface OpenAiEmbeddingsResponse {
  object: string;
  data: OpenAiEmbeddingDatum[];
  model: string;
  usage: { prompt_tokens: number; total_tokens: number };
}

export interface EmbedBatchResult {
  /** One vector per input text, in the same order as the input. */
  embeddings: number[][];
  tokensUsed: number;
}

export interface EmbedQueryResult {
  embedding: number[];
  tokensUsed: number;
}

function getApiKey(): string {
  const key = process.env[OPENAI_API_KEY_ENV];
  if (!key) {
    throw new AskEmbedConfigError(
      `Missing ${OPENAI_API_KEY_ENV}: it is not set in this process's environment. If you have ` +
        'already set it in a local configuration file, note that standalone scripts load ' +
        'configuration explicitly rather than picking it up automatically the way next dev ' +
        'and next build do; confirm that loading step ran before this. For preview and ' +
        'production, set it in the deployment environment (Vercel project settings, or CI ' +
        'secrets for the scheduled ingest). Never commit a real API key.'
    );
  }
  return key;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exponential backoff from a fixed base, with jitter so retries from a batch don't align. */
function backoffMs(attempt: number): number {
  const exponential = BASE_BACKOFF_MS * 2 ** (attempt - 1);
  const jitter = Math.random() * BASE_BACKOFF_MS;
  return exponential + jitter;
}

/** OpenAI's error body is typically `{ error: { message } }`, but the shape isn't guaranteed,
 *  so this reads `message` defensively and falls back to the raw body, truncated. */
function describeErrorBody(bodyText: string): string {
  if (!bodyText) return '';
  try {
    const parsed = JSON.parse(bodyText) as { error?: { message?: unknown } };
    if (typeof parsed.error?.message === 'string') return parsed.error.message;
  } catch {
    // Not JSON; fall through to the raw text below.
  }
  return bodyText.slice(0, 200);
}

function assertDimension(embedding: number[]): void {
  if (embedding.length !== EMBED_DIMENSIONS) {
    throw new AskEmbedApiError(
      `OpenAI returned a ${embedding.length}-dimension vector, expected ${EMBED_DIMENSIONS}. ` +
        'This usually means the model or dimensions parameter has drifted from what ' +
        'db/schema.sql declares; do not write this vector into the database.'
    );
  }
}

/** One OpenAI request, with retry on transient failures. The only place that calls `fetch`,
 *  so the retry loop stays next to the request it protects. */
async function callOpenAi(texts: string[]): Promise<OpenAiEmbeddingsResponse> {
  const apiKey = getApiKey();
  let lastFailure = '';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response: Response;
    try {
      response = await fetch(OPENAI_EMBEDDINGS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          input: texts,
          model: EMBED_MODEL,
          dimensions: EMBED_DIMENSIONS,
          encoding_format: ENCODING_FORMAT,
        }),
      });
    } catch (err) {
      // Network-level failure (DNS, connection reset): treat like a transient server error.
      lastFailure = err instanceof Error ? err.message : String(err);
      if (attempt === MAX_ATTEMPTS) break;
      await sleep(backoffMs(attempt));
      continue;
    }

    if (response.ok) {
      return (await response.json()) as OpenAiEmbeddingsResponse;
    }

    const bodyText = await response.text().catch(() => '');
    const detail = describeErrorBody(bodyText);
    const isRetryable = RETRYABLE_STATUS_CODES.has(response.status);

    if (!isRetryable || attempt === MAX_ATTEMPTS) {
      throw new AskEmbedApiError(
        `OpenAI embeddings request failed with status ${response.status}` +
          (detail ? `: ${detail}` : ''),
        response.status
      );
    }

    lastFailure = `status ${response.status}${detail ? `: ${detail}` : ''}`;
    await sleep(backoffMs(attempt));
  }

  throw new AskEmbedApiError(
    `OpenAI embeddings request failed after ${MAX_ATTEMPTS} attempts: ${lastFailure}`
  );
}

/** Splits `texts` into request-sized batches respecting OpenAI's per-request limits (count
 *  and tokens). Callers hand in the full list and never think about batching. */
function batchInputs(texts: string[]): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const text of texts) {
    const tokens = estimateTokens(text);
    const overflowsCount = current.length + 1 > MAX_TEXTS_PER_REQUEST;
    const overflowsTokens = current.length > 0 && currentTokens + tokens > MAX_TOKENS_PER_REQUEST;

    if (overflowsCount || overflowsTokens) {
      batches.push(current);
      current = [];
      currentTokens = 0;
    }

    current.push(text);
    currentTokens += tokens;
  }

  if (current.length > 0) batches.push(current);
  return batches;
}

/**
 * Embeds a batch of chunk texts for indexing. Batches internally and sums token usage across
 * requests. Order of `embeddings` matches the order of `texts`.
 */
export async function embedDocuments(texts: string[]): Promise<EmbedBatchResult> {
  if (texts.length === 0) return { embeddings: [], tokensUsed: 0 };

  const batches = batchInputs(texts);
  const embeddings: number[][] = [];
  let tokensUsed = 0;

  for (const batch of batches) {
    const response = await callOpenAi(batch);
    tokensUsed += response.usage.total_tokens;

    // Response order isn't guaranteed to match request order; sort by index so a chunk never
    // gets attached to the wrong vector, which nothing downstream would otherwise catch.
    const sorted = [...response.data].sort((a, b) => a.index - b.index);
    for (const item of sorted) {
      assertDimension(item.embedding);
      embeddings.push(item.embedding);
    }
  }

  return { embeddings, tokensUsed };
}

/** Embeds a single query string for search. Same request shape as `embedDocuments`; kept as a
 *  separate export for call-site readability, not because the request differs. */
export async function embedQuery(text: string): Promise<EmbedQueryResult> {
  const response = await callOpenAi([text]);
  const [datum] = response.data;
  if (!datum) {
    throw new AskEmbedApiError('OpenAI embeddings response contained no data for the query');
  }
  assertDimension(datum.embedding);
  return { embedding: datum.embedding, tokensUsed: response.usage.total_tokens };
}
