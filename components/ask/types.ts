import type { LockedReason } from '@/lib/ask/types';

/** One assistant response, in whichever shape the turn resolved to. Null while still awaiting the first part. */
export type TurnResponse =
  | { kind: 'answer'; text: string; done: boolean }
  | { kind: 'refusal'; reason: LockedReason; text: string }
  | { kind: 'gate'; reason: Extract<LockedReason, 'sign_in_required' | 'rate_limited'>; resetsAt: string | null }
  | { kind: 'error'; message: string }
  | null;

export interface ConversationTurn {
  id: string;
  question: string;
  response: TurnResponse;
  stage: 'received' | 'generating' | null;
}
