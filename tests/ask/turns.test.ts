import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chainMock } from './drizzle-mock';

/**
 * Behavioural tests for lib/ask/turns.ts. Database access is mocked at the `./db` module
 * boundary (`db()`, Drizzle-shaped), matching tests/ask/session.test.ts's convention.
 */

const dbMock = vi.fn();

vi.mock('../../lib/ask/db', () => ({
  db: (...args: unknown[]) => dbMock(...args),
}));

import { fetchRecentTurns, insertTurn, type TurnLogEntry } from '../../lib/ask/turns';
import { turns } from '../../lib/ask/schema';

beforeEach(() => {
  dbMock.mockReset();
});

function entry(overrides: Partial<TurnLogEntry> = {}): TurnLogEntry {
  return {
    id: 'turn-1',
    conversationId: 'conv-1',
    sessionId: 'session-1',
    question: 'What does he do at FedEx?',
    answer: 'Full Stack Engineer II.',
    outcome: 'answered',
    grounding: 'strong',
    topScore: 0.51,
    retrieved: [{ slug: 'identity', title: 'Identity', route: '/identity', score: 0.51, excerpt: 'excerpt' }],
    askVersion: 'v1',
    corpusHash: 'hash1',
    latencyMs: 120,
    inputTokens: 400,
    outputTokens: 25,
    embedTokens: 8,
    costUsd: 0.0015,
    ...overrides,
  };
}

describe('insertTurn', () => {
  it('writes exactly one row with every field mapped onto the turns table', async () => {
    const chain = chainMock(undefined);
    dbMock.mockReturnValueOnce(chain);

    await insertTurn(entry());

    expect(dbMock).toHaveBeenCalledTimes(1);
    expect(chain.insert).toHaveBeenCalledWith(turns);
    expect(chain.values).toHaveBeenCalledTimes(1);
    const values = chain.values.mock.calls[0][0] as Record<string, unknown>;
    expect(values.id).toBe('turn-1');
    expect(values.conversationId).toBe('conv-1');
    expect(values.sessionId).toBe('session-1');
    expect(values.outcome).toBe('answered');
    expect(values.retrieved).toEqual(entry().retrieved);
    // turns.cost_usd is a Drizzle numeric column in default string mode, matching what a read
    // returns: the number is stringified rather than passed straight through.
    expect(values.costUsd).toBe('0.0015');
  });

  it('writes a null answer for a refusal outcome', async () => {
    const chain = chainMock(undefined);
    dbMock.mockReturnValueOnce(chain);

    await insertTurn(entry({ outcome: 'refused_off_task', grounding: 'none', answer: null, topScore: 0.05 }));

    const values = chain.values.mock.calls[0][0] as Record<string, unknown>;
    expect(values.answer).toBeNull();
    expect(values.outcome).toBe('refused_off_task');
  });
});

describe('fetchRecentTurns', () => {
  it('returns turns in ascending (oldest-first) order, matching prompt assembly order', async () => {
    // The repository fetches most-recent-first (ORDER BY created_at DESC LIMIT N) and reverses
    // in memory, which is equivalent to the previous nested-subquery SQL for the same row set.
    const chain = chainMock([
      { question: 'second', answer: null, outcome: 'refused_off_task' },
      { question: 'first', answer: 'a1', outcome: 'answered' },
    ]);
    dbMock.mockReturnValueOnce(chain);

    const turnsResult = await fetchRecentTurns('conv-1');

    expect(turnsResult).toEqual([
      { question: 'first', answer: 'a1', outcome: 'answered' },
      { question: 'second', answer: null, outcome: 'refused_off_task' },
    ]);
    expect(chain.from).toHaveBeenCalledWith(turns);
    expect(chain.orderBy).toHaveBeenCalledTimes(1);
    expect(chain.limit).toHaveBeenCalledWith(200);
  });

  it('filters out rows whose question has already been nulled by the retention job', async () => {
    const chain = chainMock([
      { question: 'still here', answer: 'a', outcome: 'answered' },
      { question: null, answer: null, outcome: 'answered' },
    ]);
    dbMock.mockReturnValueOnce(chain);

    const turnsResult = await fetchRecentTurns('conv-1');

    expect(turnsResult).toHaveLength(1);
    expect(turnsResult[0].question).toBe('still here');
  });

  it('returns an empty array for a conversation with no turns yet', async () => {
    dbMock.mockReturnValueOnce(chainMock([]));
    expect(await fetchRecentTurns('conv-new')).toEqual([]);
  });
});
