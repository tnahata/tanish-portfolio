import { sql } from 'drizzle-orm';
import { check, date, integer, jsonb, numeric, pgTable, text, timestamp, unique, uuid, vector } from 'drizzle-orm/pg-core';

const EMBEDDING_DIMENSIONS = 1024;

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  route: text('route'),
  kind: text('kind').notNull(),
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
    embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
  },
  (t) => [unique().on(t.documentId, t.ordinal)],
);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkUserId: text('clerk_user_id').notNull().unique(),
  msgCount: integer('msg_count').notNull().default(0),
  windowStart: date('window_start').notNull().default(sql`current_date`),
  dailyLimit: integer('daily_limit').notNull().default(20),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
});

export const ASK_EVENT_TYPES = [
  'question_received',
  'retrieved',
  'graded',
  'generation_started',
  'generated',
  'refused',
  'captured',
  'error',
  'ingest_completed',
] as const;

export type AskEventType = (typeof ASK_EVENT_TYPES)[number];

const askEventTypeEnumSql = ASK_EVENT_TYPES.map((value) => `'${value}'`).join(', ');

export const askEvents = pgTable(
  'ask_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id'),
    userId: uuid('user_id').references(() => users.id),
    turnId: uuid('turn_id'),
    seq: integer('seq').notNull(),
    event: text('event').notNull().$type<AskEventType>(),
    payload: jsonb('payload').notNull().default({}),
    costUsd: numeric('cost_usd', { precision: 10, scale: 6 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.turnId, t.seq),
    check('ask_events_event_check', sql`${t.event} in (${sql.raw(askEventTypeEnumSql)})`),
  ],
);

export type DocumentRow = typeof documents.$inferSelect;
export type NewDocumentRow = typeof documents.$inferInsert;
export type ChunkRow = typeof chunks.$inferSelect;
export type NewChunkRow = typeof chunks.$inferInsert;
export type UserRow = typeof users.$inferSelect;
export type AskEventRow = typeof askEvents.$inferSelect;
export type NewAskEventRow = typeof askEvents.$inferInsert;
