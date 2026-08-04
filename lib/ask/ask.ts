import type { Gated } from './log';
import type { PromptParts } from './prompt';
import type { Identity, LockedReason, RetrievedChunk } from './types';

/** A turn that stopped before generating, with the copy the client should render. */
export interface RefusedTurn {
  kind: 'refused';
  reason: LockedReason;
  text: string;
}

export interface GatedTurn {
  kind: 'gated';
  gate: Gated;
}

/** A turn that cleared every gate and is ready to generate. */
export interface ReadyTurn {
  kind: 'ready';
  turnId: string;
  prompt: PromptParts;
  retrieved: RetrievedChunk[];
}

export type PreparedTurn = RefusedTurn | GatedTurn | ReadyTurn;

/**
 * Everything up to but not including the model call: pre-filter, gate, embed, retrieve, grade,
 * history, claim. Split from runTurn so the route can stream without owning generation.
 */
export function prepareTurn(input: {
  question: string;
  identity: Identity;
}): Promise<PreparedTurn> {
  throw new Error(`not implemented: prepareTurn(${input.question.length} chars)`);
}

/**
 * Generates against a prepared turn and writes the outcome. Emits answer text, or resolves the
 * turn as `unanswerable` when the marker fires.
 */
export function runTurn(turn: ReadyTurn): ReadableStream<string> {
  throw new Error(`not implemented: runTurn(${turn.turnId})`);
}
