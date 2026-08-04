import { streamText } from 'ai';
import { describe, expect, it, vi } from 'vitest';

import { generate, withholdMarker } from '../../lib/ask/generate';
import type { PromptParts } from '../../lib/ask/prompt';
import type { FinishReason } from 'ai';

vi.mock('ai', () => ({ streamText: vi.fn() }));

const MARKER = 'XJ7QK2M9';

/** Drives a TransformStream end to end and collects every chunk the readable side emits. */
async function runTransform(marker: string, chunks: string[]): Promise<string[]> {
  const transform = withholdMarker(marker);
  const writer = transform.writable.getWriter();
  const reader = transform.readable.getReader();
  const output: string[] = [];

  const readLoop = (async () => {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      output.push(value);
    }
  })();

  for (const chunk of chunks) {
    await writer.write(chunk);
  }
  await writer.close();
  await readLoop;

  return output;
}

describe('withholdMarker', () => {
  it('withholds the marker when it arrives as a single chunk with nothing else in the stream', async () => {
    const output = await runTransform(MARKER, [MARKER]);

    expect(output.join('')).toBe('');
  });

  it('withholds the marker when it arrives split across three separate stream chunks', async () => {
    const output = await runTransform(MARKER, [MARKER.slice(0, 2), MARKER.slice(2, 5), MARKER.slice(5)]);

    expect(output.join('')).toBe('');
  });

  it('emits a held prefix in full once more input proves it is not becoming the marker', async () => {
    const heldPrefix = MARKER.slice(0, 3);
    const divergingChunk = 'Z';

    const output = await runTransform(MARKER, [heldPrefix, divergingChunk]);

    expect(output.join('')).toBe(heldPrefix + divergingChunk);
  });

  it('passes ordinary text through unchanged', async () => {
    const output = await runTransform(MARKER, ['hello ', 'world']);

    expect(output.join('')).toBe('hello world');
  });

  it('passes real answer text through and withholds only the marker that follows at the end', async () => {
    const answer = 'The answer is 42. ';

    const output = await runTransform(MARKER, [answer, MARKER]);

    expect(output.join('')).toBe(answer);
  });

  it('withholds a marker that begins partway through a chunk containing real answer text', async () => {
    const answer = 'Here it is: ';
    const firstChunk = answer + MARKER.slice(0, 3);
    const secondChunk = MARKER.slice(3);

    const output = await runTransform(MARKER, [firstChunk, secondChunk]);

    expect(output.join('')).toBe(answer);
  });
});

type StreamTextOptions = Parameters<typeof streamText>[0];

function textStreamOf(chunks: string[]): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

/** Fakes just the two StreamTextResult fields generate() reads: textStream and finishReason. */
function mockStreamText(
  build: (options: StreamTextOptions) => { textStream: ReadableStream<string>; finishReason: Promise<FinishReason> },
): void {
  vi.mocked(streamText).mockImplementation(
    ((options: StreamTextOptions) => build(options)) as unknown as typeof streamText,
  );
}

describe('generate', () => {
  const parts: PromptParts = {
    system: 'system prompt',
    messages: [{ role: 'user', content: 'what does he build' }],
    marker: MARKER,
  };

  it('returns a stream and a separate outcome promise, so empty streamed output is never mistaken for a verdict', () => {
    mockStreamText(() => ({
      textStream: textStreamOf(['he builds agents']),
      finishReason: Promise.resolve('stop'),
    }));

    const result = generate(parts);

    expect(result.stream).toBeInstanceOf(ReadableStream);
    expect(result.outcome).toBeInstanceOf(Promise);
  });

  it('rejects outcome when the underlying stream errors, instead of resolving as a successful empty answer', async () => {
    mockStreamText((options) => {
      const finishReason = new Promise<FinishReason>((resolve) => {
        queueMicrotask(() => {
          options.onError?.({ error: new Error('upstream stream failed') });
          resolve('error');
        });
      });
      return { textStream: textStreamOf([]), finishReason };
    });

    await expect(generate(parts).outcome).rejects.toBeTruthy();
  });

  it('rejects outcome when finishReason is length, instead of resolving as a successful answer', async () => {
    mockStreamText(() => ({
      textStream: textStreamOf(['he builds ']),
      finishReason: Promise.resolve('length'),
    }));

    await expect(generate(parts).outcome).rejects.toBeTruthy();
  });

  it('rejects outcome when finishReason is content-filter, instead of resolving as a successful answer', async () => {
    mockStreamText(() => ({
      textStream: textStreamOf(['he builds ']),
      finishReason: Promise.resolve('content-filter'),
    }));

    await expect(generate(parts).outcome).rejects.toBeTruthy();
  });
});
