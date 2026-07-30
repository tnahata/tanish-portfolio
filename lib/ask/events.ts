import { randomUUID } from 'node:crypto';
import type { AskExecutor } from './db';
import { askEvents, type AskEventType } from './schema';
import type { RefusalReason } from './refusals';
import type { GroundingVerdict } from './ground';
import type { RetrievedChunk } from './retrieve';

export function newTurnId(): string {
  return randomUUID();
}

/** `seq` orders events sharing a `turn_id`, since several writes in one turn can share a timestamp. */
export class TurnSequencer {
  private nextSeq = 0;

  take(): number {
    const seq = this.nextSeq;
    this.nextSeq += 1;
    return seq;
  }
}

export interface EventIdentity {
  sessionId: string | null;
  userId: string | null;
  turnId: string;
}

interface RetrievedSnapshot {
  slug: string;
  ordinal: number;
  heading: string | null;
  content: string;
  similarity: number;
}

function toSnapshot(chunk: RetrievedChunk): RetrievedSnapshot {
  return { slug: chunk.slug, ordinal: chunk.ordinal, heading: chunk.heading, content: chunk.content, similarity: chunk.similarity };
}

async function writeEvent(
  executor: AskExecutor,
  identity: EventIdentity,
  seq: number,
  event: AskEventType,
  payload: Record<string, unknown>,
  costUsd?: number,
): Promise<void> {
  await executor.insert(askEvents).values({
    sessionId: identity.sessionId,
    userId: identity.userId,
    turnId: identity.turnId,
    seq,
    event,
    payload,
    costUsd: costUsd === undefined ? undefined : costUsd.toFixed(6),
  });
}

export function logQuestionReceived(executor: AskExecutor, identity: EventIdentity, seq: number, question: string): Promise<void> {
  return writeEvent(executor, identity, seq, 'question_received', { question });
}

export function logRetrieved(executor: AskExecutor, identity: EventIdentity, seq: number, chunks: RetrievedChunk[]): Promise<void> {
  return writeEvent(executor, identity, seq, 'retrieved', {
    count: chunks.length,
    top_score: chunks[0]?.similarity ?? 0,
    chunks: chunks.map(toSnapshot),
  });
}

export function logGraded(
  executor: AskExecutor,
  identity: EventIdentity,
  seq: number,
  verdict: GroundingVerdict,
  topScore: number,
): Promise<void> {
  return writeEvent(executor, identity, seq, 'graded', { verdict, top_score: topScore });
}

export function logGenerationStarted(executor: AskExecutor, identity: EventIdentity, seq: number, model: string): Promise<void> {
  return writeEvent(executor, identity, seq, 'generation_started', { model });
}

export function logGenerated(
  executor: AskExecutor,
  identity: EventIdentity,
  seq: number,
  answer: string,
  costUsd: number,
): Promise<void> {
  return writeEvent(executor, identity, seq, 'generated', { answer }, costUsd);
}

export function logRefused(
  executor: AskExecutor,
  identity: EventIdentity,
  seq: number,
  reason: RefusalReason,
  costUsd?: number,
): Promise<void> {
  return writeEvent(executor, identity, seq, 'refused', { reason }, costUsd);
}

export function logError(executor: AskExecutor, identity: EventIdentity, seq: number, message: string): Promise<void> {
  return writeEvent(executor, identity, seq, 'error', { message });
}
