import type { LockedReason } from './types';

/**
 * The user-facing line for each refusal reason. Deterministic and free: no model writes refusal
 * copy, so it cannot hallucinate a reason for its own refusal.
 */
export function refusalCopy(reason: LockedReason, topic?: string): string {
  throw new Error(`not implemented: refusalCopy(${reason}, ${topic ?? 'no topic'})`);
}
