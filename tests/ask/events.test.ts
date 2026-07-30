import { describe, expect, it, vi } from 'vitest';
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
} from '@/lib/ask/events';
import type { RetrievedChunk } from '@/lib/ask/retrieve';
import type { AskExecutor } from '@/lib/ask/db';

function fakeExecutor(): { executor: AskExecutor; values: ReturnType<typeof vi.fn> } {
  const values = vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn(() => ({ values }));
  return { executor: { insert } as unknown as AskExecutor, values };
}

const IDENTITY: EventIdentity = { sessionId: null, userId: null, turnId: 'turn-1' };

const CHUNK: RetrievedChunk = {
  documentId: 'doc-1',
  slug: 'identity',
  title: 'Who Tanish Is',
  route: '/',
  ordinal: 0,
  heading: 'Current situation',
  content: 'He works out of San Francisco.',
  similarity: 0.55,
};

describe('newTurnId', () => {
  it('produces a distinct id each call', () => {
    expect(newTurnId()).not.toBe(newTurnId());
  });
});

describe('TurnSequencer', () => {
  it('hands out a strictly increasing sequence starting at zero', () => {
    const seq = new TurnSequencer();
    expect([seq.take(), seq.take(), seq.take()]).toEqual([0, 1, 2]);
  });
});

describe('event log writers', () => {
  it('writes question_received with the raw question', async () => {
    const { executor, values } = fakeExecutor();
    await logQuestionReceived(executor, IDENTITY, 0, 'What is ESMON?');

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ turnId: 'turn-1', seq: 0, event: 'question_received', payload: { question: 'What is ESMON?' } }),
    );
  });

  it('writes retrieved with a snapshot of the chunks actually seen', async () => {
    const { executor, values } = fakeExecutor();
    await logRetrieved(executor, IDENTITY, 1, [CHUNK]);

    const call = values.mock.calls[0][0];
    expect(call.event).toBe('retrieved');
    expect(call.payload.count).toBe(1);
    expect(call.payload.top_score).toBe(0.55);
    expect(call.payload.chunks[0]).toMatchObject({ slug: 'identity', ordinal: 0, similarity: 0.55 });
  });

  it('writes graded with verdict and top score', async () => {
    const { executor, values } = fakeExecutor();
    await logGraded(executor, IDENTITY, 2, 'strong', 0.55);

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'graded', payload: { verdict: 'strong', top_score: 0.55 } }),
    );
  });

  it('writes generation_started before any cost is known', async () => {
    const { executor, values } = fakeExecutor();
    await logGenerationStarted(executor, IDENTITY, 3, 'claude-sonnet-5');

    const call = values.mock.calls[0][0];
    expect(call.event).toBe('generation_started');
    expect(call.payload).toEqual({ model: 'claude-sonnet-5' });
    expect(call.costUsd).toBeUndefined();
  });

  it('writes generated with the answer text and cost_usd as a fixed-precision string', async () => {
    const { executor, values } = fakeExecutor();
    await logGenerated(executor, IDENTITY, 4, 'ESMON parses binary data.', 0.000123456);

    const call = values.mock.calls[0][0];
    expect(call.event).toBe('generated');
    expect(call.payload).toEqual({ answer: 'ESMON parses binary data.' });
    expect(call.costUsd).toBe('0.000123');
  });

  it('writes refused with a closed-enum reason, and no cost for a threshold refusal', async () => {
    const { executor, values } = fakeExecutor();
    await logRefused(executor, IDENTITY, 5, 'off_task');

    const call = values.mock.calls[0][0];
    expect(call.event).toBe('refused');
    expect(call.payload).toEqual({ reason: 'off_task' });
    expect(call.costUsd).toBeUndefined();
  });

  it('writes refused with cost attached for an unanswerable refusal, since a model call happened', async () => {
    const { executor, values } = fakeExecutor();
    await logRefused(executor, IDENTITY, 5, 'unanswerable', 0.0005);

    const call = values.mock.calls[0][0];
    expect(call.payload).toEqual({ reason: 'unanswerable' });
    expect(call.costUsd).toBe('0.000500');
  });

  it('writes error with the failure message', async () => {
    const { executor, values } = fakeExecutor();
    await logError(executor, IDENTITY, 6, 'boom');

    expect(values).toHaveBeenCalledWith(expect.objectContaining({ event: 'error', payload: { message: 'boom' } }));
  });
});
