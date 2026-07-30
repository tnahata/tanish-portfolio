export const ANTHROPIC_MODEL = 'claude-sonnet-5';
const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_API_VERSION = '2023-06-01';
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_BASE_DELAY_MS = 250;
const DEFAULT_MAX_TOKENS = 1024;

// claude-sonnet-5 standard pricing, $ per million tokens. See docs/ask-agent and the report for why
// this model was chosen over Opus for a bounded, single-turn RAG answer.
const INPUT_COST_PER_MTOK = 3;
const OUTPUT_COST_PER_MTOK = 15;

export class AnthropicApiKeyMissingError extends Error {
  constructor() {
    super('ANTHROPIC_API_KEY is not set in process.env.');
    this.name = 'AnthropicApiKeyMissingError';
  }
}

export class AnthropicRequestError extends Error {
  constructor(status: number, body: string) {
    super(`Anthropic messages request failed (${status}): ${body}`);
    this.name = 'AnthropicRequestError';
  }
}

export class AnthropicStreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnthropicStreamError';
  }
}

export interface GenerateMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerateConfig {
  system: string;
  messages: GenerateMessage[];
  /** Exact string the model must emit alone when the context does not answer the question. */
  unanswerableMarker: string;
  maxTokens?: number;
}

export interface GenerateComplete {
  text: string;
  /** True only on exact equality between the trimmed response and `unanswerableMarker`. */
  isUnanswerable: boolean;
  stopReason: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface GenerateStream {
  textStream: AsyncIterable<string>;
  complete: Promise<GenerateComplete>;
}

interface AnthropicStreamEvent {
  type: string;
  message?: { usage?: { input_tokens: number } };
  delta?: { type?: string; text?: string; stop_reason?: string | null };
  usage?: { output_tokens: number };
  error?: { message?: string };
}

function readAnthropicApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new AnthropicApiKeyMissingError();
  return key;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * INPUT_COST_PER_MTOK + (outputTokens / 1_000_000) * OUTPUT_COST_PER_MTOK;
}

async function requestMessagesStream(config: GenerateConfig, apiKey: string): Promise<Response> {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_API_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
        system: config.system,
        messages: config.messages,
        stream: true,
      }),
    });
    if (response.ok) return response;

    const body = await response.text();
    if (!isRetryableStatus(response.status) || attempt >= MAX_RETRY_ATTEMPTS) {
      throw new AnthropicRequestError(response.status, body);
    }
    await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
  }
}

/** Splits an SSE byte stream on blank lines and parses each event's `data:` payload as JSON. */
async function* parseServerSentEvents(response: Response): AsyncGenerator<AnthropicStreamEvent> {
  const reader = response.body?.getReader();
  if (!reader) throw new AnthropicStreamError('Anthropic response body is not readable.');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const dataLine = rawEvent.split('\n').find((line) => line.startsWith('data: '));
      if (dataLine) yield JSON.parse(dataLine.slice('data: '.length)) as AnthropicStreamEvent;
      boundary = buffer.indexOf('\n\n');
    }
  }
}

async function* runGeneration(config: GenerateConfig, onComplete: (complete: GenerateComplete) => void): AsyncGenerator<string> {
  const response = await requestMessagesStream(config, readAnthropicApiKey());

  let fullText = '';
  let stopReason: string | null = null;
  let inputTokens = 0;
  let outputTokens = 0;

  for await (const event of parseServerSentEvents(response)) {
    if (event.type === 'error') {
      throw new AnthropicStreamError(event.error?.message ?? 'Anthropic returned a stream error event.');
    }
    if (event.type === 'message_start') {
      inputTokens = event.message?.usage?.input_tokens ?? 0;
    } else if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
      fullText += event.delta.text;
      yield event.delta.text;
    } else if (event.type === 'message_delta') {
      stopReason = event.delta?.stop_reason ?? stopReason;
      outputTokens = event.usage?.output_tokens ?? outputTokens;
    }
  }

  const trimmed = fullText.trim();
  onComplete({
    text: fullText,
    isUnanswerable: trimmed === config.unanswerableMarker,
    stopReason,
    inputTokens,
    outputTokens,
    costUsd: computeCostUsd(inputTokens, outputTokens),
  });
}

/**
 * Streams a Messages API completion. Draining `textStream` to the end is what drives the request
 * and resolves `complete`; a caller that only wants the final text still has to drain it.
 */
export function streamGeneration(config: GenerateConfig): GenerateStream {
  let resolveComplete!: (value: GenerateComplete) => void;
  let rejectComplete!: (reason: unknown) => void;
  const complete = new Promise<GenerateComplete>((resolve, reject) => {
    resolveComplete = resolve;
    rejectComplete = reject;
  });
  // Prevents an unhandled rejection for a caller that only drains textStream; `await complete`
  // still works normally elsewhere, since a promise can have more than one subscriber.
  complete.catch(() => undefined);

  async function* textStream(): AsyncGenerator<string> {
    try {
      yield* runGeneration(config, resolveComplete);
    } catch (error) {
      rejectComplete(error);
      throw error;
    }
  }

  return { textStream: textStream(), complete };
}
