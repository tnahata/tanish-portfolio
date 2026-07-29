import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chainMock } from './drizzle-mock';

/**
 * Behavioural tests for lib/ask/corpus-meta.ts. Database access is mocked at the `./db` module
 * boundary (`db()`, Drizzle-shaped), matching this task's other repository-module tests.
 */

const dbMock = vi.fn();

vi.mock('../../lib/ask/db', () => ({
  db: (...args: unknown[]) => dbMock(...args),
}));

import { fetchCorpusMeta } from '../../lib/ask/corpus-meta';
import { corpusMeta } from '../../lib/ask/schema';

beforeEach(() => {
  dbMock.mockReset();
});

describe('fetchCorpusMeta', () => {
  it('returns the row when corpus_meta has one', async () => {
    const chain = chainMock([{ embedModel: 'text-embedding-3-large', embedDims: 1024, corpusHash: 'abc123' }]);
    dbMock.mockReturnValueOnce(chain);

    const result = await fetchCorpusMeta();

    expect(result).toEqual({ embedModel: 'text-embedding-3-large', embedDims: 1024, corpusHash: 'abc123' });
    expect(chain.from).toHaveBeenCalledWith(corpusMeta);
    expect(chain.limit).toHaveBeenCalledWith(1);
  });

  it('returns null when corpus_meta has no row: the index has never been ingested', async () => {
    dbMock.mockReturnValueOnce(chainMock([]));
    expect(await fetchCorpusMeta()).toBeNull();
  });
});
