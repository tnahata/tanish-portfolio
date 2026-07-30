import { createHash } from 'node:crypto';

export const REFUSAL_REASONS = ['off_task', 'no_grounding', 'unanswerable', 'injection', 'private'] as const;
export type RefusalReason = (typeof REFUSAL_REASONS)[number];

export interface RefusalContext {
  reason: RefusalReason;
  question: string;
  /** Title of the closest-scoring document; only meaningful for `no_grounding`. */
  closestTitle?: string | null;
}

const OFF_TASK_VARIANTS = [
  "That's outside what this agent covers. Try asking about his projects, his work, or how he thinks about engineering.",
  'Not something the corpus touches. Ask about ESMON, Discovery Agent, HybridFit, or his background instead.',
  'Off scope for this agent. It only answers from what he has written.',
];

const UNANSWERABLE_VARIANTS = [
  "The retrieved material doesn't answer that. Want it sent to him?",
  "Can't answer that from what's here. I can pass the question along.",
  'Nothing in what I found actually covers this. Send it to him instead?',
];

const INJECTION_VARIANTS = [
  "This agent only answers from Tanish's corpus. It has no instructions to override.",
  'Not something it does. It reads corpus content, nothing else.',
  'It only answers questions about him from what he has written, not requests like this.',
];

const PRIVATE_VARIANTS = [
  "That's not something this agent discusses.",
  'Not covered here. Some things are simply out of scope.',
  'This agent does not go into that.',
];

/** No `no_grounding` template: it always names the closest source, built in `selectRefusal`. */
function questionHashIndex(question: string, modulus: number): number {
  const digest = createHash('sha256').update(question.trim().toLowerCase()).digest('hex');
  return parseInt(digest.slice(0, 8), 16) % modulus;
}

function pick(variants: string[], question: string): string {
  return variants[questionHashIndex(question, variants.length)];
}

function noGroundingVariant(question: string, closestTitle: string | null | undefined): string {
  const variants = closestTitle
    ? [
        `Closest I have is "${closestTitle}", but it doesn't answer this. Want it sent to him?`,
        `"${closestTitle}" is in the neighborhood but doesn't cover this directly. I can send the question along.`,
        `Nothing here answers that cleanly; "${closestTitle}" comes closest. Happy to pass it to him.`,
      ]
    : [
        "The corpus is close to this but doesn't actually answer it. Want it sent to him?",
        "Nothing here answers that directly, though it's in the neighborhood. I can send the question along.",
        'This is not covered clearly enough to answer straight. Happy to pass it to him.',
      ];
  return pick(variants, question);
}

/** Deterministic by hash of the question, so the same question always refuses identically. Never enters a prompt. */
export function selectRefusal(context: RefusalContext): string {
  switch (context.reason) {
    case 'off_task':
      return pick(OFF_TASK_VARIANTS, context.question);
    case 'no_grounding':
      return noGroundingVariant(context.question, context.closestTitle);
    case 'unanswerable':
      return pick(UNANSWERABLE_VARIANTS, context.question);
    case 'injection':
      return pick(INJECTION_VARIANTS, context.question);
    case 'private':
      return pick(PRIVATE_VARIANTS, context.question);
    default: {
      const exhaustive: never = context.reason;
      throw new Error(`Unhandled refusal reason: ${String(exhaustive)}`);
    }
  }
}
