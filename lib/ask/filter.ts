import type { LockedReason } from './types';

/**
 * Refuses injection attempts and private-information questions before anything is embedded.
 * Runs first because the answer is the same whatever the corpus holds, and because retrieving on
 * "his salary" pulls exactly the job chunks. Returns null when the question may proceed.
 */
export function preFilter(question: string): Extract<LockedReason, 'injection' | 'private'> | null {
  throw new Error(`not implemented: preFilter(${question.length} chars)`);
}
