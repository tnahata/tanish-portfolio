import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UIMessageStreamWriter } from 'ai';
import type { AskOnceResult } from '../../lib/ask/ask';

/** Behavioural tests for runAskTurn(), askOnce()/insertTurn() mocked: deterministic data-part
 *  ordering, a disconnect still writing a turn, and each outcome's correct response shape. */

const askOnceMock = vi.fn();
const insertTurnMock = vi.fn();

vi.mock('../../lib/ask/ask', () => ({
  askOnce: (...args: unknown[]) => askOnceMock(...args),
}));

vi.mock('../../lib/ask/turns', () => ({
  insertTurn: (...args: unknown[]) => insertTurnMock(...args),
}));

import { runAskTurn, type AskUIMessage } from '../../lib/ask/stream';

/** Records every `write()` call in order; cast to UIMessageStreamWriter at each call site rather
 *  than implementing `merge`/`onError`, which runAskTurn() never calls. */
class RecordingWriter {
  calls: Array<Record<string, unknown>> = [];
  write(part: Record<string, unknown>): void {
    this.calls.push(part);
  }
}

function asWriter(writer: RecordingWriter): UIMessageStreamWriter<AskUIMessage> {
  return writer as unknown as UIMessageStreamWriter<AskUIMessage>;
}

function baseParams(writer: RecordingWriter, signal: AbortSignal) {
  return {
    writer: asWriter(writer),
    signal,
    question: 'What does he do at FedEx?',
    previousQuestion: null,
    history: [],
    conversationId: 'conv-1',
    sessionId: 'session-1',
    corpusHash: 'corpus-hash-1',
  };
}

function answeredResult(overrides: Partial<AskOnceResult> = {}): AskOnceResult {
  return {
    outcome: 'answered',
    grounding: 'strong',
    answer: 'He is a Full Stack Engineer II.',
    verbatim: false,
    topScore: 0.51,
    retrieved: [
      { slug: 'identity', title: 'Identity', route: '/identity', score: 0.51, excerpt: 'excerpt one' },
      { slug: 'faq', title: 'FAQ', route: '/faq', score: 0.44, excerpt: 'excerpt two' },
    ],
    askVersion: 'v1',
    latencyMs: 120,
    embedTokens: 8,
    inputTokens: 400,
    outputTokens: 25,
    costUsd: 0.0015,
    ...overrides,
  };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  askOnceMock.mockReset();
  insertTurnMock.mockReset();
  insertTurnMock.mockResolvedValue(undefined);
});

describe('runAskTurn: data-part ordering (answered)', () => {
  it('writes status, then every source, then verdict, before any answer text', async () => {
    askOnceMock.mockResolvedValueOnce(answeredResult());
    const writer = new RecordingWriter();

    await runAskTurn(baseParams(writer, new AbortController().signal));

    const types = writer.calls.map((c) => c.type);
    expect(types).toEqual([
      'data-status',
      'data-source',
      'data-source',
      'data-verdict',
      'text-start',
      'text-delta',
      'text-end',
    ]);
  });

  it('writes the status part synchronously before askOnce() is even called', async () => {
    const { promise, resolve } = deferred<AskOnceResult>();
    askOnceMock.mockReturnValueOnce(promise);
    const writer = new RecordingWriter();

    const runPromise = runAskTurn(baseParams(writer, new AbortController().signal));
    // askOnce() has not resolved yet, but the status part must already be there.
    expect(writer.calls).toHaveLength(1);
    expect(writer.calls[0]).toMatchObject({ type: 'data-status', transient: true });

    resolve(answeredResult());
    await runPromise;
  });

  it('preserves retrieved-chunk order in the emitted source parts (best match first)', async () => {
    askOnceMock.mockResolvedValueOnce(answeredResult());
    const writer = new RecordingWriter();

    await runAskTurn(baseParams(writer, new AbortController().signal));

    const sourceParts = writer.calls.filter((c) => c.type === 'data-source');
    expect((sourceParts[0].data as { slug: string }).slug).toBe('identity');
    expect((sourceParts[1].data as { slug: string }).slug).toBe('faq');
  });

  it('carries the full answer text in a single text-delta, since generate() does not stream incrementally', async () => {
    askOnceMock.mockResolvedValueOnce(answeredResult({ answer: 'Full Stack Engineer II at FedEx.' }));
    const writer = new RecordingWriter();

    await runAskTurn(baseParams(writer, new AbortController().signal));

    const delta = writer.calls.find((c) => c.type === 'text-delta');
    expect(delta?.delta).toBe('Full Stack Engineer II at FedEx.');
  });
});

