import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AnthropicApiKeyMissingError,
  AnthropicRequestError,
  streamGeneration,
  type GenerateConfig,
} from '@/lib/ask/generate';

function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function sseStream(rawEvents: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index >= rawEvents.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(rawEvents[index]));
      index += 1;
    },
  });
}

function okResponse(rawEvents: string[]): Response {
  return { ok: true, status: 200, body: sseStream(rawEvents), text: async () => '' } as unknown as Response;
}

function errorResponse(status: number, body = 'error'): Response {
  return { ok: false, status, body: null, text: async () => body } as unknown as Response;
}

async function drain(textStream: AsyncIterable<string>): Promise<string[]> {
  const chunks: string[] = [];
  for await (const chunk of textStream) chunks.push(chunk);
  return chunks;
}

const BASE_CONFIG: GenerateConfig = {
  system: 'be terse',
  messages: [{ role: 'user', content: 'hi' }],
  unanswerableMarker: '<unanswerable-deadbeef/>',
};

function answerEvents(text: string, inputTokens = 100, outputTokens = 5): string[] {
  return [
    sseEvent({ type: 'message_start', message: { usage: { input_tokens: inputTokens } } }),
    sseEvent({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }),
    sseEvent({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } }),
    sseEvent({ type: 'content_block_stop', index: 0 }),
    sseEvent({ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: outputTokens } }),
    sseEvent({ type: 'message_stop' }),
  ];
}

describe('streamGeneration', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.ANTHROPIC_API_KEY = originalKey;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('throws AnthropicApiKeyMissingError when ANTHROPIC_API_KEY is unset', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const stream = streamGeneration(BASE_CONFIG);
    await expect(drain(stream.textStream)).rejects.toThrow(AnthropicApiKeyMissingError);
  });

  it('streams text deltas and resolves complete with text, tokens, and cost', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(answerEvents('ESMON parses binary data.', 100, 5)));
    global.fetch = fetchMock as unknown as typeof fetch;

    const stream = streamGeneration(BASE_CONFIG);
    const chunks = await drain(stream.textStream);
    const complete = await stream.complete;

    expect(chunks.join('')).toBe('ESMON parses binary data.');
    expect(complete.text).toBe('ESMON parses binary data.');
    expect(complete.isUnanswerable).toBe(false);
    expect(complete.stopReason).toBe('end_turn');
    expect(complete.inputTokens).toBe(100);
    expect(complete.outputTokens).toBe(5);
    expect(complete.costUsd).toBeCloseTo((100 / 1_000_000) * 3 + (5 / 1_000_000) * 15, 10);
  });

  it('treats the trimmed complete response as unanswerable only on exact equality', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(answerEvents(`  ${BASE_CONFIG.unanswerableMarker}\n`)));
    global.fetch = fetchMock as unknown as typeof fetch;

    const stream = streamGeneration(BASE_CONFIG);
    await drain(stream.textStream);
    const complete = await stream.complete;

    expect(complete.isUnanswerable).toBe(true);
  });

  it('does not misread an answer that legitimately mentions the marker as a refusal', async () => {
    const mentioning = `The refusal marker looks like ${BASE_CONFIG.unanswerableMarker} when the agent can't answer.`;
    const fetchMock = vi.fn().mockResolvedValue(okResponse(answerEvents(mentioning)));
    global.fetch = fetchMock as unknown as typeof fetch;

    const stream = streamGeneration(BASE_CONFIG);
    await drain(stream.textStream);
    const complete = await stream.complete;

    expect(complete.isUnanswerable).toBe(false);
    expect(complete.text).toBe(mentioning);
  });

  it('retries on a 429 and succeeds once the retry clears', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(429, 'rate limited'))
      .mockResolvedValueOnce(okResponse(answerEvents('ok')));
    global.fetch = fetchMock as unknown as typeof fetch;
    vi.useFakeTimers();

    const stream = streamGeneration(BASE_CONFIG);
    const drainPromise = drain(stream.textStream);
    await vi.runAllTimersAsync();
    const chunks = await drainPromise;

    expect(chunks.join('')).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries on a 5xx the same way it retries on a 429', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(503, 'overloaded'))
      .mockResolvedValueOnce(okResponse(answerEvents('ok')));
    global.fetch = fetchMock as unknown as typeof fetch;
    vi.useFakeTimers();

    const stream = streamGeneration(BASE_CONFIG);
    const drainPromise = drain(stream.textStream);
    await vi.runAllTimersAsync();
    await drainPromise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry on a non-retryable 4xx status', async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(400, 'bad request'));
    global.fetch = fetchMock as unknown as typeof fetch;

    const stream = streamGeneration(BASE_CONFIG);
    await expect(drain(stream.textStream)).rejects.toThrow(AnthropicRequestError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
