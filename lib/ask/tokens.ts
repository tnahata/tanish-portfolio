/**
 * Token estimation for chunk sizing and history budgeting: deliberately an estimate, not a
 * real tokenizer. Isolated here so `token_count` in the database has one definition.
 */

/** Average chars per token for English prose (~4, across GPT/Claude-family tokenizers). Runs
 *  slightly high for code-heavy files, the safe direction: chunks come out smaller, not larger. */
const CHARS_PER_TOKEN = 4;

/** Estimated token count for a string. Never negative, never fractional. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN));
}
