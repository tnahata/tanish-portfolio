import { boolean, index, jsonb, pgTable, text, timestamp, uuid, vector } from 'drizzle-orm/pg-core';

import { EMBED_DIMS } from './config';
import type { ChunkMetadata, LockedReason, RetrievedChunk } from './types';

/** Mirrors db/schema.sql. The two must be changed together; schema.sql is the source of truth. */

export const chunks = pgTable('chunks', {
  id: text('id').primaryKey(),
  content: text('content').notNull(),
  metadata: jsonb('metadata').$type<ChunkMetadata>().notNull(),
  embedding: vector('embedding', { dimensions: EMBED_DIMS }).notNull(),
});

export const userInteractions = pgTable(
  'user_interactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id'),
    anonId: text('anon_id'),
    question: text('question').notNull(),
    answer: text('answer'),
    retrieved: jsonb('retrieved').$type<RetrievedChunk[]>(),
    isFree: boolean('is_free').notNull().default(false),
    /** Non-null exactly when a model was called. Both gates count on it. */
    model: text('model'),
    lockedReason: text('locked_reason').$type<LockedReason>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('user_interactions_user_created_idx').on(t.userId, t.createdAt.desc()),
    index('user_interactions_anon_created_idx').on(t.anonId, t.createdAt.desc()),
  ],
);
