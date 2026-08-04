import type { LockedReason } from './types';

type PreFilterReason = Extract<LockedReason, 'injection' | 'private'>;

/** The context/question fence shapes: `<ctx-`, `</ctx-`, `<q-`, `</q-`, any case. */
const FORGED_DELIMITER = /<\/?(?:ctx|q)-/i;

const INSTRUCTION_OVERRIDE =
  /\b(?:ignore|disregard|forget)\b[\s\S]{0,40}\b(?:previous|prior|above|earlier|all)\b[\s\S]{0,20}\binstructions?\b/i;

/** Direct references to the system prompt or the model's own instructions. */
const PROMPT_OR_INSTRUCTION_MENTION =
  /\bsystem\s*prompt\b|\byour\s+(?:system\s+)?prompt\b|\byour\s+instructions\b/i;

const REPEAT_CONTEXT_ABOVE =
  /\b(?:reveal|repeat|print|output|show|leak|summarize|paraphrase)\b[\s\S]{0,40}\b(?:the\s+)?(?:text|prompt|everything|context)\s+above\b/i;

const MODE_REASSIGNMENT = /\b(?:developer|debug|admin|maintenance|god|dan|jailbreak)\s+mode\b/i;

/** Instructing the agent to speak as Tanish rather than describe him. */
const PERSONA_SWAP =
  /\b(?:pretend|act\s+as|roleplay\s+as|you\s+are\s+now|become)\b[\s\S]{0,30}\btanish\b/i;

const FALSE_AUTHORITY = /\bauthorized\s+to\s+(?:run|perform|access|bypass|override)\b/i;
const SECURITY_AUDIT_PRETEXT = /\bsecurity\s+audit\b/i;
const CONTEXT_EXFILTRATION = /\boutput\s+the\s+(?:full\s+)?(?:retrieved\s+)?context\b/i;

/** Pressuring the agent to answer anyway instead of refusing. */
const REFUSAL_OVERRIDE = /\bjust\s+guess\b|\bguess\b[\s\S]{0,30}\bbetter\s+than\b[\s\S]{0,20}\brefus/i;

const RESTRICTION_BYPASS =
  /\bnot\s+restricted\s+by\b|\bif\s+you\s+(?:were|are)\s+not\s+(?:restricted|limited|bound)\b|\bwithout\s+(?:your\s+)?(?:restrictions?|rules|guardrails|limits)\b/i;

const INJECTION_PATTERNS: readonly RegExp[] = [
  FORGED_DELIMITER,
  INSTRUCTION_OVERRIDE,
  PROMPT_OR_INSTRUCTION_MENTION,
  REPEAT_CONTEXT_ABOVE,
  MODE_REASSIGNMENT,
  PERSONA_SWAP,
  FALSE_AUTHORITY,
  SECURITY_AUDIT_PRETEXT,
  CONTEXT_EXFILTRATION,
  REFUSAL_OVERRIDE,
  RESTRICTION_BYPASS,
];

const COMPENSATION =
  /\b(?:salary|salaries|compensation|take[\s-]?home\s+pay|pay\s+(?:range|rate)|total\s+comp)\b/i;

const HOME_ADDRESS =
  /\b(?:home|street|residential|mailing)\s+address\b|\b(?:his|tanish(?:'|’)?s)\s+address\b|\bwhere\s+does\s+(?:he|tanish)\s+live\b/i;

const PHONE_NUMBER =
  /\bphone\s+number\b|\bcell\s+number\b|\b(?:his|tanish(?:'|’)?s)\s+(?:phone|cell)\b/i;

/** Visa status and transferability are disclosed in faq.md; only immigration beyond that is private. */
const IMMIGRATION = /\bimmigration\b/i;

/** Phrase-matched so it never fires on "health check"/"healthcheck" endpoint questions. */
const HEALTH =
  /\bhealth\s+condition(?:s)?\b|\b(?:good|poor|bad|declining|failing)\s+health\b|\bmental\s+health\b|\bmedical\s+(?:condition|history|issue)s?\b|\b(?:a|any|his|tanish(?:'|’)?s)\s+disabilit(?:y|ies)\b|\bis\s+(?:he|tanish)\s+disabled\b|\bdiagnosed\s+with\b|\bmedical\s+diagnosis\b|\billness\b|\b(?:his|tanish(?:'|’)?s)\s+health\b/i;

const FAMILY =
  /\b(?:his|tanish(?:'|’)?s)\s+(?:family|kids|children|parents|siblings?)\b|\bis\s+(?:he|tanish)\s+married\b|\b(?:his\s+)?(?:wife|husband|spouse|girlfriend|boyfriend)\b/i;

const PRIVATE_PATTERNS: readonly RegExp[] = [
  COMPENSATION,
  HOME_ADDRESS,
  PHONE_NUMBER,
  IMMIGRATION,
  HEALTH,
  FAMILY,
];

function matchesAny(patterns: readonly RegExp[], question: string): boolean {
  return patterns.some((pattern) => pattern.test(question));
}

/**
 * Refuses injection attempts and private-information questions before anything is embedded.
 * Runs first because the answer is the same whatever the corpus holds, and because retrieving on
 * "his salary" pulls exactly the job chunks. Returns null when the question may proceed.
 */
export function preFilter(question: string): PreFilterReason | null {
  if (matchesAny(INJECTION_PATTERNS, question)) return 'injection';
  if (matchesAny(PRIVATE_PATTERNS, question)) return 'private';
  return null;
}
