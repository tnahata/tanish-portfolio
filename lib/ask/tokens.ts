/**
 * Token estimation for chunk sizing and history budgeting.
 *
 * Deliberately an estimate, not OpenAI's or Anthropic's real tokenizer. Nothing in the
 * system is correct-or-incorrect based on this number: chunk targets are soft, and the
 * history budget has an order of magnitude of headroom. Pulling in a tokenizer for either
 * would buy accuracy nobody spends.
 *
 * Isolated here so it can be swapped for a real tokenizer without touching callers, and so
 * `token_count` in the database has exactly one definition.
 */

/**
 * Average characters per token for English prose. Empirically ~4 across GPT/Claude-family
 * tokenizers; code and dense punctuation run lower, which makes this a slight overestimate
 * of chunk capacity for snippet-heavy files. That direction is the safe one: chunks come out
 * a little smaller than the target rather than a little larger.
 */
const CHARS_PER_TOKEN = 4;

/** Estimated token count for a string. Never negative, never fractional. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN));
}
