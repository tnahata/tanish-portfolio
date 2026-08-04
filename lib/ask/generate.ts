import type { PromptParts } from './prompt';

export interface GenerationResult {
  /** Null when the model emitted the unanswerable marker instead of an answer. */
  text: string | null;
  unanswerable: boolean;
}

/**
 * Streams the answer. Buffers output while it is still a prefix of the marker so the marker never
 * reaches the browser, and surfaces stream errors that the SDK would otherwise swallow.
 */
export function generate(parts: PromptParts): ReadableStream<string> {
  throw new Error(`not implemented: generate(marker ${parts.marker})`);
}

/** Wraps a token stream so any marker prefix is withheld until it is known not to be the marker. */
export function withholdMarker(marker: string): TransformStream<string, string> {
  throw new Error(`not implemented: withholdMarker(${marker})`);
}
