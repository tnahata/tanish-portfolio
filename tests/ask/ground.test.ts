import { describe, expect, it } from 'vitest';
import { grade, T_FLOOR, T_STRONG } from '../../lib/ask/ground';
import type { RetrievedChunk } from '../../lib/ask/retrieve';

/** Behavioural tests for the grounding ladder: pure function, no mocks. `strong` is top-score-only;
 *  document corroboration was removed from its condition (see docs/ask-agent/README.md's decision log). */

function chunk(overrides: Partial<RetrievedChunk> & { slug: string; score: number }): RetrievedChunk {
  return {
    title: `Document ${overrides.slug}`,
    route: null,
    heading: null,
    content: 'content',
    verbatimOnly: false,
    ...overrides,
  };
}

describe('grade: none', () => {
  it('grades as none when the top score is below T_FLOOR', () => {
    const outcome = grade([chunk({ slug: 'a', score: T_FLOOR - 0.01 })]);
    expect(outcome.verdict).toBe('none');
    expect(outcome.topScore).toBeCloseTo(T_FLOOR - 0.01);
  });

  it('grades an empty chunk list as none with topScore 0', () => {
    const outcome = grade([]);
    expect(outcome.verdict).toBe('none');
    expect(outcome.topScore).toBe(0);
  });

  // The calibration case that originally motivated (and later helped kill) document
  // corroboration: three distinct documents, but none clear T_FLOOR, so this still grades none.
  it('three low-scoring chunks spanning three distinct documents still grade as none', () => {
    const chunks = [
      chunk({ slug: 'identity', score: 0.096 }),
      chunk({ slug: 'stack', score: 0.081 }),
      chunk({ slug: 'faq', score: 0.052 }),
    ];

    const outcome = grade(chunks);

    expect(outcome.verdict).toBe('none');
    expect(new Set(chunks.map((c) => c.slug)).size).toBe(3); // sanity: the input really is 3 docs
  });
});

describe('grade: weak', () => {
  it('grades as weak when the top score clears T_FLOOR but not T_STRONG', () => {
    const outcome = grade([chunk({ slug: 'a', score: (T_FLOOR + T_STRONG) / 2 })]);
    expect(outcome.verdict).toBe('weak');
  });

  it('names the top chunk as closestChunk on a weak verdict', () => {
    const top = chunk({ slug: 'identity', score: T_FLOOR + 0.02 });
    const outcome = grade([top, chunk({ slug: 'stack', score: T_FLOOR })]);
    expect(outcome.verdict).toBe('weak');
    if (outcome.verdict === 'weak') {
      expect(outcome.closestChunk?.slug).toBe('identity');
    }
  });
});

describe('grade: strong', () => {
  // The case the old corroboration check used to block. Whether it's also *answerable* is
  // judged later by the model (lib/ask/generate.ts); grade() only decides "worth generating over."
  it('grades as strong when the top score alone clears T_STRONG, even from a single document', () => {
    const outcome = grade([chunk({ slug: 'faq', score: T_STRONG + 0.02 })]);

    expect(outcome.verdict).toBe('strong');
    if (outcome.verdict === 'strong') {
      expect(outcome.strong.topScore).toBeCloseTo(T_STRONG + 0.02);
      expect(outcome.strong.chunks).toHaveLength(1);
    }
  });

  it('grades as strong at exactly T_STRONG (boundary is inclusive)', () => {
    const outcome = grade([chunk({ slug: 'faq', score: T_STRONG })]);

    expect(outcome.verdict).toBe('strong');
  });

  it('carries every retrieved chunk through onto the strong outcome, not just the top one', () => {
    const chunks = [
      chunk({ slug: 'faq', score: T_STRONG + 0.05 }),
      chunk({ slug: 'identity', score: T_FLOOR }),
      chunk({ slug: 'stack', score: 0.05 }),
    ];

    const outcome = grade(chunks);

    expect(outcome.verdict).toBe('strong');
    if (outcome.verdict === 'strong') {
      expect(outcome.strong.chunks).toHaveLength(3);
    }
  });
});
