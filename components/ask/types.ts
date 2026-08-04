import type { LockedReason } from '@/lib/ask/types';

/** The four `data-*`/`error` chunk shapes `app/api/ask/route.ts` writes, plus the standard text parts. */
export type AskStreamChunk =
  | { type: 'text-start'; id: string }
  | { type: 'text-delta'; id: string; delta: string }
  | { type: 'text-end'; id: string }
  | { type: 'data-status'; data: { stage: 'received' | 'generating' } }
  | { type: 'data-refusal'; data: { reason: LockedReason; text: string } }
  | { type: 'data-gate'; data: { reason: Extract<LockedReason, 'sign_in_required' | 'rate_limited'>; resetsAt: string | null } }
  | { type: 'error'; errorText: string };

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
