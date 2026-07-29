import { describe, expect, it } from 'vitest';
import { refusalCopyFor } from '../../lib/ask/refusals';

/**
 * Pure-logic tests for refusal copy: no database, no network call, no mock needed.
 */

describe('refusalCopyFor: determinism', () => {
  it('returns the exact same message for the exact same question, called repeatedly', () => {
    const question = 'Has he worked with Rust?';
    const first = refusalCopyFor('refused_off_task', question);
    const second = refusalCopyFor('refused_off_task', question);
    const third = refusalCopyFor('refused_off_task', question);
    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });

  it('can select different variants for different questions', () => {
    const messages = new Set(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(
        (q) => refusalCopyFor('refused_no_grounding', q).message
      )
    );
    // Not every question has to land on a different variant, but across eight distinct
    // questions the three variants should not all collapse onto a single one.
    expect(messages.size).toBeGreaterThan(1);
  });
});

describe('refusalCopyFor: capture offer per bucket', () => {
  it('offers capture for refused_no_grounding (weak: the corpus is nearby but silent)', () => {
    expect(refusalCopyFor('refused_no_grounding', 'q').offerCapture).toBe(true);
  });

  it('does not offer capture for refused_off_task (none: nothing in the corpus is close)', () => {
    expect(refusalCopyFor('refused_off_task', 'q').offerCapture).toBe(false);
  });

  it('offers capture for refused_unanswerable (strong grounding, model judged it does not answer)', () => {
    expect(refusalCopyFor('refused_unanswerable', 'q').offerCapture).toBe(true);
  });
});

describe('refusalCopyFor: copy content', () => {
  it('never returns an empty message for any bucket', () => {
    for (const outcome of ['refused_no_grounding', 'refused_off_task', 'refused_unanswerable'] as const) {
      expect(refusalCopyFor(outcome, 'anything').message.length).toBeGreaterThan(0);
    }
  });

  it('never uses an em-dash, per this project\'s writing constraint', () => {
    for (const outcome of ['refused_no_grounding', 'refused_off_task', 'refused_unanswerable'] as const) {
      for (const q of ['a', 'b', 'c', 'd']) {
        expect(refusalCopyFor(outcome, q).message).not.toContain('—');
      }
    }
  });
});
