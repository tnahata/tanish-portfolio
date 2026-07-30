import { getDb } from './db';
import { filterQuestion } from './filter';
import { retrieve, type RetrievedChunk } from './retrieve';
import { grade, generate, type GroundingVerdict } from './ground';
import { ANTHROPIC_MODEL } from './generate';
import type { ConversationTurn } from './prompt';
import { selectRefusal, type RefusalReason } from './refusals';
import {
  TurnSequencer,
  logError,
  logGenerated,
  logGenerationStarted,
  logGraded,
  logQuestionReceived,
  logRefused,
  logRetrieved,
  newTurnId,
  type EventIdentity,
} from './events';

export interface AskHistoryTurn {
  question: string;
  responseText: string;
  wasAnswered: boolean;
}

export interface AskResult {
  outcome: 'answered' | 'refused';
  turnId: string;
  groundingVerdict: GroundingVerdict | null;
  retrievedChunks: RetrievedChunk[];
  answer: string | null;
  refusalReason: RefusalReason | null;
  refusalText: string | null;
  costUsd: number;
}

function toConversationTurns(history: AskHistoryTurn[]): ConversationTurn[] {
  return history.flatMap((turn) => [
    { role: 'user' as const, content: turn.question },
    { role: 'assistant' as const, content: turn.responseText },
  ]);
}

function previousAnsweredQuestion(history: AskHistoryTurn[]): string | undefined {
  const last = history.at(-1);
  return last?.wasAnswered ? last.question : undefined;
}

function refusalResult(
  turnId: string,
  groundingVerdict: GroundingVerdict | null,
  retrievedChunks: RetrievedChunk[],
  reason: RefusalReason,
  question: string,
  closestTitle: string | null | undefined,
  costUsd: number,
): AskResult {
  return {
    outcome: 'refused',
    turnId,
    groundingVerdict,
    retrievedChunks,
    answer: null,
    refusalReason: reason,
    refusalText: selectRefusal({ reason, question, closestTitle }),
    costUsd,
  };
}

/**
 * Pure orchestration: filter, retrieve, grade, generate or refuse, logging every step. No HTTP
 * concerns, auth, or rate limiting; those belong to the route (phase 5).
 */
export async function askOnce(question: string, history: AskHistoryTurn[] = []): Promise<AskResult> {
  const db = getDb();
  const identity: EventIdentity = { sessionId: null, userId: null, turnId: newTurnId() };
  const seq = new TurnSequencer();

  try {
    await logQuestionReceived(db, identity, seq.take(), question);

    const filterReason = filterQuestion(question);
    if (filterReason) {
      await logRefused(db, identity, seq.take(), filterReason);
      return refusalResult(identity.turnId, null, [], filterReason, question, undefined, 0);
    }

    const retrievedChunks = await retrieve({ question, previousQuestion: previousAnsweredQuestion(history) });
    await logRetrieved(db, identity, seq.take(), retrievedChunks);

    const graded = grade(retrievedChunks);
    await logGraded(db, identity, seq.take(), graded.verdict, graded.topScore);

    if (graded.verdict === 'weak') {
      await logRefused(db, identity, seq.take(), 'no_grounding');
      return refusalResult(identity.turnId, graded.verdict, retrievedChunks, 'no_grounding', question, graded.closestTitle, 0);
    }
    if (graded.verdict === 'none') {
      await logRefused(db, identity, seq.take(), 'off_task');
      return refusalResult(identity.turnId, graded.verdict, retrievedChunks, 'off_task', question, undefined, 0);
    }

    await logGenerationStarted(db, identity, seq.take(), ANTHROPIC_MODEL);
    const stream = generate(graded.strong, { question, history: toConversationTurns(history) });

    // Draining the stream is what runs the request and resolves `complete`; the deltas
    // themselves aren't needed here since askOnce returns the complete answer, not a stream.
    const iterator = stream.textStream[Symbol.asyncIterator]();
    while (!(await iterator.next()).done) {
      // no-op: draining is what runs the request
    }
    const complete = await stream.complete;

    if (complete.isUnanswerable) {
      await logRefused(db, identity, seq.take(), 'unanswerable', complete.costUsd);
      return refusalResult(identity.turnId, graded.verdict, retrievedChunks, 'unanswerable', question, undefined, complete.costUsd);
    }

    await logGenerated(db, identity, seq.take(), complete.text, complete.costUsd);
    return {
      outcome: 'answered',
      turnId: identity.turnId,
      groundingVerdict: graded.verdict,
      retrievedChunks,
      answer: complete.text,
      refusalReason: null,
      refusalText: null,
      costUsd: complete.costUsd,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logError(db, identity, seq.take(), message).catch(() => undefined);
    throw error;
  }
}
