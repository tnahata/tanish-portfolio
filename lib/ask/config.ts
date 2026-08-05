/**
 * Every tunable in one place, as code constants and never environment variables: a threshold that
 * differs between environments is unreproducible. Changing EMBED_MODEL or EMBED_DIMS invalidates
 * the index and both thresholds; re-ingest and re-tune together.
 */

export const EMBED_MODEL = 'text-embedding-3-large';
export const EMBED_DIMS = 1024;
export const CHAT_MODEL = 'claude-sonnet-5';

/** Retrieval ceiling. Context is filtered by T_STRONG, so this is not the context size. */
export const TOP_K = 8;

/** At or above T_STRONG: generate. Below T_FLOOR: off topic. Between: related but too thin. */
export const T_STRONG = 0.4;
export const T_FLOOR = 0.25;

/** Per-document ceiling on the strong-grounded context, so one file can't crowd out the rest. */
export const MAX_CONTEXT_CHUNKS_PER_DOC = 3;

/** Generations allowed before sign-in, per anonymous cookie. */
export const FREE_TURNS = 1;

/** Generations allowed per signed-in user per calendar day (UTC). */
export const DAILY_LIMIT = 20;

export const HISTORY_TURNS = 3;
export const HISTORY_MAX_CHARS = 4000;

export const MAX_QUESTION_CHARS = 500;

/** Passed to the AI SDK explicitly; its own default is 2 and silence about it is how retries surprise you. */
export const MAX_RETRIES = 2;

export const ANON_COOKIE_NAME = 'ask_anon';
export const ANON_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
