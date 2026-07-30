import { describe, expect, it } from 'vitest';
import { T_FLOOR, T_STRONG, grade, type StrongGrounding } from '@/lib/ask/ground';
import type { RetrievedChunk } from '@/lib/ask/retrieve';

function chunk(similarity: number, overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    documentId: 'doc-1',
    slug: 'identity',
    title: 'Who Tanish Is',
    route: '/',
    ordinal: 0,
    heading: 'Current situation',
    content: 'some retrieved text',
    similarity,
    ...overrides,
  };
}

describe('grade', () => {
  it('grades strong when the top score clears T_STRONG', () => {
    const graded = grade([chunk(T_STRONG + 0.01)]);
    expect(graded.verdict).toBe('strong');
  });

  it('grades weak when the top score is between T_FLOOR and T_STRONG', () => {
    const graded = grade([chunk((T_FLOOR + T_STRONG) / 2)]);
    expect(graded.verdict).toBe('weak');
  });

  it('grades none when the top score is below T_FLOOR', () => {
    const graded = grade([chunk(T_FLOOR - 0.01)]);
    expect(graded.verdict).toBe('none');
  });

  it('grades none on an empty retrieval set rather than throwing', () => {
    const graded = grade([]);
    expect(graded.verdict).toBe('none');
    expect(graded.topScore).toBe(0);
  });

  it('treats a score exactly at T_STRONG as strong, and exactly at T_FLOOR as weak', () => {
    expect(grade([chunk(T_STRONG)]).verdict).toBe('strong');
    expect(grade([chunk(T_FLOOR)]).verdict).toBe('weak');
  });

  it('names the closest document on a weak verdict', () => {
    const graded = grade([chunk((T_FLOOR + T_STRONG) / 2, { slug: 'stack', title: 'Stack' })]);
    if (graded.verdict !== 'weak') throw new Error('expected weak');
    expect(graded.closestSlug).toBe('stack');
    expect(graded.closestTitle).toBe('Stack');
  });

  it('carries the graded chunks through on a strong verdict for generation to use', () => {
    const chunks = [chunk(T_STRONG + 0.1)];
    const graded = grade(chunks);
    if (graded.verdict !== 'strong') throw new Error('expected strong');
    expect(graded.strong.chunks).toBe(chunks);
    expect(graded.strong.topScore).toBeCloseTo(T_STRONG + 0.1);
  });

  it('rejects a hand-built object at compile time: the brand key cannot be named outside ground.ts', () => {
    // @ts-expect-error — StrongGrounding's brand is a non-exported unique symbol; no object literal
    // written outside lib/ask/ground.ts can satisfy this type without an explicit cast.
    const forged: StrongGrounding = { chunks: [], topScore: 1 };
    expect(forged).toBeDefined();
  });
});
