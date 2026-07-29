import { createHash } from 'crypto';

/** Refusal copy for the three outcomes `askOnce()` can produce, never fed into a prompt.
 *  Topic-agnostic by design; see docs/ask-agent/06-personality.md. */

export type AskRefusalOutcome = 'refused_no_grounding' | 'refused_off_task' | 'refused_unanswerable';

export interface RefusalCopy {
  message: string;
  /** Whether the UI offers to capture the question for the gap queue: `refused_off_task` never
   *  does ("not in scope"); the other two do ("close but not answered"). */
  offerCapture: boolean;
}

/** Exported (not just used locally) so lib/ask/prompt.ts's ASK_VERSION hash covers this
 *  user-visible copy: docs/ask-agent/06-personality.md requires refusal text in the stamp. */
export const NO_GROUNDING_VARIANTS: readonly string[] = [
  "Nothing in the corpus gets close enough to answer that with confidence. Want me to flag it for Tanish to write up?",
  "The corpus doesn't cover that one, not close enough to answer honestly. I can send the question along if you'd like a real answer.",
  'That is not something the corpus has enough on yet. Happy to capture it for Tanish instead of guessing.',
];

export const OFF_TASK_VARIANTS: readonly string[] = [
  "That's outside what this agent covers: it only answers questions about Tanish and his work.",
  'Not something in scope here. Ask about his projects, background, or how he works instead.',
  'This agent sticks to Tanish and his work, and that question falls outside it.',
];

export const UNANSWERABLE_VARIANTS: readonly string[] = [
  "I found material that's topically close, but it doesn't actually answer this. Want me to flag it for Tanish?",
  'The closest passages do not settle this one specifically. I can send the question along instead of guessing.',
  'Nothing I retrieved actually answers that, even though it is in the neighborhood. Happy to capture it for a follow-up.',
];

/** Selects a variant deterministically from `question`'s hash, so the same question always
 *  reads the same line: consistent, not a slot machine. */
function selectVariant(variants: readonly string[], question: string): string {
  const digest = createHash('sha256').update(question).digest();
  const index = digest[0] % variants.length;
  return variants[index];
}

function assertNeverRefusalOutcome(outcome: never): never {
  throw new Error(`Unhandled ask refusal outcome: ${JSON.stringify(outcome)}`);
}

/** Deterministic refusal copy for `outcome`, selected by hashing `question`. Exhaustively
 *  switches over `AskRefusalOutcome` so a future refusal bucket is a compile error here. */
export function refusalCopyFor(outcome: AskRefusalOutcome, question: string): RefusalCopy {
  switch (outcome) {
    case 'refused_no_grounding':
      return { message: selectVariant(NO_GROUNDING_VARIANTS, question), offerCapture: true };
    case 'refused_off_task':
      return { message: selectVariant(OFF_TASK_VARIANTS, question), offerCapture: false };
    case 'refused_unanswerable':
      return { message: selectVariant(UNANSWERABLE_VARIANTS, question), offerCapture: true };
    default:
      return assertNeverRefusalOutcome(outcome);
  }
}