describe('runAskTurn: data-part ordering (refusal)', () => {
  it('writes status, sources, verdict, then a single data-refusal part, and no answer text', async () => {
    askOnceMock.mockResolvedValueOnce(
      answeredResult({
        outcome: 'refused_off_task',
        grounding: 'none',
        answer: null,
        topScore: 0.05,
        retrieved: [],
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
      })
    );
    const writer = new RecordingWriter();

    await runAskTurn(baseParams(writer, new AbortController().signal));

    const types = writer.calls.map((c) => c.type);
    expect(types).toEqual(['data-status', 'data-verdict', 'data-refusal']);
    expect(types).not.toContain('text-start');
  });
});

describe('runAskTurn: the four outcome values', () => {
  const cases: Array<{
    outcome: AskOnceResult['outcome'];
    grounding: AskOnceResult['grounding'];
    answer: string | null;
  }> = [
    { outcome: 'answered', grounding: 'strong', answer: 'a real answer' },
    { outcome: 'refused_no_grounding', grounding: 'weak', answer: null },
    { outcome: 'refused_off_task', grounding: 'none', answer: null },
    { outcome: 'refused_unanswerable', grounding: 'strong', answer: null },
  ];

  for (const testCase of cases) {
    it(`produces the correct response shape for outcome "${testCase.outcome}"`, async () => {
      askOnceMock.mockResolvedValueOnce(
        answeredResult({
          outcome: testCase.outcome,
          grounding: testCase.grounding,
          answer: testCase.answer,
          retrieved: [],
        })
      );
      const writer = new RecordingWriter();

      await runAskTurn(baseParams(writer, new AbortController().signal));

      const types = writer.calls.map((c) => c.type);
      if (testCase.outcome === 'answered') {
        expect(types).toEqual(expect.arrayContaining(['text-start', 'text-delta', 'text-end']));
        expect(types).not.toContain('data-refusal');
      } else {
        expect(types).toContain('data-refusal');
        expect(types).not.toContain('text-start');
        const refusalPart = writer.calls.find((c) => c.type === 'data-refusal');
        expect((refusalPart?.data as { outcome: string }).outcome).toBe(testCase.outcome);
      }

      // Every outcome writes exactly one turn row, and a refusal's row has a null answer.
      expect(insertTurnMock).toHaveBeenCalledTimes(1);
      const logged = insertTurnMock.mock.calls[0][0] as { outcome: string; answer: string | null };
      expect(logged.outcome).toBe(testCase.outcome);
      expect(logged.answer).toBe(testCase.answer);
    });
  }
});

describe('runAskTurn: disconnect safety', () => {
  it('still writes a turn row when the client disconnects before askOnce() resolves', async () => {
    const controller = new AbortController();
    const { promise, resolve } = deferred<AskOnceResult>();
    askOnceMock.mockReturnValueOnce(promise);
    const writer = new RecordingWriter();

    const runPromise = runAskTurn(baseParams(writer, controller.signal));

    // The disconnect happens while askOnce() is still in flight.
    controller.abort();
    resolve(answeredResult());
    await runPromise;

    expect(insertTurnMock).toHaveBeenCalledTimes(1);
    const logged = insertTurnMock.mock.calls[0][0] as { outcome: string; answer: string | null };
    expect(logged.outcome).toBe('answered');
    expect(logged.answer).toBe('He is a Full Stack Engineer II.');
  });

  it('does not attempt to write retrieval-trace or answer parts once already disconnected', async () => {
    const controller = new AbortController();
    const { promise, resolve } = deferred<AskOnceResult>();
    askOnceMock.mockReturnValueOnce(promise);
    const writer = new RecordingWriter();

    const runPromise = runAskTurn(baseParams(writer, controller.signal));
    controller.abort();
    resolve(answeredResult());
    await runPromise;

    // Only the initial status part (written before the disconnect was even known) should exist.
    expect(writer.calls).toHaveLength(1);
    expect(writer.calls[0].type).toBe('data-status');
  });

  it('logs the turn for a refusal outcome too, with a null answer, when the client disconnects', async () => {
    const controller = new AbortController();
    const { promise, resolve } = deferred<AskOnceResult>();
    askOnceMock.mockReturnValueOnce(promise);
    const writer = new RecordingWriter();

    const runPromise = runAskTurn(baseParams(writer, controller.signal));
    controller.abort();
    resolve(
      answeredResult({ outcome: 'refused_no_grounding', grounding: 'weak', answer: null, retrieved: [] })
    );
    await runPromise;

    const logged = insertTurnMock.mock.calls[0][0] as { outcome: string; answer: string | null };
    expect(logged.outcome).toBe('refused_no_grounding');
    expect(logged.answer).toBeNull();
  });

  it('does not log a turn when askOnce() itself throws (no graded outcome to record)', async () => {
    askOnceMock.mockRejectedValueOnce(new Error('upstream failure'));
    const writer = new RecordingWriter();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await runAskTurn(baseParams(writer, new AbortController().signal));

    expect(insertTurnMock).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
