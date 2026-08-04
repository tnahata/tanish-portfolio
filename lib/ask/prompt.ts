import type { PriorTurn, StrongGrounding } from './types';

/** A per-request random token. A fixed marker is a literal string a visitor could type. */
export function randomMarker(): string {
  throw new Error('not implemented: randomMarker');
}

/** Thrown when a question contains the context or question delimiter shape. */
export class ForgedDelimiterError extends Error {}

export interface PromptParts {
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  marker: string;
}

/**
 * Builds the system prompt, the delimited context block, and the history messages.
 * Delimiters are randomized per request and input matching them is rejected outright.
 */
export function buildPrompt(input: {
  question: string;
  grounding: StrongGrounding;
  history: PriorTurn[];
}): PromptParts {
  throw new Error(`not implemented: buildPrompt(${input.question.length} chars)`);
}
