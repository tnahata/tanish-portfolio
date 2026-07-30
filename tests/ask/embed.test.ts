import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmbeddingDimensionError, EmbeddingRequestError, OpenAiApiKeyMissingError, embedTexts } from '@/lib/ask/embed';

const DIMENSIONS = 1024;

function vector(fill: number): number[] {
  return new Array(DIMENSIONS).fill(fill);
}

describe('embedTexts', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalKey;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('throws OpenAiApiKeyMissingError when OPENAI_API_KEY is unset', async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(embedTexts(['a'])).rejects.toThrow(OpenAiApiKeyMissingError);
  });

  it('returns an empty result without hitting the network for zero inputs', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await embedTexts([]);

    expect(result).toEqual({ embeddings: [], tokensUsed: 0, model: 'text-embedding-3-large', dimensions: DIMENSIONS });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sorts embeddings by index before returning them, regardless of response order', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'text-embedding-3-large',
        usage: { prompt_tokens: 10, total_tokens: 10 },
        data: [
          { index: 2, embedding: vector(2) },
          { index: 0, embedding: vector(0) },
          { index: 1, embedding: vector(1) },
        ],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await embedTexts(['first', 'second', 'third']);

    expect(result.embeddings[0][0]).toBe(0);
    expect(result.embeddings[1][0]).toBe(1);
    expect(result.embeddings[2][0]).toBe(2);
  });

  it('throws EmbeddingDimensionError when a returned vector has the wrong width', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'text-embedding-3-large',
        usage: { prompt_tokens: 1, total_tokens: 1 },
        data: [{ index: 0, embedding: [0.1, 0.2] }],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(embedTexts(['only'])).rejects.toThrow(EmbeddingDimensionError);
  });

  it('retries on a 429 and succeeds once the retry clears', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429, text: async () => 'rate limited' })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'text-embedding-3-large',
          usage: { prompt_tokens: 1, total_tokens: 1 },
          data: [{ index: 0, embedding: vector(0) }],
        }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;
    vi.useFakeTimers();

    const promise = embedTexts(['only']);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.embeddings).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries on a 500 the same way it retries on a 429', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'server error' })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'text-embedding-3-large',
          usage: { prompt_tokens: 1, total_tokens: 1 },
          data: [{ index: 0, embedding: vector(0) }],
        }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;
    vi.useFakeTimers();

    const promise = embedTexts(['only']);
    await vi.runAllTimersAsync();
    await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry on a non-retryable 4xx status', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'bad request' });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(embedTexts(['only'])).rejects.toThrow(EmbeddingRequestError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
