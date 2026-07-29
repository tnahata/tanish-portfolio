import { estimateTokens } from './tokens';

/**
 * Thin client wrapper around OpenAI's embeddings API.
 *
 * Contract verified against developers.openai.com (Embeddings guide, API Reference, Error
 * codes, Rate limits) on 2026-07-28, not written from memory:
 *   - Endpoint: POST https://api.openai.com/v1/embeddings, `Authorization: Bearer <key>`.
 *   - Request: `input` (string, array of strings, or token arrays; max 2,048 items in the
 *     array, 8,192 tokens per individual input, 300,000 tokens summed across every input in
 *     one request), `model`, `dimensions` (only `text-embedding-3-small` and
 *     `text-embedding-3-large` accept it), `encoding_format` (`"float"` | `"base64"`,
 *     defaults to `"float"`; sent explicitly here so a future default change can't silently
 *     switch the response shape this module parses).
 *   - Response: `{ object: "list", data: [{ object: "embedding", embedding, index }], model,
 *     usage: { prompt_tokens, total_tokens } }`.
 *   - Errors: 401 (bad key) and 403 (unsupported region) are permanent; 429 (rate limit) and
 *     500/503 (server-side) are documented as transient and worth retrying with exponential
 *     backoff, which is OpenAI's own stated recommendation, not an assumption carried over
 *     from the Voyage client. 502/504 are kept in the retryable set as conventional transient
 *     gateway errors even though the fetched docs only named 500 and 503 by number. The exact
 *     JSON shape of `error` (`message`/`type`/`param`/`code`) was not shown verbatim in the
 *     fetched page text, so `describeErrorBody` below parses defensively (`message` if
 *     present, else the raw body) rather than asserting a shape the docs didn't confirm.
 *
 * Model and dimension choice: `text-embedding-3-large`, called with `dimensions: 1024`.
 *   - 1024 keeps `db/schema.sql`'s existing `vector(1024)` column: no migration, and there is
 *     nothing to migrate yet since the index is empty.
 *   - Truncated 3-large outperforms 3-small at 3-small's own native size. OpenAI's own
 *     documentation states a 3-large embedding shortened to 256 dimensions still outperforms
 *     an unshortened `text-embedding-ada-002` embedding at 1536; 1024 sits well above that
 *     256-dimension floor, so 3-large truncated to 1024 is expected to beat 3-small's native
 *     1536 by the same logic, not just meet it.
 *   - Cost is irrelevant at this corpus size (~47 chunks): the price difference between models
 *     at that volume is a fraction of a cent either way, so it does not weigh against quality.
 *   - Quality matters specifically because every corpus document is about the same person
 *     (Tanish). The crowded middle band between "answers the question" and "topically related
 *     but does not answer" is exactly what `T_STRONG` (see docs/ask-agent/04-retrieval-grounding.md)
 *     has to separate, and that separation is harder with a weaker embedding space.
 *
 * `input_type` no longer exists as a concept: OpenAI's embeddings endpoint has no
 * document-versus-query request parameter, unlike Voyage's `input_type: "document" | "query"`.
 * That parameter was the entire technical reason `embedDocuments` and `embedQuery` were two
 * functions instead of one: `input_type` changed what got prepended to the text server-side,
 * and swapping the two silently degraded retrieval with no error. With OpenAI, both functions
 * now make the exact same request shape; only the calling context (batch of chunks at ingest
 * time, versus one string at query time) differs. Both names are kept anyway, deliberately not
 * collapsed into one: Phase 2 call sites (`askOnce()`, `scripts/ingest.ts`) read as "embed this
 * for indexing" versus "embed this for search" regardless of what the vendor's API happens to
 * need this year, and collapsing them now would make a future vendor swap that reintroduces an
 * `input_type`-shaped parameter a breaking rename instead of a body-only change.
 *
 * Only this module builds the OpenAI request body; `db/schema.sql`'s `vector(1024)` and
 * `corpus_meta` both depend on `EMBED_MODEL`/`EMBED_DIMENSIONS` having exactly one definition.
 */

const OPENAI_API_KEY_ENV = 'OPENAI_API_KEY';
const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';

/** The one definition of model and dimensionality. Change here, re-run `npm run ingest --force`. */
export const EMBED_MODEL = 'text-embedding-3-large';
export const EMBED_DIMENSIONS = 1024;

/**
 * Sent explicitly on every request rather than relying on the documented default, so a future
 * change to OpenAI's default `encoding_format` can't silently switch this module from parsing
 * `embedding: number[]` to parsing a base64 string it was never written to handle.
 */
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

/**
 * OpenAI's conventional error body is `{"error": {"message": "...", ...}}`, but the exact
 * shape was not shown verbatim in the fetched documentation text (see module doc above), so
 * this parses `message` defensively rather than asserting a shape confirmed only from memory.
 * Falls back to the raw body, truncated, if it isn't JSON or doesn't carry a `message` string.
 */
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

/**
 * One OpenAI request, with retry on transient failures. Kept as the single place that calls
 * `fetch`, so the retry loop stays next to the request it protects rather than spread across
 * callers.
 */
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

/**
 * Splits `texts` into request-sized batches respecting OpenAI's documented per-request limits
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
    const response = await callOpenAi(batch);
    tokensUsed += response.usage.total_tokens;

    // OpenAI returns `index` per item, same as Voyage did; sort defensively rather than
    // assume response order matches request order. Neither vendor's docs guarantee order, so
    // this is not a Voyage-specific caution carried over out of habit.
    const sorted = [...response.data].sort((a, b) => a.index - b.index);
    for (const item of sorted) {
      assertDimension(item.embedding);
      embeddings.push(item.embedding);
    }
  }

  return { embeddings, tokensUsed };
}

/**
 * Embeds a single query string for search. Same request shape as `embedDocuments` now that
 * OpenAI has no document/query distinction (see module doc above); kept as a separate export
 * for call-site readability, not because the request differs.
 */
export async function embedQuery(text: string): Promise<EmbedQueryResult> {
  const response = await callOpenAi([text]);
  const [datum] = response.data;
  if (!datum) {
    throw new AskEmbedApiError('OpenAI embeddings response contained no data for the query');
  }
  assertDimension(datum.embedding);
  return { embedding: datum.embedding, tokensUsed: response.usage.total_tokens };
}
