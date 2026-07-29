import { vi } from 'vitest';

/**
 * A thenable stand-in for a Drizzle query builder: every chain method returns itself, and
 * awaiting the chain resolves to `rows`. Used by repository-module tests (turns, session,
 * corpus-meta, chunks) that mock `lib/ask/db`'s `db()` export instead of the raw `query()` one.
 */

const CHAIN_METHODS = [
  'select',
  'from',
  'where',
  'limit',
  'orderBy',
  'innerJoin',
  'insert',
  'values',
  'update',
  'set',
  'returning',
] as const;

type ChainMethod = (typeof CHAIN_METHODS)[number];

export type DrizzleChainMock = Record<ChainMethod, ReturnType<typeof vi.fn>> & {
  then: (resolve: (rows: unknown) => void) => void;
};

/** Builds one chain: `rows` is what the chain resolves to when awaited. */
export function chainMock(rows: unknown = []): DrizzleChainMock {
  const chain = {} as DrizzleChainMock;
  for (const method of CHAIN_METHODS) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve) => resolve(rows);
  return chain;
}
