import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RetrievedChunk } from '../../lib/ask/retrieve';
import { T_FLOOR, T_STRONG } from '../../lib/ask/ground';

/** Behavioural tests for askOnce(), retrieval/generation mocked but grade() real. Central
 *  property: generate() runs on the strong-and-not-verbatim path only, checked by call count. */

const retrieveMock = vi.fn();
const generateMock = vi.fn();

vi.mock('../../lib/ask/retrieve', async () => {
  const actual = await vi.importActual<typeof import('../../lib/ask/retrieve')>(
    '../../lib/ask/retrieve'
  );
  return {
    ...actual,
    retrieve: (...args: unknown[]) => retrieveMock(...args),
  };
});

vi.mock('../../lib/ask/generate', () => ({
  generate: (...args: unknown[]) => generateMock(...args),
}));

import { askOnce } from '../../lib/ask/ask';
import { ASK_VERSION } from '../../lib/ask/prompt';

function chunk(overrides: Partial<RetrievedChunk> & { slug: string; score: number }): RetrievedChunk {
  return {
    title: `Document ${overrides.slug}`,
    route: `/${overrides.slug}`,
    heading: null,
    content: `Content for ${overrides.slug}. `.repeat(20), // long enough to exercise excerpting
    verbatimOnly: false,
    ...overrides,
  };
}

