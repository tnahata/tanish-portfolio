import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText, type FinishReason } from 'ai';

import { CHAT_MODEL, MAX_RETRIES } from './config';
import type { PromptParts } from './prompt';

/** `createAnthropic` reads `ANTHROPIC_API_KEY` itself; a missing key surfaces as a stream error. */
function chatModel() {
  return createAnthropic()(CHAT_MODEL);
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

/** Anything but a clean stop means the model did not finish an answer. */
function isIncompleteFinish(finishReason: FinishReason): boolean {
  return finishReason !== 'stop';
}

export interface GenerationOutcome {
  text: string;
  unanswerable: boolean;
}

/** Drains `raw` on its own schedule, independent of whatever the caller does with `stream`. */
async function buildOutcome(
  raw: ReadableStream<string>,
  marker: string,
  finishReason: PromiseLike<FinishReason>,
  getStreamError: () => unknown,
): Promise<GenerationOutcome> {
  let unanswerable = false;
  let text = '';

  const reader = raw.pipeThrough(withholdMarker(marker, () => { unanswerable = true; })).getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += value;
  }

  const streamError = getStreamError();
  if (streamError) throw toError(streamError);
  const reason = await finishReason;
  if (isIncompleteFinish(reason)) {
    throw new Error(`generation did not finish cleanly: ${reason}`);
  }

  return { text, unanswerable };
}

/**
 * Streams the answer and reports the verdict on a separate channel. `stream` is the tokens the
 * caller pipes onward, buffered while output is still a prefix of the marker so the marker never
 * reaches the browser. `outcome` resolves once generation completes with the accumulated text and
 * whether the marker fired, and reads its own tee of the model output so an undrained `stream`
 * cannot hang it.
 */
export function generate(parts: PromptParts): {
  stream: ReadableStream<string>;
  outcome: Promise<GenerationOutcome>;
} {
  let streamError: unknown = null;

  const result = streamText({
    model: chatModel(),
    system: parts.system,
    messages: parts.messages,
    maxRetries: MAX_RETRIES,
    onError: ({ error }) => {
      streamError = error;
    },
  });

  const [forClient, forOutcome] = result.textStream.tee();

  const stream = forClient.pipeThrough(withholdMarker(parts.marker)).pipeThrough(
    new TransformStream<string, string>({
      async flush() {
        if (streamError) throw toError(streamError);
        const finishReason = await result.finishReason;
        if (isIncompleteFinish(finishReason)) {
          throw new Error(`generation did not finish cleanly: ${finishReason}`);
        }
      },
    }),
  );

  const outcome = buildOutcome(forOutcome, parts.marker, result.finishReason, () => streamError);
  outcome.catch(() => {}); // mark handled; the caller's own await/catch still sees the rejection

  return { stream, outcome };
}

/** Longest suffix of `text` that could still grow into the marker, short of a full match. */
function partialMarkerSuffixLength(text: string, marker: string): number {
  const max = Math.min(text.length, marker.length - 1);
  for (let length = max; length > 0; length -= 1) {
    if (text.slice(text.length - length) === marker.slice(0, length)) return length;
  }
  return 0;
}

/**
 * Wraps a token stream so any marker prefix is withheld until it is known not to be the marker.
 * `onMarker`, when given, fires once the moment a full match is found.
 */
export function withholdMarker(marker: string, onMarker?: () => void): TransformStream<string, string> {
  let held = '';
  let absorbingMarkerTrail = false;

  const releaseAfterMarker = (text: string, controller: TransformStreamDefaultController<string>) => {
    const contentStart = text.search(/\S/);
    if (contentStart === -1) {
      absorbingMarkerTrail = true;
      return;
    }
    controller.enqueue(text.slice(contentStart));
    absorbingMarkerTrail = false;
  };

  return new TransformStream<string, string>({
    transform(chunk, controller) {
      if (absorbingMarkerTrail) {
        releaseAfterMarker(chunk, controller);
        return;
      }

      const combined = held + chunk;
      const markerIndex = combined.indexOf(marker);
      if (markerIndex !== -1) {
        if (markerIndex > 0) controller.enqueue(combined.slice(0, markerIndex));
        held = '';
        onMarker?.();
        releaseAfterMarker(combined.slice(markerIndex + marker.length), controller);
        return;
      }

      const suffixLength = partialMarkerSuffixLength(combined, marker);
      const emitLength = combined.length - suffixLength;
      if (emitLength > 0) controller.enqueue(combined.slice(0, emitLength));
      held = combined.slice(emitLength);
    },
    flush(controller) {
      if (!absorbingMarkerTrail && held.length > 0) {
        controller.enqueue(held);
      }
    },
  });
}
