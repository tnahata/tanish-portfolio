import type { Identity, LockedReason, PriorTurn, RetrievedChunk } from './types';

/** Refused before the gate ran, or gated. Carries the reason the client renders. */
export interface Gated {
  reason: Extract<LockedReason, 'sign_in_required' | 'rate_limited'>;
  resetsAt: Date | null;
}

/**
 * Counts prior generations for this identity and, if under the limit, inserts the claim row in the
 * same transaction under an advisory lock on the identity. Returns the new turn id, or the gate
 * that stopped it. Claiming before generating is what makes the limit exact.
 */
export function claimTurn(input: {
  identity: Identity;
  question: string;
  model: string;
}): Promise<{ turnId: string } | { gated: Gated }> {
  throw new Error(`not implemented: claimTurn(${input.question.length} chars)`);
}

/**
 * Logs a turn that cost nothing: pre-filter refusals, threshold refusals, and gate hits.
 * `model` stays null, so these never count against either limit.
 */
export function logFreeTurn(input: {
  identity: Identity;
  question: string;
  reason: LockedReason;
  retrieved?: RetrievedChunk[];
}): Promise<void> {
  throw new Error(`not implemented: logFreeTurn(${input.reason})`);
}

/** Writes the answer and the retrieved snapshot onto a claimed turn. */
export function completeTurn(input: {
  turnId: string;
  answer: string;
  retrieved: RetrievedChunk[];
}): Promise<void> {
  throw new Error(`not implemented: completeTurn(${input.turnId})`);
}

/** Locks a claimed turn that generated but produced no answer. Today that is only `unanswerable`. */
export function lockTurn(input: {
  turnId: string;
  reason: Extract<LockedReason, 'unanswerable'>;
  retrieved: RetrievedChunk[];
}): Promise<void> {
  throw new Error(`not implemented: lockTurn(${input.turnId})`);
}

/**
 * Rebuilds conversation history from rows this server wrote. Client-supplied history is forgeable
 * and would put unverified claims in context. Capped by HISTORY_TURNS and HISTORY_MAX_CHARS.
 */
export function loadHistory(identity: Identity): Promise<PriorTurn[]> {
  throw new Error(`not implemented: loadHistory(${identity.userId ?? identity.anonId})`);
}