beforeEach(() => {
  retrieveMock.mockReset();
  generateMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('askOnce: none grounding', () => {
  it('refuses as off-task and never calls generate()', async () => {
    const chunks = [chunk({ slug: 'identity', score: T_FLOOR - 0.1 })];
    retrieveMock.mockResolvedValueOnce({ chunks, embedTokensUsed: 7 });

    const result = await askOnce({ question: 'What is the capital of France?' });

    expect(result.outcome).toBe('refused_off_task');
    expect(result.grounding).toBe('none');
    expect(result.answer).toBeNull();
    expect(result.verbatim).toBe(false);
    expect(result.inputTokens).toBe(0);
    expect(result.outputTokens).toBe(0);
    expect(result.costUsd).toBe(0);
    expect(result.embedTokens).toBe(7);
    expect(generateMock).not.toHaveBeenCalled();
  });
});

describe('askOnce: weak grounding', () => {
  it('refuses for lack of grounding and never calls generate()', async () => {
    const chunks = [chunk({ slug: 'identity', score: (T_FLOOR + T_STRONG) / 2 })];
    retrieveMock.mockResolvedValueOnce({ chunks, embedTokensUsed: 6 });

    const result = await askOnce({ question: 'Does he know anything about Kubernetes?' });

    expect(result.outcome).toBe('refused_no_grounding');
    expect(result.grounding).toBe('weak');
    expect(result.answer).toBeNull();
    expect(generateMock).not.toHaveBeenCalled();
  });
});

describe('askOnce: strong grounding, verbatim-only document', () => {
  it('quotes the top chunk verbatim and never calls generate()', async () => {
    const chunks = [
      chunk({ slug: 'faq', score: T_STRONG + 0.05, verbatimOnly: true, content: 'He is on an H-1B visa.' }),
    ];
    retrieveMock.mockResolvedValueOnce({ chunks, embedTokensUsed: 8 });

    const result = await askOnce({ question: 'Does Tanish need visa sponsorship?' });

    expect(result.outcome).toBe('answered');
    expect(result.grounding).toBe('strong');
    expect(result.verbatim).toBe(true);
    expect(result.answer).toBe('He is on an H-1B visa.');
    expect(result.inputTokens).toBe(0);
    expect(result.outputTokens).toBe(0);
    expect(result.costUsd).toBe(0);
    expect(generateMock).not.toHaveBeenCalled();
  });
});

describe('askOnce: strong grounding, generated answer', () => {
  it('calls generate() exactly once and returns its answer with token/cost accounting', async () => {
    const chunks = [chunk({ slug: 'stack', score: T_STRONG + 0.03 })];
    retrieveMock.mockResolvedValueOnce({ chunks, embedTokensUsed: 9 });
    generateMock.mockResolvedValueOnce({
      answer: 'His languages are TypeScript, Python, Java, and SQL.',
      inputTokens: 400,
      outputTokens: 25,
      costUsd: 0.001575,
    });

    const result = await askOnce({ question: 'What languages does he use?' });

    expect(result.outcome).toBe('answered');
    expect(result.grounding).toBe('strong');
    expect(result.verbatim).toBe(false);
    expect(result.answer).toBe('His languages are TypeScript, Python, Java, and SQL.');
    expect(result.inputTokens).toBe(400);
    expect(result.outputTokens).toBe(25);
    expect(result.costUsd).toBeCloseTo(0.001575);
    expect(generateMock).toHaveBeenCalledTimes(1);

    // generate() must have been called with the branded StrongGrounding value, the raw
    // question, and the (empty, here) history -- not with the whole GroundingOutcome union.
    const [strongArg, questionArg, historyArg] = generateMock.mock.calls[0] as [unknown, string, unknown[]];
    expect((strongArg as { topScore: number }).topScore).toBeCloseTo(T_STRONG + 0.03);
    expect(questionArg).toBe('What languages does he use?');
    expect(historyArg).toEqual([]);
  });

  it('passes history through to generate() unchanged', async () => {
    const chunks = [chunk({ slug: 'stack', score: T_STRONG + 0.03 })];
    retrieveMock.mockResolvedValueOnce({ chunks, embedTokensUsed: 5 });
    generateMock.mockResolvedValueOnce({ answer: 'ok', inputTokens: 1, outputTokens: 1, costUsd: 0 });

    const history = [{ question: 'earlier question', answer: 'earlier answer' }];
    await askOnce({ question: 'a follow-up', history });

    const [, , historyArg] = generateMock.mock.calls[0] as [unknown, string, unknown[]];
    expect(historyArg).toEqual(history);
  });
});

describe('askOnce: strong grounding, model-judged unanswerable', () => {
  // Retrieval clears T_STRONG, but the model decides the passages don't answer and returns
  // `answer: null`. Must still be exactly one generate() call: no second judge call.
  it('returns refused_unanswerable from a null generate() answer, with exactly one generate() call', async () => {
    const chunks = [chunk({ slug: 'identity', score: T_STRONG + 0.02 })];
    retrieveMock.mockResolvedValueOnce({ chunks, embedTokensUsed: 11 });
    generateMock.mockResolvedValueOnce({
      answer: null,
      inputTokens: 350,
      outputTokens: 6,
      costUsd: 0.00114,
    });

    const result = await askOnce({ question: 'Does Tanish need visa sponsorship?' });

    expect(result.outcome).toBe('refused_unanswerable');
    expect(result.grounding).toBe('strong');
    expect(result.answer).toBeNull();
    expect(result.verbatim).toBe(false);
    // Real token/cost accounting: unlike the none/weak refusals, a model call did happen here.
    expect(result.inputTokens).toBe(350);
    expect(result.outputTokens).toBe(6);
    expect(result.costUsd).toBeCloseTo(0.00114);
    expect(generateMock).toHaveBeenCalledTimes(1);
  });
});

describe('askOnce: query construction threading', () => {
  it('passes previousQuestion through to retrieve() unchanged', async () => {
    retrieveMock.mockResolvedValueOnce({
      chunks: [chunk({ slug: 'identity', score: T_FLOOR - 0.1 })],
      embedTokensUsed: 3,
    });

    await askOnce({ question: 'follow-up', previousQuestion: 'earlier question' });

    expect(retrieveMock).toHaveBeenCalledWith('follow-up', 'earlier question');
  });

  it('passes null as previousQuestion by default', async () => {
    retrieveMock.mockResolvedValueOnce({
      chunks: [chunk({ slug: 'identity', score: T_FLOOR - 0.1 })],
      embedTokensUsed: 3,
    });

    await askOnce({ question: 'fresh question' });

    expect(retrieveMock).toHaveBeenCalledWith('fresh question', null);
  });
});

describe('askOnce: turn metadata', () => {
  it('stamps every result with the current ASK_VERSION', async () => {
    retrieveMock.mockResolvedValueOnce({
      chunks: [chunk({ slug: 'identity', score: T_FLOOR - 0.1 })],
      embedTokensUsed: 3,
    });

    const result = await askOnce({ question: 'off task' });

    expect(result.askVersion).toBe(ASK_VERSION);
  });

  it('records a non-negative latency', async () => {
    retrieveMock.mockResolvedValueOnce({
      chunks: [chunk({ slug: 'identity', score: T_FLOOR - 0.1 })],
      embedTokensUsed: 3,
    });

    const result = await askOnce({ question: 'off task' });

    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('builds a retrieved snapshot for every chunk, truncating long content into an excerpt', async () => {
    const longContent = 'x'.repeat(500);
    retrieveMock.mockResolvedValueOnce({
      chunks: [chunk({ slug: 'identity', score: T_FLOOR - 0.1, content: longContent })],
      embedTokensUsed: 3,
    });

    const result = await askOnce({ question: 'off task' });

    expect(result.retrieved).toHaveLength(1);
    expect(result.retrieved[0].slug).toBe('identity');
    expect(result.retrieved[0].excerpt.length).toBeLessThan(longContent.length);
    expect(result.retrieved[0].excerpt.endsWith('...')).toBe(true);
  });
});
