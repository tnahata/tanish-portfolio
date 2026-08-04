import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';

import { CHAT_MODEL, DAILY_LIMIT, EMBED_DIMS, EMBED_MODEL, FREE_TURNS, HISTORY_MAX_CHARS, HISTORY_TURNS } from '../../lib/ask/config';
import { claimTurn, completeTurn, loadHistory, lockTurn, logFreeTurn } from '../../lib/ask/log';
import type { ChunkMetadata, Identity, LockedReason, RetrievedChunk } from '../../lib/ask/types';

const TEST_DATABASE_URL = process.env.DATABASE_URL;

if (!TEST_DATABASE_URL) {
  console.warn(
    '[log.test.ts] DATABASE_URL is not set; skipping every log.ts Postgres-backed test. Start ' +
      '`docker run --rm -d -e POSTGRES_PASSWORD=postgres -p 55433:5432 pgvector/pgvector:pg16`, ' +
      'apply db/schema.sql, and export DATABASE_URL before running the suite.',
  );
}

const pool = TEST_DATABASE_URL ? new Pool({ connectionString: TEST_DATABASE_URL }) : undefined;

function requirePool(): Pool {
  if (!pool) {
    throw new Error('Postgres pool requested without DATABASE_URL set');
  }
  return pool;
}

const RUN_PREFIX = `ask-log-test-${randomUUID()}::`;

function question(label: string): string {
  return `${RUN_PREFIX}${label}`;
}

function metadata(overrides: Partial<ChunkMetadata> = {}): ChunkMetadata {
  return {
    file: 'about.md',
    heading: 'Role',
    title: 'About',
    embedModel: EMBED_MODEL,
    dims: EMBED_DIMS,
    contentHash: 'hash-a',
    ...overrides,
  };
}

function retrievedFixture(): RetrievedChunk[] {
  return [{ id: 'about#role', content: 'he builds agents', score: 0.6, metadata: metadata() }];
}

interface UserInteractionRow {
  id: string;
  user_id: string | null;
  anon_id: string | null;
  question: string;
  answer: string | null;
  model: string | null;
  locked_reason: LockedReason | null;
  created_at: Date;
}

