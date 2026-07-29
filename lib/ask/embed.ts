import { estimateTokens } from './tokens';

/**
 * Thin client wrapper around Voyage's embeddings API.
 *
 * Contract verified against docs.voyageai.com (Text Embeddings, API Reference, Error Codes)
 * on 2026-07-28, not written from memory:
 *   - Endpoint: POST https://api.voyageai.com/v1/embeddings, `Authorization: Bearer <key>`.
 *   - Request: `input` (string or array, max 1,000 items), `model`, `input_type`
 *     (null | "query" | "document"), `output_dimension` (2048 | 1024 | 512 | 256).
 *   - `input_type: "document"` prepends a retrieval-indexing prompt; `"query"` prepends a
 *     retrieval-search prompt. Swapping them is silent: nothing errors, retrieval just gets
 *     worse, which is why this module exposes two named functions instead of a boolean flag.
 *   - voyage-3.5-lite request limits: 1,000 texts and 1,000,000 tokens per request.
 *   - Response: `{ object, data: [{ embedding, index }], model, usage: { total_tokens } }`.
 *   - Errors: 400/401/403 are permanent (bad request, bad key, blocked IP); 429 and
 *     5xx (500/502/503/504) are transient and worth retrying. A live check against the
 *     unauthenticated endpoint on 2026-07-28 confirmed the error body shape is
 *     `{"detail": "..."}`, not the `{"error": {...}}` shape some other providers use.
 *
 * Only this module builds the Voyage request body; `db/schema.sql`'s `vector(1024)` and
 * `corpus_meta` both depend on `EMBED_MODEL`/`EMBED_DIMENSIONS` having exactly one definition.
 */

const VOYAGE_API_KEY_ENV = 'VOYAGE_API_KEY';
const VOYAGE_EMBEDDINGS_URL = 'https://api.voyageai.com/v1/embeddings';

/** The one definition of model and dimensionality. Change here, re-run `npm run ingest --force`. */
export const EMBED_MODEL = 'voyage-3.5-lite';
export const EMBED_DIMENSIONS = 1024;

/**
 * Voyage's documented `input_type` values. Kept private: callers use `embedDocuments` or
 * `embedQuery`, never this string directly, so the indexing/search distinction can't be
 * passed backwards as a boolean.
 */
const INPUT_TYPE_DOCUMENT = 'document';
const INPUT_TYPE_QUERY = 'query';
type VoyageInputType = typeof INPUT_TYPE_DOCUMENT | typeof INPUT_TYPE_QUERY;

/** voyage-3.5-lite's documented per-request limits. Batches are split to stay under both. */
const MAX_TEXTS_PER_REQUEST = 1000;
const MAX_TOKENS_PER_REQUEST = 1_000_000;

/** 429 (rate limit) and 5xx (server-side) are worth retrying; other 4xx are not. */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 500;

/** Thrown when `VOYAGE_API_KEY` is missing, before any request is attempted. */
export class AskEmbedConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AskEmbedConfigError';
  }
}

/** Thrown for a Voyage request that failed permanently, or exhausted its retry budget. */
export class AskEmbedApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AskEmbedApiError';
    this.status = status;
  }
}

interface VoyageEmbeddingDatum {
  embedding: number[];
  index: number;
}

interface VoyageEmbeddingsResponse {
  object: string;
  data: VoyageEmbeddingDatum[];
  model: string;
  usage: { total_tokens: number };
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
  const key = process.env[VOYAGE_API_KEY_ENV];
  if (!key) {
    throw new AskEmbedConfigError(
      `Missing ${VOYAGE_API_KEY_ENV}: it is not set in this process's environment. If you have ` +
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

/**
 * Voyage's error body is `{"detail": "..."}` (confirmed live against the unauthenticated
 * endpoint), not the `{"error": {...}}` shape some other providers use. Falls back to the raw
 * body, truncated, if it isn't JSON or doesn't carry a `detail` string.
 */
function describeErrorBody(bodyText: string): string {
  if (!bodyText) return '';
  try {
    const parsed = JSON.parse(bodyText) as { detail?: unknown; message?: unknown };
    if (typeof parsed.detail === 'string') return parsed.detail;
    if (typeof parsed.message === 'string') return parsed.message;
  } catch {
    // Not JSON; fall through to the raw text below.
  }
  return bodyText.slice(0, 200);
}

function assertDimension(embedding: number[]): void {
  if (embedding.length !== EMBED_DIMENSIONS) {
    throw new AskEmbedApiError(
      `Voyage returned a ${embedding.length}-dimension vector, expected ${EMBED_DIMENSIONS}. ` +
        'This usually means the model or output_dimension has drifted from what ' +
        'db/schema.sql declares; do not write this vector into the database.'
    );
  }
}

/**
 * One Voyage request, with retry on transient failures. Kept as the single place that calls
 * `fetch`, so the retry loop stays next to the request it protects rather than spread across
 * callers.
 */
async function callVoyage(
  texts: string[],
  inputType: VoyageInputType
): Promise<VoyageEmbeddingsResponse> {
  const apiKey = getApiKey();
  let lastFailure = '';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response: Response;
    try {
      response = await fetch(VOYAGE_EMBEDDINGS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          input: texts,
          model: EMBED_MODEL,
          input_type: inputType,
          output_dimension: EMBED_DIMENSIONS,
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
      return (await response.json()) as VoyageEmbeddingsResponse;
    }

    const bodyText = await response.text().catch(() => '');
    const detail = describeErrorBody(bodyText);
    const isRetryable = RETRYABLE_STATUS_CODES.has(response.status);

    if (!isRetryable || attempt === MAX_ATTEMPTS) {
      throw new AskEmbedApiError(
        `Voyage embeddings request failed with status ${response.status}` +
          (detail ? `: ${detail}` : ''),
        response.status
      );
    }

    lastFailure = `status ${response.status}${detail ? `: ${detail}` : ''}`;
    await sleep(backoffMs(attempt));
  }

  throw new AskEmbedApiError(
    `Voyage embeddings request failed after ${MAX_ATTEMPTS} attempts: ${lastFailure}`
  );
}

/**
 * Splits `texts` into request-sized batches respecting Voyage's documented per-request limits
 * (count and tokens), using this codebase's existing token estimate. Callers never think about
 * batching; they hand in the full list.
 */
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
    const response = await callVoyage(batch, INPUT_TYPE_DOCUMENT);
    tokensUsed += response.usage.total_tokens;

    // Voyage returns `index` per item; sort defensively rather than assume response order
    // matches request order.
    const sorted = [...response.data].sort((a, b) => a.index - b.index);
    for (const item of sorted) {
      assertDimension(item.embedding);
      embeddings.push(item.embedding);
    }
  }

  return { embeddings, tokensUsed };
}

/** Embeds a single query string for search. Distinct from `embedDocuments`: see module docs. */
export async function embedQuery(text: string): Promise<EmbedQueryResult> {
  const response = await callVoyage([text], INPUT_TYPE_QUERY);
  const [datum] = response.data;
  if (!datum) {
    throw new AskEmbedApiError('Voyage embeddings response contained no data for the query');
  }
  assertDimension(datum.embedding);
  return { embedding: datum.embedding, tokensUsed: response.usage.total_tokens };
}
