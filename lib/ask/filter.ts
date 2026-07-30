export const FILTER_REASONS = ['injection', 'private'] as const;
export type FilterReason = (typeof FILTER_REASONS)[number];

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all|any)?\s*(previous|prior|above)\s+instructions/i,
  /disregard\s+(all|any)?\s*(previous|prior|above)\s+(instructions|prompt)/i,
  /reveal\s+(your|the)\s+(system\s+)?(prompt|instructions)/i,
  /(what\s+is|show\s+me)\s+your\s+system\s+prompt/i,
  /you\s+are\s+now\s+(a|an)\b/i,
  /act\s+as\s+(a\s+different|another)\s+(ai|assistant|system)/i,
  /pretend\s+(you\s+are|to\s+be)\b/i,
  /\bjailbreak\b/i,
  /\bdeveloper\s+mode\b/i,
  /new\s+instructions?:/i,
];

const PRIVATE_PATTERNS: RegExp[] = [
  /\bsocial\s+security\b|\bssn\b/i,
  /\bhome\s+address\b|where\s+does\s+he\s+live/i,
  /\bphone\s+number\b/i,
  /\bpassport\s+number\b|\bvisa\s+number\b/i,
  /\bbank\s+account\b|\bcredit\s+card\b|\brouting\s+number\b/i,
  /\bdate\s+of\s+birth\b|\bbirthdate\b/i,
];

/**
 * UX, not a control: base64, homoglyphs, and other languages walk straight through.
 * The real defenses are prompt delimiting (prompt.ts) and the model having no tools.
 */
export function filterQuestion(question: string): FilterReason | null {
  if (INJECTION_PATTERNS.some((pattern) => pattern.test(question))) return 'injection';
  if (PRIVATE_PATTERNS.some((pattern) => pattern.test(question))) return 'private';
  return null;
}
