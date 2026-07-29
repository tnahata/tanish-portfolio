import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chainMock } from './drizzle-mock';

/**
 * Behavioural tests for lib/ask/chunks.ts, the chunk-search repository shared by
 * lib/ask/retrieve.ts and scripts/search.ts. Database access is mocked at the `./db` boundary
 * (`db()`, Drizzle-shaped).
 */

const dbMock = vi.fn();

vi.mock('../../lib/ask/db', () => ({
  db: (...args: unknown[]) => dbMock(...args),
}));

import { searchChunks } from '../../lib/ask/chunks';
import { chunks, documents } from '../../lib/ask/schema';

beforeEach(() => {
  dbMock.mockReset();
});

const ROW = {
  slug: 'project-esmon',
  title: 'What ESMON is',
  route: '/projects/esmon',
  verbatimOnly: false,
  heading: 'Overview',
  content: 'ESMON parses raw binary journey data into filterable reports.',
  score: 0.5556,
};

describe('searchChunks', () => {
  it('joins chunks to documents, orders ascending by distance, and applies the limit', async () => {
    const chain = chainMock([ROW]);
    dbMock.mockReturnValueOnce(chain);

    const result = await searchChunks([0.1, 0.2], 8);

    expect(result).toEqual([ROW]);
    expect(chain.from).toHaveBeenCalledWith(chunks);
    expect(chain.innerJoin).toHaveBeenCalledTimes(1);
    expect(chain.innerJoin.mock.calls[0][0]).toBe(documents);
    expect(chain.orderBy).toHaveBeenCalledTimes(1);
    expect(chain.limit).toHaveBeenCalledWith(8);
  });

  it('selects the chunk-search projection: slug, title, route, verbatimOnly, heading, content, score', async () => {
    const chain = chainMock([]);
    dbMock.mockReturnValueOnce(chain);

    await searchChunks([0.1], 3);

    const projection = chain.select.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(projection).sort()).toEqual(
      ['content', 'heading', 'route', 'score', 'slug', 'title', 'verbatimOnly'].sort()
    );
  });

  it('forwards the requested limit exactly', async () => {
    const chain = chainMock([]);
    dbMock.mockReturnValueOnce(chain);

    await searchChunks([0.1], 3);

    expect(chain.limit).toHaveBeenCalledWith(3);
  });

  it('returns an empty array when the index has no rows, without throwing', async () => {
    dbMock.mockReturnValueOnce(chainMock([]));
    expect(await searchChunks([0.1], 8)).toEqual([]);
  });
});
