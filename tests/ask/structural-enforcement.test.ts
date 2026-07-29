import { describe, expect, it } from 'vitest';
import { generate } from '../../lib/ask/generate';
import { grade } from '../../lib/ask/ground';
import type { RetrievedChunk } from '../../lib/ask/retrieve';

/**
 * Regression guard for docs/ask-agent/04-retrieval-grounding.md: generate() takes a branded
 * StrongGrounding only the scorer can construct. The functions below are never called; their only
 * job is to fail `npx tsc --noEmit` if either @ts-expect-error stops being necessary. vitest
 * itself (esbuild, no type checking) never runs them.
 */

function attemptHandBuiltStrongGrounding(chunks: RetrievedChunk[]): void {
  // Every public field of StrongGrounding except the private brand only ground.ts can name.
  const handBuilt = { topScore: 0.9, chunks };
  // @ts-expect-error - handBuilt lacks the branded StrongGrounding symbol; must not type-check.
  void generate(handBuilt, 'question', []);
}

function attemptPassingWeakOrNoneOutcome(chunks: RetrievedChunk[]): void {
  const outcome = grade(chunks);
  // Only the `strong` branch carries `.strong`; the whole union must not type-check here.
  // @ts-expect-error - GroundingOutcome has no `strong` property in its weak/none branches.
  void generate(outcome, 'question', []);
}

describe('structural enforcement: generate() cannot accept unverified grounding', () => {
  // A placeholder assertion (vitest requires one); the real check is `npx tsc --noEmit` on this file.
  it('keeps the two @ts-expect-error guards above in the compiled surface', () => {
    expect(typeof attemptHandBuiltStrongGrounding).toBe('function');
    expect(typeof attemptPassingWeakOrNoneOutcome).toBe('function');
  });
});
