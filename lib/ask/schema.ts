import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  unique,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Drizzle table definitions for the ask agent's ten tables. Query layer only: db/schema.sql
 * is the DDL authority (see docs/ask-agent/03-data-model.md); nothing here runs drizzle-kit.
 */

// ---------------------------------------------------------------------------
// Corpus
// ---------------------------------------------------------------------------

export const corpusMeta = pgTable(
  'corpus_meta',
  {
    id: integer('id').primaryKey().default(1),
    embedModel: text('embed_model').notNull(),
    embedDims: integer('embed_dims').notNull(),
    corpusHash: text('corpus_hash').notNull(),
    ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check('corpus_meta_id_check', sql`${table.id} = 1`)]
);

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  // 'file' | 'asked' (see lib/ask/types.ts DocumentSource). Plain text, matching db/schema.sql;
  // DocumentSource enforces the closed set at the TypeScript boundary, not a Drizzle enum.
  source: text('source').notNull(),
  route: text('route'),
  externalUrl: text('external_url'),
  title: text('title').notNull(),
  kind: text('kind').notNull(),
  verbatimOnly: boolean('verbatim_only').notNull().default(false),
});

export const chunks = pgTable(
  'chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    ordinal: integer('ordinal').notNull(),
    heading: text('heading'),
    content: text('content').notNull(),
    contentHash: text('content_hash').notNull(),
    tokenCount: integer('token_count').notNull(),
    // Fixed at 1024 to match db/schema.sql's vector(1024); Drizzle does not infer dimensions
    // from Postgres, so this number is asserted here exactly as it is in the DDL.
    embedding: vector('embedding', { dimensions: 1024 }).notNull(),
  },
  (table) => [
    index('chunks_document_idx').on(table.documentId),
    // Matches db/schema.sql's `unique (document_id, ordinal)`, expressed here as a table-level
    // unique constraint (not `.unique()` on a single column, since it spans two).
    unique('chunks_document_id_ordinal_key').on(table.documentId, table.ordinal),
  ]
);

// ---------------------------------------------------------------------------
// Identity and traffic
// ---------------------------------------------------------------------------

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    googleSub: text('google_sub').notNull().unique(),
    email: text('email').notNull(),
    name: text('name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('users_email_idx').on(table.email)]
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    identifiedAt: timestamp('identified_at', { withTimezone: true }),
    ipHash: text('ip_hash').notNull(),
    utmSource: text('utm_source'),
    utmMedium: text('utm_medium'),
    utmCampaign: text('utm_campaign'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('sessions_user_idx').on(table.userId)]
);

/** The `[{slug, title, route, score, excerpt}]` snapshot shape from db/schema.sql: what the
 *  agent actually read, not pointers into an index that keeps changing. Compile-time only. */
export interface RetrievedChunkSnapshot {
  slug: string;
  title: string;
  route: string | null;
  score: number;
  excerpt: string;
}

export const turns = pgTable(
  'turns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id').notNull(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    question: text('question'),
    answer: text('answer'),
    // answered | refused_no_grounding | refused_off_task | refused_injection | refused_private |
    // refused_budget. Plain text, same reasoning as documents.source above.
    outcome: text('outcome').notNull(),
    grounding: text('grounding'),
    topScore: real('top_score'),
    // Compile-time shape only (see RetrievedChunkSnapshot above); Postgres still stores jsonb.
    retrieved: jsonb('retrieved').$type<RetrievedChunkSnapshot[]>(),
    askVersion: text('ask_version').notNull(),
    corpusHash: text('corpus_hash').notNull(),
    latencyMs: integer('latency_ms'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    embedTokens: integer('embed_tokens'),
    // pg returns Postgres numeric as a string; kept in Drizzle's default string mode (not
    // { mode: 'number' }) to match lib/ask/db.ts's raw query path rather than lose precision.
    costUsd: numeric('cost_usd', { precision: 10, scale: 6 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('turns_session_idx').on(table.sessionId),
    index('turns_conversation_idx').on(table.conversationId, table.createdAt),
    index('turns_created_idx').on(table.createdAt),
  ]
);

export const gapQuestions = pgTable('gap_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'set null' }),
  turnId: uuid('turn_id').references(() => turns.id, { onDelete: 'set null' }),
  question: text('question').notNull(),
  status: text('status').notNull().default('new'),
  answer: text('answer'),
  publishedSlug: text('published_slug'),
  answerTokenUsedAt: timestamp('answer_token_used_at', { withTimezone: true }),
  publishTokenUsedAt: timestamp('publish_token_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  answeredAt: timestamp('answered_at', { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// Operational state
// ---------------------------------------------------------------------------

export const loginNonces = pgTable(
  'login_nonces',
  {
    nonce: text('nonce').primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('login_nonces_expiry_idx').on(table.expiresAt)]
);

export const rateCounters = pgTable(
  'rate_counters',
  {
    bucket: text('bucket').notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    count: integer('count').notNull().default(1),
  },
  (table) => [
    primaryKey({ columns: [table.bucket, table.windowStart] }),
    index('rate_counters_window_idx').on(table.windowStart),
  ]
);

export const spendReservations = pgTable(
  'spend_reservations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    ipHash: text('ip_hash'),
    // Same string-mode reasoning as turns.costUsd above.
    estUsd: numeric('est_usd', { precision: 10, scale: 6 }).notNull(),
    actualUsd: numeric('actual_usd', { precision: 10, scale: 6 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    committedAt: timestamp('committed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('spend_res_live_idx').on(table.createdAt, table.expiresAt)]
);

// ---------------------------------------------------------------------------
// Inferred row types
// ---------------------------------------------------------------------------

export type CorpusMeta = typeof corpusMeta.$inferSelect;
export type NewCorpusMeta = typeof corpusMeta.$inferInsert;

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

export type Chunk = typeof chunks.$inferSelect;
export type NewChunk = typeof chunks.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type Turn = typeof turns.$inferSelect;
export type NewTurn = typeof turns.$inferInsert;

export type GapQuestion = typeof gapQuestions.$inferSelect;
export type NewGapQuestion = typeof gapQuestions.$inferInsert;

export type LoginNonce = typeof loginNonces.$inferSelect;
export type NewLoginNonce = typeof loginNonces.$inferInsert;

export type RateCounter = typeof rateCounters.$inferSelect;
export type NewRateCounter = typeof rateCounters.$inferInsert;

export type SpendReservation = typeof spendReservations.$inferSelect;
export type NewSpendReservation = typeof spendReservations.$inferInsert;
