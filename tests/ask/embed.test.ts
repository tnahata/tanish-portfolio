import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AskEmbedApiError,
  AskEmbedConfigError,
  EMBED_DIMENSIONS,
  EMBED_MODEL,
  embedDocuments,
  embedQuery,
} from '../../lib/ask/embed';

/** Behavioural tests for the OpenAI embeddings client, `fetch` mocked throughout. Retry tests
 *  use `vi.advanceTimersByTimeAsync`: the code under test awaits its own setTimeout-based sleep. */

const API_KEY_VAR = 'OPENAI_API_KEY';
const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';
const originalApiKey = process.env[API_KEY_VAR];

interface FakeResponseInit {
  ok: boolean;
  status: number;
  jsonBody?: unknown;
  textBody?: string;
}

function fakeResponse({ ok, status, jsonBody, textBody }: FakeResponseInit): Response {
  return {
    ok,
    status,
    json: async () => jsonBody,
    text: async () => textBody ?? (jsonBody ? JSON.stringify(jsonBody) : ''),
  } as Response;
}

/** A deterministic 1024-length vector, distinguishable per input by its first value. */
function vectorFor(tag: number, dims: number = EMBED_DIMENSIONS): number[] {
  return Array.from({ length: dims }, (_, i) => (i === 0 ? tag : 0.01 * i));
}

function successBody(texts: string[], indexOrder?: number[]): {
  object: string;
  data: { object: string; embedding: number[]; index: number }[];
  model: string;
  usage: { prompt_tokens: number; total_tokens: number };
} {
  const order = indexOrder ?? texts.map((_, i) => i);
  return {
    object: 'list',
    data: order.map((index) => ({ object: 'embedding', embedding: vectorFor(index), index })),
    model: EMBED_MODEL,
    usage: { prompt_tokens: texts.length * 10, total_tokens: texts.length * 10 },
  };
}