async function insertInteraction(row: {
  id: string;
  identity: Identity;
  question: string;
  answer?: string | null;
  model?: string | null;
  lockedReason?: LockedReason | null;
  createdAt?: Date;
}): Promise<void> {
  await requirePool().query(
    `insert into user_interactions (id, user_id, anon_id, question, answer, model, locked_reason, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      row.id,
      row.identity.userId,
      row.identity.anonId,
      row.question,
      row.answer ?? null,
      row.model ?? null,
      row.lockedReason ?? null,
      row.createdAt ?? new Date(),
    ],
  );
}

async function fetchInteraction(id: string): Promise<UserInteractionRow | undefined> {
  const { rows } = await requirePool().query<UserInteractionRow>('select * from user_interactions where id = $1', [id]);
  return rows[0];
}

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60_000);
}

describe.skipIf(!TEST_DATABASE_URL)('log.ts against a live database', () => {
  afterAll(async () => {
    await requirePool().query('delete from user_interactions where question like $1', [`${RUN_PREFIX}%`]);
    await pool?.end();
  });

  describe('claimTurn', () => {
    it('writes the claim row, with model set, before any generation happens', async () => {
      const identity: Identity = { userId: null, anonId: randomUUID() };

      const result = await claimTurn({ identity, question: question('claim-before-generation'), model: CHAT_MODEL });
      if ('gated' in result) {
        throw new Error(`expected the turn to be claimed, got gated: ${result.gated.reason}`);
      }

      const row = await fetchInteraction(result.turnId);
      expect(row?.model).toBe(CHAT_MODEL);
      expect(row?.answer).toBeNull();
      expect(row?.locked_reason).toBeNull();
    });

    it('blocks an anonymous identity on its second generation, once FREE_TURNS is spent', async () => {
      const identity: Identity = { userId: null, anonId: randomUUID() };
      expect(FREE_TURNS).toBe(1);

      await insertInteraction({
        id: randomUUID(),
        identity,
        question: question('anon-first-turn'),
        answer: 'first answer',
        model: CHAT_MODEL,
      });

      const result = await claimTurn({ identity, question: question('anon-second-turn'), model: CHAT_MODEL });

      expect('gated' in result).toBe(true);
      if ('gated' in result) {
        expect(result.gated.reason).toBe('sign_in_required');
      }
    });

    it('counts an unanswerable turn toward the limit, because it did cost a generation', async () => {
      const identity: Identity = { userId: null, anonId: randomUUID() };

      await insertInteraction({
        id: randomUUID(),
        identity,
        question: question('anon-unanswerable-turn'),
        answer: null,
        model: CHAT_MODEL,
        lockedReason: 'unanswerable',
      });

      const result = await claimTurn({ identity, question: question('anon-after-unanswerable'), model: CHAT_MODEL });

      expect('gated' in result).toBe(true);
      if ('gated' in result) {
        expect(result.gated.reason).toBe('sign_in_required');
      }
    });

    it('does not count a free refusal toward either limit', async () => {
      const identity: Identity = { userId: null, anonId: randomUUID() };

      await insertInteraction({
        id: randomUUID(),
        identity,
        question: question('anon-free-refusal'),
        answer: null,
        model: null,
        lockedReason: 'off_topic',
      });

      const result = await claimTurn({ identity, question: question('anon-after-free-refusal'), model: CHAT_MODEL });

      expect('gated' in result).toBe(false);
    });

    it('lets a signed-in user through at DAILY_LIMIT minus one prior generation', async () => {
      const identity: Identity = { userId: randomUUID(), anonId: null };
      expect(DAILY_LIMIT).toBe(20);

      for (let i = 0; i < DAILY_LIMIT - 1; i += 1) {
        await insertInteraction({
          id: randomUUID(),
          identity,
          question: question(`signed-in-prior-${i}`),
          answer: `answer ${i}`,
          model: CHAT_MODEL,
        });
      }

      const result = await claimTurn({ identity, question: question('signed-in-at-limit-minus-one'), model: CHAT_MODEL });

      expect('gated' in result).toBe(false);
    });

    it('gates a signed-in user at exactly DAILY_LIMIT prior generations today', async () => {
      const identity: Identity = { userId: randomUUID(), anonId: null };

      for (let i = 0; i < DAILY_LIMIT; i += 1) {
        await insertInteraction({
          id: randomUUID(),
          identity,
          question: question(`signed-in-at-limit-${i}`),
          answer: `answer ${i}`,
          model: CHAT_MODEL,
        });
      }

      const result = await claimTurn({ identity, question: question('signed-in-over-limit'), model: CHAT_MODEL });

      expect('gated' in result).toBe(true);
      if ('gated' in result) {
        expect(result.gated.reason).toBe('rate_limited');
      }
    });

    it('never admits more than DAILY_LIMIT concurrent claims for the same identity under the advisory lock', async () => {
      const identity: Identity = { userId: randomUUID(), anonId: null };
      const attempts = DAILY_LIMIT + 5;

      const results = await Promise.all(
        Array.from({ length: attempts }, (_, i) =>
          claimTurn({ identity, question: question(`concurrent-${i}`), model: CHAT_MODEL }),
        ),
      );

      const admitted = results.filter((r) => !('gated' in r));
      expect(admitted).toHaveLength(DAILY_LIMIT);

      const { rows } = await requirePool().query<{ count: string }>(
        `select count(*) from user_interactions
         where user_id = $1 and model is not null and created_at::date = (now() at time zone 'utc')::date`,
        [identity.userId],
      );
      expect(Number(rows[0].count)).toBe(DAILY_LIMIT);
    });
  });

  describe('logFreeTurn', () => {
    it('writes a row with model left null, so the turn never counts against either limit', async () => {
      const identity: Identity = { userId: null, anonId: randomUUID() };
      const q = question('free-turn-model-null');

      await logFreeTurn({ identity, question: q, reason: 'injection' });

      const { rows } = await requirePool().query<UserInteractionRow>('select * from user_interactions where question = $1', [q]);
      expect(rows).toHaveLength(1);
      expect(rows[0].model).toBeNull();
      expect(rows[0].locked_reason).toBe('injection');
      expect(rows[0].answer).toBeNull();
    });
  });

  describe('completeTurn', () => {
    it('writes the answer and the retrieved snapshot onto a claimed turn', async () => {
      const identity: Identity = { userId: null, anonId: randomUUID() };
      const turnId = randomUUID();
      await insertInteraction({ id: turnId, identity, question: question('to-complete'), model: CHAT_MODEL });

      await completeTurn({ turnId, answer: 'he builds agents for a living', retrieved: retrievedFixture() });

      const row = await fetchInteraction(turnId);
      expect(row?.answer).toBe('he builds agents for a living');
      expect(row?.locked_reason).toBeNull();
      expect(row?.model).toBe(CHAT_MODEL);
    });
  });

  describe('lockTurn', () => {
    it('marks a claimed turn unanswerable without clearing the cost marker', async () => {
      const identity: Identity = { userId: null, anonId: randomUUID() };
      const turnId = randomUUID();
      await insertInteraction({ id: turnId, identity, question: question('to-lock'), model: CHAT_MODEL });

      await lockTurn({ turnId, reason: 'unanswerable', retrieved: retrievedFixture() });

      const row = await fetchInteraction(turnId);
      expect(row?.locked_reason).toBe('unanswerable');
      expect(row?.answer).toBeNull();
      expect(row?.model).toBe(CHAT_MODEL);
    });
  });

  describe('loadHistory', () => {
    it('caps history at HISTORY_TURNS even when more turns exist for this identity', async () => {
      const identity: Identity = { userId: randomUUID(), anonId: null };
      const total = HISTORY_TURNS + 2;

      for (let i = 0; i < total; i += 1) {
        await insertInteraction({
          id: randomUUID(),
          identity,
          question: question(`history-turns-cap-${i}`),
          answer: `answer ${i}`,
          model: CHAT_MODEL,
          createdAt: minutesAgo(total - i),
        });
      }

      const history = await loadHistory(identity);

      expect(history).toHaveLength(HISTORY_TURNS);
      const expectedQuestions = Array.from({ length: HISTORY_TURNS }, (_, i) =>
        question(`history-turns-cap-${total - HISTORY_TURNS + i}`),
      );
      expect(history.map((t) => t.question)).toEqual(expectedQuestions);
    });

    it('trims history to fit HISTORY_MAX_CHARS, dropping the oldest turn first', async () => {
      const identity: Identity = { userId: randomUUID(), anonId: null };
      const oldestAnswer = 'a'.repeat(HISTORY_MAX_CHARS - 99);
      const middleAnswer = 'b'.repeat(50);
      const newestAnswer = 'c'.repeat(20);

      await insertInteraction({
        id: randomUUID(),
        identity,
        question: question('history-chars-oldest'),
        answer: oldestAnswer,
        model: CHAT_MODEL,
        createdAt: minutesAgo(3),
      });
      await insertInteraction({
        id: randomUUID(),
        identity,
        question: question('history-chars-middle'),
        answer: middleAnswer,
        model: CHAT_MODEL,
        createdAt: minutesAgo(2),
      });
      await insertInteraction({
        id: randomUUID(),
        identity,
        question: question('history-chars-newest'),
        answer: newestAnswer,
        model: CHAT_MODEL,
        createdAt: minutesAgo(1),
      });

      const history = await loadHistory(identity);

      expect(history.map((t) => t.question)).toEqual([
        question('history-chars-middle'),
        question('history-chars-newest'),
      ]);
      const totalChars = history.reduce((sum, t) => sum + t.question.length + (t.answer?.length ?? 0), 0);
      expect(totalChars).toBeLessThanOrEqual(HISTORY_MAX_CHARS);
    });

    it('includes a refused turn with a null answer', async () => {
      const identity: Identity = { userId: randomUUID(), anonId: null };
      const refusedQuestion = question('history-includes-refusal');

      await insertInteraction({
        id: randomUUID(),
        identity,
        question: refusedQuestion,
        answer: null,
        model: CHAT_MODEL,
        lockedReason: 'unanswerable',
        createdAt: minutesAgo(1),
      });

      const history = await loadHistory(identity);

      const refusedTurn = history.find((t) => t.question === refusedQuestion);
      expect(refusedTurn).toBeDefined();
      expect(refusedTurn?.answer).toBeNull();
    });
  });
});
