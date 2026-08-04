import { describe, expect, it } from 'vitest';

import { generate, withholdMarker } from '../../lib/ask/generate';
import type { PromptParts } from '../../lib/ask/prompt';

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

describe('generate', () => {
  it('streams the answer back as a ReadableStream<string>', () => {
    const parts: PromptParts = {
      system: 'system prompt',
      messages: [{ role: 'user', content: 'what does he build' }],
      marker: MARKER,
    };

    const stream = generate(parts);

    expect(stream).toBeInstanceOf(ReadableStream);
  });
});
