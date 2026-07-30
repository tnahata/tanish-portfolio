const EMBEDDING_MODEL = 'text-embedding-3-large';
const EMBEDDING_DIMENSIONS = 1024;
const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_BASE_DELAY_MS = 250;

interface OpenAiEmbeddingItem {
  index: number;
  embedding: number[];
}

interface OpenAiEmbeddingResponse {
  data: OpenAiEmbeddingItem[];
  model: string;
  usage: { prompt_tokens: number; total_tokens: number };
}

export interface EmbeddingResult {
  embeddings: number[][];
  tokensUsed: number;
  model: string;
  dimensions: number;
}

export class OpenAiApiKeyMissingError extends Error {
  constructor() {
    super('OPENAI_API_KEY is not set in process.env.');
    this.name = 'OpenAiApiKeyMissingError';
  }
}

export class EmbeddingRequestError extends Error {
  constructor(status: number, body: string) {
    super(`OpenAI embeddings request failed (${status}): ${body}`);
    this.name = 'EmbeddingRequestError';
  }
}

export class EmbeddingDimensionError extends Error {
  constructor(expected: number, actual: number) {
    super(`Expected ${expected}-dimension embeddings, got ${actual}`);
    this.name = 'EmbeddingDimensionError';
  }
}

function readOpenAiApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new OpenAiApiKeyMissingError();
  return key;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestEmbeddings(inputs: string[], apiKey: string): Promise<OpenAiEmbeddingResponse> {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(OPENAI_EMBEDDINGS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: inputs,
        dimensions: EMBEDDING_DIMENSIONS,
        encoding_format: 'float',
      }),
    });
    if (response.ok) return (await response.json()) as OpenAiEmbeddingResponse;

    const body = await response.text();
    if (!isRetryableStatus(response.status) || attempt >= MAX_RETRY_ATTEMPTS) {
      throw new EmbeddingRequestError(response.status, body);
    }
    await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
  }
}

/** OpenAI does not guarantee response order matches request order; sort by `index` before use. */
function toOrderedResult(response: OpenAiEmbeddingResponse, expectedCount: number): EmbeddingResult {
  const sorted = [...response.data].sort((a, b) => a.index - b.index);
  if (sorted.length !== expectedCount) {
    throw new EmbeddingRequestError(200, `expected ${expectedCount} embeddings, received ${sorted.length}`);
  }

  const embeddings = sorted.map((item) => {
    if (item.embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new EmbeddingDimensionError(EMBEDDING_DIMENSIONS, item.embedding.length);
    }
    return item.embedding;
  });

  return { embeddings, tokensUsed: response.usage.total_tokens, model: response.model, dimensions: EMBEDDING_DIMENSIONS };
}

export async function embedTexts(inputs: string[]): Promise<EmbeddingResult> {
  if (inputs.length === 0) {
    return { embeddings: [], tokensUsed: 0, model: EMBEDDING_MODEL, dimensions: EMBEDDING_DIMENSIONS };
  }
  const apiKey = readOpenAiApiKey();
  const response = await requestEmbeddings(inputs, apiKey);
  return toOrderedResult(response, inputs.length);
}
