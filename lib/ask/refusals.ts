import type { LockedReason } from './types';
import { DAILY_LIMIT, FREE_TURNS } from './config';

type RefusalCopy = (topic?: string) => string;

const withTopic = (base: string, topic?: string): string => (topic ? `${base} (${topic}).` : `${base}.`);

const FREE_TURNS_CLAUSE =
  FREE_TURNS === 1 ? 'The first question is free' : `The first ${FREE_TURNS} questions are free`;

/** One line per `LockedReason`. `Record` makes a missing reason a compile error. */
const REFUSAL_COPY: Record<LockedReason, RefusalCopy> = {
  injection: () => "That's not a question I'll answer. Ask about Tanish's work instead.",
  private: (topic) =>
    topic
      ? `Not something he'll discuss here (${topic}). Email him directly for that.`
      : "Not something he'll discuss here. Email him directly for that.",
  sign_in_required: () => `Sign in to keep going. ${FREE_TURNS_CLAUSE}; the rest need an account.`,
  rate_limited: () =>
    `You've reached today's ${DAILY_LIMIT}-question limit. Try again tomorrow, or email him directly.`,
  off_topic: (topic) => withTopic('Not something this agent answers', topic),
  no_grounding: (topic) => withTopic("Not something he's written about", topic),
  unanswerable: (topic) => withTopic("The corpus doesn't answer that", topic),
};

/**
 * The user-facing line for each refusal reason. Deterministic and free: no model writes refusal
 * copy, so it cannot hallucinate a reason for its own refusal.
 */
export function refusalCopy(reason: LockedReason, topic?: string): string {
  return REFUSAL_COPY[reason](topic);
}
