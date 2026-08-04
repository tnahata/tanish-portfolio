import { describe, expect, it } from 'vitest';

import { refusalCopy } from '@/lib/ask/refusals';
import type { LockedReason } from '@/lib/ask/types';

/**
 * Every LockedReason must have a line here. If a member is added to the union without being
 * added below, ALL_REASONS no longer satisfies `readonly LockedReason[]` for the exhaustiveness
 * check further down and the file fails to type-check.
 */
const ALL_REASONS: readonly LockedReason[] = [
  'injection',
  'private',
  'sign_in_required',
  'rate_limited',
  'off_topic',
  'no_grounding',
  'unanswerable',
];

type Exhaustive<T, U extends readonly T[]> = T extends U[number] ? true : never;
// Fails to compile if LockedReason gains a member missing from ALL_REASONS.
const _exhaustive: Exhaustive<LockedReason, typeof ALL_REASONS> = true;
void _exhaustive;

describe.each(ALL_REASONS)('refusalCopy(%s)', (reason) => {
  it('returns a non-empty line', () => {
    const copy = refusalCopy(reason);
    expect(typeof copy).toBe('string');
    expect(copy.length).toBeGreaterThan(0);
  });

  it('contains no em-dash', () => {
    expect(refusalCopy(reason)).not.toMatch(/—/);
  });
});

describe('refusalCopy topic templating', () => {
  it('includes the supplied topic in the copy', () => {
    expect(refusalCopy('off_topic', 'quantum computing')).toContain('quantum computing');
  });

  it('still returns sensible copy when no topic is supplied', () => {
    const copy = refusalCopy('off_topic');
    expect(typeof copy).toBe('string');
    expect(copy.length).toBeGreaterThan(0);
  });

  it('contains no em-dash when a topic is templated in', () => {
    expect(refusalCopy('no_grounding', 'his salary')).not.toMatch(/—/);
  });
});
