import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoredTurn } from '../../lib/ask/turns';

/** Behavioural tests for lib/ask/history.ts: full conversation, 15k token budget, oldest evicted
 *  first, refusals included (docs/ask-agent/06-personality.md). turns.ts is mocked at the boundary. */

const fetchRecentTurnsMock = vi.fn();

vi.mock('../../lib/ask/turns', () => ({
  fetchRecentTurns: (...args: unknown[]) => fetchRecentTurnsMock(...args),
}));

import { loadConversationHistory } from '../../lib/ask/history';

beforeEach(() => {
  fetchRecentTurnsMock.mockReset();
});

function turn(overrides: Partial<StoredTurn>): StoredTurn {
  return { question: 'q', answer: 'a', outcome: 'answered', ...overrides };
}

describe('loadConversationHistory: previousQuestion', () => {
  it('is the last turn\'s question when that turn was answered', async () => {
    fetchRecentTurnsMock.mockResolvedValueOnce([
      turn({ question: 'first', answer: 'a1', outcome: 'answered' }),
      turn({ question: 'second', answer: 'a2', outcome: 'answered' }),
    ]);

    const { previousQuestion } = await loadConversationHistory('conv-1');
    expect(previousQuestion).toBe('second');
  });

  it('is null when the last turn was a refusal (a follow-up to a refusal is its own question)', async () => {
    fetchRecentTurnsMock.mockResolvedValueOnce([
      turn({ question: 'first', answer: 'a1', outcome: 'answered' }),
      turn({ question: 'second', answer: null, outcome: 'refused_off_task' }),
    ]);

    const { previousQuestion } = await loadConversationHistory('conv-1');
    expect(previousQuestion).toBeNull();
  });

  it('is null for a fresh conversation with no turns yet', async () => {
    fetchRecentTurnsMock.mockResolvedValueOnce([]);
    const { previousQuestion } = await loadConversationHistory('conv-new');
    expect(previousQuestion).toBeNull();
  });
});

describe('loadConversationHistory: refused turns included in history', () => {
  it('includes a refused turn as a HistoryPair with non-empty refusal-copy answer text, not dropped', async () => {
    fetchRecentTurnsMock.mockResolvedValueOnce([
      turn({ question: 'Does he know Rust?', answer: null, outcome: 'refused_off_task' }),
    ]);

    const { history } = await loadConversationHistory('conv-1');

    expect(history).toHaveLength(1);
    expect(history[0].question).toBe('Does he know Rust?');
    expect(history[0].answer.length).toBeGreaterThan(0);
    expect(history[0].answer).not.toBeNull();
  });

  it('reconstructs the same refusal line askOnce()\'s own refusal copy would have shown, deterministically', async () => {
    const storedTurns = [turn({ question: 'Does he know Rust?', answer: null, outcome: 'refused_off_task' })];
    fetchRecentTurnsMock.mockResolvedValueOnce(storedTurns).mockResolvedValueOnce(storedTurns);

    const first = await loadConversationHistory('conv-1');
    const second = await loadConversationHistory('conv-1');
    expect(first.history[0].answer).toBe(second.history[0].answer);
  });
});

describe('loadConversationHistory: 15k token budget, full conversation (not last-3)', () => {
  it('keeps more than three pairs when they fit comfortably under the token budget', async () => {
    const turns: StoredTurn[] = Array.from({ length: 10 }, (_, i) =>
      turn({ question: `question ${i}`, answer: `short answer ${i}`, outcome: 'answered' })
    );
    fetchRecentTurnsMock.mockResolvedValueOnce(turns);

    const { history } = await loadConversationHistory('conv-1');

    // The whole point of resolving the contradiction toward "full conversation under a token
    // budget": ten short turns must not be truncated down to three.
    expect(history).toHaveLength(10);
    expect(history[0].question).toBe('question 0');
    expect(history[9].question).toBe('question 9');
  });

  it('evicts the oldest pairs first once the budget is exceeded, keeping the most recent ones', async () => {
    // Enough volume (~1000 tokens/turn x 20) to guarantee eviction against the real 15k budget.
    const longAnswer = 'x'.repeat(4000); // ~1000 tokens per turn
    const turns: StoredTurn[] = Array.from({ length: 20 }, (_, i) =>
      turn({ question: `question ${i}`, answer: longAnswer, outcome: 'answered' })
    );
    fetchRecentTurnsMock.mockResolvedValueOnce(turns);

    const { history } = await loadConversationHistory('conv-1');

    // 20 turns * ~1000 tokens each is ~20k tokens, over the 15k budget, so eviction must have
    // dropped at least the oldest one.
    expect(history.length).toBeLessThan(20);
    // Oldest-evicted-first: whatever remains must be a suffix of the original list, ending on
    // the most recent turn, not an arbitrary subset.
    const keptQuestions = history.map((h) => h.question);
    const expectedSuffix = turns.slice(turns.length - history.length).map((t) => t.question);
    expect(keptQuestions).toEqual(expectedSuffix);
    expect(history[history.length - 1].question).toBe('question 19');
  });

  it('keeps at least the single most recent pair even if it alone exceeds the budget', async () => {
    const hugeAnswer = 'x'.repeat(200_000); // far larger than the entire 15k token budget alone
    fetchRecentTurnsMock.mockResolvedValueOnce([
      turn({ question: 'only question', answer: hugeAnswer, outcome: 'answered' }),
    ]);

    const { history } = await loadConversationHistory('conv-1');

    expect(history).toHaveLength(1);
    expect(history[0].question).toBe('only question');
  });
});
