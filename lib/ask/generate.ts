import type { StrongGrounding } from './ground';
import { assemblePrompt, type HistoryPair } from './prompt';

/** Thin wrapper around Anthropic's Messages API; the only module that calls Claude. Takes a
 *  `StrongGrounding` value so generation is structurally unreachable without evidence. */

const ANTHROPIC_API_KEY_ENV = 'ANTHROPIC_API_KEY';
const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

/** Pinned Messages API version, not "latest": an unannounced response-shape change should be
 *  opted into deliberately. */
const ANTHROPIC_VERSION = '2023-06-01';

/** Grounded QA over an already-scored context, 120-word cap, no tools: Sonnet-tier work at a
 *  fifth of Opus's per-token cost. Revisit if eval results call for more. */
export const GENERATION_MODEL = 'claude-sonnet-5';

/** Ceiling on the model's own output tokens. 120-word answers run well under this; generous
 *  headroom until real generations exist to tune it against. */
const MAX_OUTPUT_TOKENS = 500;

/** 429 and 5xx are transient and worth retrying; other 4xx are not. Same set lib/ask/embed.ts
 *  uses for OpenAI. */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504, 529]);
const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 500;

/** Sonnet 5 list pricing per million tokens: conservative for `turns.cost_usd` since Anthropic's
 *  introductory pricing is lower. Verify before the spend cap goes live. */
const INPUT_COST_PER_MTOK = 3.0;
const OUTPUT_COST_PER_MTOK = 15.0;

/** Thrown when `ANTHROPIC_API_KEY` is missing, before any request is attempted. */
export class AskGenerateConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AskGenerateConfigError';
  }
}

/** Thrown for an Anthropic request that failed permanently, or exhausted its retry budget. */
export class AskGenerateApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AskGenerateApiError';
    this.status = status;
  }
}

interface AnthropicTextBlock {
  type: string;
  text?: string;
}

interface AnthropicMessagesResponse {
  content: AnthropicTextBlock[];
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface GenerateResult {
  /** Null when the raw response was this request's unanswerable marker (lib/ask/prompt.ts):
   *  `strong` grounding, but the model judged the passages don't answer. */
  answer: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

function getApiKey(): string {
  const key = process.env[ANTHROPIC_API_KEY_ENV];
  if (!key) {
    throw new AskGenerateConfigError(
      `Missing ${ANTHROPIC_API_KEY_ENV}: it is not set in this process's environment. If you ` +
        'have already set it in a local configuration file, note that standalone scripts load ' +
        'configuration explicitly rather than picking it up automatically the way next dev and ' +
        'next build do; confirm that loading step ran before this. For preview and production, ' +
        'set it in the deployment environment (Vercel project settings). Never commit a real ' +
        'API key.'
    );
  }
  return key;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exponential backoff with jitter, so retries from concurrent requests don't land on the same
 *  schedule. Same shape as lib/ask/embed.ts's `backoffMs`. */
function backoffMs(attempt: number): number {
  const exponential = BASE_BACKOFF_MS * 2 ** (attempt - 1);
  const jitter = Math.random() * BASE_BACKOFF_MS;
  return exponential + jitter;
}

/** Anthropic's error body is `{"error": {"type", "message"}}`, parsed defensively: fall back to
 *  the raw body, truncated, if it isn't JSON or lacks `message`. */
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

/** One Anthropic request with retry on transient failures; the single place that calls `fetch`,
 *  so the retry loop stays next to the request it protects. */
async function callAnthropic(
  system: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<AnthropicMessagesResponse> {
  const apiKey = getApiKey();
  let lastFailure = '';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response: Response;
    try {
      response = await fetch(ANTHROPIC_MESSAGES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: GENERATION_MODEL,
          max_tokens: MAX_OUTPUT_TOKENS,
          system,
          messages,
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
      return (await response.json()) as AnthropicMessagesResponse;
    }

    const bodyText = await response.text().catch(() => '');
    const detail = describeErrorBody(bodyText);
    const isRetryable = RETRYABLE_STATUS_CODES.has(response.status);

    if (!isRetryable || attempt === MAX_ATTEMPTS) {
      throw new AskGenerateApiError(
        `Anthropic messages request failed with status ${response.status}` +
          (detail ? `: ${detail}` : ''),
        response.status
      );
    }

    lastFailure = `status ${response.status}${detail ? `: ${detail}` : ''}`;
    await sleep(backoffMs(attempt));
  }

  throw new AskGenerateApiError(
    `Anthropic messages request failed after ${MAX_ATTEMPTS} attempts: ${lastFailure}`
  );
}

function costUsd(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * INPUT_COST_PER_MTOK + (outputTokens / 1_000_000) * OUTPUT_COST_PER_MTOK
  );
}

/** Generates the strong-grounding answer from `strong.chunks` (what `grade()` already scored,
 *  not a fresh retrieval). Refuses to run without a `StrongGrounding` value in hand. */
export async function generate(
  strong: StrongGrounding,
  question: string,
  history: readonly HistoryPair[]
): Promise<GenerateResult> {
  const { system, messages, unanswerableMarker } = assemblePrompt(question, strong.chunks, history);
  const response = await callAnthropic(system, messages);

  const textBlock = response.content.find(
    (block): block is AnthropicTextBlock & { text: string } =>
      block.type === 'text' && typeof block.text === 'string'
  );
  if (!textBlock) {
    throw new AskGenerateApiError(
      `Anthropic response contained no text block (stop_reason: ${response.stop_reason})`
    );
  }

  // Exact-equality match on the trimmed response, not substring: an answer that happens to
  // mention the marker text mid-sentence is never misparsed as a refusal. See lib/ask/prompt.ts.
  const isUnanswerableRefusal = textBlock.text.trim() === unanswerableMarker;

  return {
    answer: isUnanswerableRefusal ? null : textBlock.text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    costUsd: costUsd(response.usage.input_tokens, response.usage.output_tokens),
  };
}