function requestBody(call: unknown[]): Record<string, unknown> {
  const [, init] = call as [string, RequestInit];
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

beforeEach(() => {
  process.env[API_KEY_VAR] = 'test-key';
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  if (originalApiKey === undefined) delete process.env[API_KEY_VAR];
  else process.env[API_KEY_VAR] = originalApiKey;
});

describe('missing configuration', () => {
  it('throws AskEmbedConfigError without ever calling fetch', async () => {
    delete process.env[API_KEY_VAR];
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(embedDocuments(['some text'])).rejects.toThrow(AskEmbedConfigError);
    await expect(embedDocuments(['some text'])).rejects.toThrow(/OPENAI_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('embedQuery also throws AskEmbedConfigError without calling fetch', async () => {
    delete process.env[API_KEY_VAR];
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(embedQuery('a question')).rejects.toThrow(AskEmbedConfigError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('request shape', () => {
  it('sends the declared model and dimensions, and reads them back off the response', async () => {
    const texts = ['first chunk', 'second chunk'];
    const fetchMock = vi.fn().mockResolvedValue(
      fakeResponse({ ok: true, status: 200, jsonBody: successBody(texts) })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await embedDocuments(texts);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(OPENAI_EMBEDDINGS_URL);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key');

    const body = requestBody(fetchMock.mock.calls[0]);
    expect(body.model).toBe('text-embedding-3-large');
    expect(body.dimensions).toBe(1024);
    expect(body.encoding_format).toBe('float');
    expect(body.input).toEqual(texts);

    expect(EMBED_MODEL).toBe('text-embedding-3-large');
    expect(EMBED_DIMENSIONS).toBe(1024);
    expect(result.embeddings).toHaveLength(2);
    expect(result.tokensUsed).toBe(20);
  });

  it('never logs the API key', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchMock = vi.fn().mockResolvedValue(
      fakeResponse({ ok: true, status: 200, jsonBody: successBody(['x']) })
    );
    vi.stubGlobal('fetch', fetchMock);

    await embedDocuments(['x']);

    const allLoggedText = [...logSpy.mock.calls, ...errorSpy.mock.calls].flat().join(' ');
    expect(allLoggedText).not.toContain('test-key');
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

describe('result ordering', () => {
  it('reorders a response returned out of index order back to input order', async () => {
    const texts = ['alpha', 'beta', 'gamma'];
    // The API carries an `index` per item but never guarantees response order matches request order.
    const shuffled = successBody(texts, [2, 0, 1]);
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse({ ok: true, status: 200, jsonBody: shuffled }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await embedDocuments(texts);

    // vectorFor(i) tags each embedding's first element with its logical index.
    expect(result.embeddings[0][0]).toBe(0);
    expect(result.embeddings[1][0]).toBe(1);
    expect(result.embeddings[2][0]).toBe(2);
  });
});

describe('dimension assertion', () => {
  it('throws AskEmbedApiError when a returned vector does not match EMBED_DIMENSIONS', async () => {
    const badBody = {
      object: 'list',
      data: [{ object: 'embedding', embedding: vectorFor(0, 512), index: 0 }],
      model: EMBED_MODEL,
      usage: { prompt_tokens: 5, total_tokens: 5 },
    };
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse({ ok: true, status: 200, jsonBody: badBody }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(embedDocuments(['one chunk'])).rejects.toThrow(AskEmbedApiError);
    await expect(embedDocuments(['one chunk'])).rejects.toThrow(/512-dimension/);
  });

  it('applies the same assertion to embedQuery', async () => {
    const badBody = {
      object: 'list',
      data: [{ object: 'embedding', embedding: vectorFor(0, 3), index: 0 }],
      model: EMBED_MODEL,
      usage: { prompt_tokens: 2, total_tokens: 2 },
    };
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse({ ok: true, status: 200, jsonBody: badBody }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(embedQuery('a question')).rejects.toThrow(AskEmbedApiError);
  });
});

describe('batching at OpenAI real limits', () => {
  it('splits a batch that exceeds the 2048-item-per-request count limit', async () => {
    const texts = Array.from({ length: 2049 }, (_, i) => `chunk ${i}`);
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const parsed = JSON.parse(init.body as string) as { input: string[] };
      return fakeResponse({ ok: true, status: 200, jsonBody: successBody(parsed.input) });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await embedDocuments(texts);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBatchSize = (requestBody(fetchMock.mock.calls[0]).input as string[]).length;
    const secondBatchSize = (requestBody(fetchMock.mock.calls[1]).input as string[]).length;
    expect(firstBatchSize).toBe(2048);
    expect(secondBatchSize).toBe(1);
    expect(result.embeddings).toHaveLength(2049);
  });

  it('splits a batch that stays under the count limit but exceeds the 300,000-token budget', async () => {
    // Two ~200k-token texts fit individually but not together under the 300k-token ceiling.
    const texts = [`a${'x'.repeat(799_999)}`, `b${'y'.repeat(799_999)}`];
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const parsed = JSON.parse(init.body as string) as { input: string[] };
      return fakeResponse({ ok: true, status: 200, jsonBody: successBody(parsed.input) });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await embedDocuments(texts);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((requestBody(fetchMock.mock.calls[0]).input as string[])).toHaveLength(1);
    expect((requestBody(fetchMock.mock.calls[1]).input as string[])).toHaveLength(1);
    expect(result.embeddings).toHaveLength(2);
  });

  it('makes zero calls for an empty input list', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await embedDocuments([]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({ embeddings: [], tokensUsed: 0 });
  });
});

describe('retry behavior', () => {
  it('retries on 429 and succeeds once the transient failure clears', async () => {
    vi.useFakeTimers();
    const texts = ['retry me'];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse({ ok: false, status: 429, textBody: '{"error":{"message":"rate limited"}}' }))
      .mockResolvedValueOnce(fakeResponse({ ok: true, status: 200, jsonBody: successBody(texts) }));
    vi.stubGlobal('fetch', fetchMock);

    const resultPromise = embedDocuments(texts);
    await vi.advanceTimersByTimeAsync(5_000);
    const result = await resultPromise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.embeddings).toHaveLength(1);
  });

  it('retries on a 500 server error', async () => {
    vi.useFakeTimers();
    const texts = ['retry me too'];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse({ ok: false, status: 500, textBody: '{"error":{"message":"server error"}}' }))
      .mockResolvedValueOnce(fakeResponse({ ok: true, status: 200, jsonBody: successBody(texts) }));
    vi.stubGlobal('fetch', fetchMock);

    const resultPromise = embedDocuments(texts);
    await vi.advanceTimersByTimeAsync(5_000);
    const result = await resultPromise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.embeddings).toHaveLength(1);
  });

  it('does not retry on 400 and fails after exactly one call', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(fakeResponse({ ok: false, status: 400, textBody: '{"error":{"message":"bad request"}}' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(embedDocuments(['bad input'])).rejects.toThrow(AskEmbedApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry on 401 and fails after exactly one call', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(fakeResponse({ ok: false, status: 401, textBody: '{"error":{"message":"invalid key"}}' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(embedDocuments(['unauthorized'])).rejects.toThrow(AskEmbedApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces the parsed error message from the OpenAI error body', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        fakeResponse({ ok: false, status: 400, textBody: '{"error":{"message":"input too long"}}' })
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(embedDocuments(['x'])).rejects.toThrow(/input too long/);
  });
});
