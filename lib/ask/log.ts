import { and, desc, eq, gte, isNotNull, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { PgDatabase } from 'drizzle-orm/pg-core';

import { DAILY_LIMIT, FREE_TURNS, HISTORY_MAX_CHARS, HISTORY_TURNS } from './config';
import { getDb } from './db';
import { userInteractions } from './schema';
import type * as schema from './schema';
import type { Identity, LockedReason, PriorTurn, RetrievedChunk } from './types';

/** What `getDb()` and a transaction inside it have in common: enough to run the count query. */
type Queryable = PgDatabase<NodePgQueryResultHKT, typeof schema>;

/** Refused before the gate ran, or gated. Carries the reason the client renders. */
export interface Gated {
  reason: Extract<LockedReason, 'sign_in_required' | 'rate_limited'>;
  resetsAt: Date | null;
}

/** `userId` set when signed in, `anonId` when not; the caller guarantees never both null. */
function requireAnonId(identity: Identity): string {
  if (identity.anonId === null) {
    throw new Error('anonymous identity is missing anonId');
  }
  return identity.anonId;
}

function identityLockKey(identity: Identity): string {
  return identity.userId !== null ? `user:${identity.userId}` : `anon:${requireAnonId(identity)}`;
}

function utcMidnight(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function nextUtcMidnight(): Date {
  return new Date(utcMidnight().getTime() + 24 * 60 * 60 * 1000);
}

/**
 * The generation-counting predicate both gates share: anonymous scopes by anon_id with no date
 * window, signed in scopes by user_id since UTC midnight. Both count rows where model is not null.
 */
function gateQueryFor(identity: Identity): { scope: SQL | undefined; limit: number } {
  const { userId } = identity;
  if (userId !== null) {
    return {
      scope: and(
        eq(userInteractions.userId, userId),
        isNotNull(userInteractions.model),
        gte(userInteractions.createdAt, utcMidnight()),
      ),
      limit: DAILY_LIMIT,
    };
  }
  return {
    scope: and(eq(userInteractions.anonId, requireAnonId(identity)), isNotNull(userInteractions.model)),
    limit: FREE_TURNS,
  };
}

async function countGenerations(db: Queryable, scope: SQL | undefined): Promise<number> {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(userInteractions).where(scope);
  return count;
}

/** Turns a generation count against its limit into the gate that stops the caller, or none. */
function toGated(identity: Identity, count: number, limit: number): Gated | null {
  if (count < limit) {
    return null;
  }
  return identity.userId !== null
    ? { reason: 'rate_limited', resetsAt: nextUtcMidnight() }
    : { reason: 'sign_in_required', resetsAt: null };
}

/**
 * Cheap read-only count at step 4, stopping a gated caller before their question is embedded. Not
 * authoritative: `claimTurn` at step 8 takes the lock and counts again, and may still gate.
 */
export async function checkGate(identity: Identity): Promise<Gated | null> {
  const { scope, limit } = gateQueryFor(identity);
  const count = await countGenerations(getDb(), scope);
  return toGated(identity, count, limit);
}

/**
 * Counts prior generations for this identity and, if under the limit, inserts the claim row in the
 * same transaction under an advisory lock on the identity. Returns the new turn id, or the gate
 * that stopped it. Claiming before generating is what makes the limit exact.
 */
export async function claimTurn(input: {
  identity: Identity;
  question: string;
  model: string;
}): Promise<{ turnId: string } | { gated: Gated }> {
  const { identity, question, model } = input;

  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${identityLockKey(identity)}))`);

    const { scope, limit } = gateQueryFor(identity);
    const count = await countGenerations(tx, scope);
    const gated = toGated(identity, count, limit);
    if (gated) {
      return { gated };
    }

    const [row] = await tx
      .insert(userInteractions)
      .values({
        userId: identity.userId,
        anonId: identity.anonId,
        question,
        model,
        isFree: identity.userId === null,
      })
      .returning({ id: userInteractions.id });

    return { turnId: row.id };
  });
}

/**
 * Logs a turn that cost nothing: pre-filter refusals, threshold refusals, and gate hits.
 * `model` stays null, so these never count against either limit.
 */
export async function logFreeTurn(input: {
  identity: Identity;
  question: string;
  reason: LockedReason;
  retrieved?: RetrievedChunk[];
}): Promise<void> {
  const { identity, question, reason, retrieved } = input;

  await getDb()
    .insert(userInteractions)
    .values({
      userId: identity.userId,
      anonId: identity.anonId,
      question,
      lockedReason: reason,
      retrieved: retrieved ?? null,
    });
}

/** Writes the answer and the retrieved snapshot onto a claimed turn. */
export async function completeTurn(input: {
  turnId: string;
  answer: string;
  retrieved: RetrievedChunk[];
}): Promise<void> {
  const { turnId, answer, retrieved } = input;

  await getDb()
    .update(userInteractions)
    .set({ answer, retrieved })
    .where(eq(userInteractions.id, turnId));
}

/** Locks a claimed turn that generated but produced no answer. Today that is only `unanswerable`. */
export async function lockTurn(input: {
  turnId: string;
  reason: Extract<LockedReason, 'unanswerable'>;
  retrieved: RetrievedChunk[];
}): Promise<void> {
  const { turnId, reason, retrieved } = input;

  await getDb()
    .update(userInteractions)
    .set({ lockedReason: reason, retrieved })
    .where(eq(userInteractions.id, turnId));
}

/**
 * Rebuilds conversation history from rows this server wrote. Client-supplied history is forgeable
 * and would put unverified claims in context. Capped by HISTORY_TURNS and HISTORY_MAX_CHARS.
 */
export async function loadHistory(identity: Identity): Promise<PriorTurn[]> {
  const scope =
    identity.userId !== null
      ? eq(userInteractions.userId, identity.userId)
      : eq(userInteractions.anonId, requireAnonId(identity));

  const recent = await getDb()
    .select({ question: userInteractions.question, answer: userInteractions.answer })
    .from(userInteractions)
    .where(scope)
    .orderBy(desc(userInteractions.createdAt))
    .limit(HISTORY_TURNS);

  const kept: PriorTurn[] = [];
  let chars = 0;

  for (const turn of recent) {
    const cost = turn.question.length + (turn.answer?.length ?? 0);
    if (chars + cost > HISTORY_MAX_CHARS) {
      break;
    }
    chars += cost;
    kept.push(turn);
  }

  return kept.reverse();
}
