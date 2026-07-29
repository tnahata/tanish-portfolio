import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Behavioural tests for lib/ask/retrieve.ts. As a service, it orchestrates the corpus-meta and
 *  chunks repositories plus embed.ts; all three are mocked at the module boundary. The vector
 *  query itself (limit, ordering, similarity formula) is lib/ask/chunks.ts's own concern and is
 *  covered by tests/ask/chunks.test.ts instead. */

const fetchCorpusMetaMock = vi.fn();
const searchChunksMock = vi.fn();
const embedQueryMock = vi.fn();

vi.mock('../../lib/ask/corpus-meta', () => ({
  fetchCorpusMeta: (...args: unknown[]) => fetchCorpusMetaMock(...args),
}));

vi.mock('../../lib/ask/chunks', () => ({
  searchChunks: (...args: unknown[]) => searchChunksMock(...args),
}));

vi.mock('../../lib/ask/embed', () => ({
  embedQuery: (...args: unknown[]) => embedQueryMock(...args),
  EMBED_MODEL: 'text-embedding-3-large',
  EMBED_DIMENSIONS: 1024,
}));

import {
  assertCorpusMatchesRunningConfig,
  retrieve,
  AskCorpusMismatchError,
} from '../../lib/ask/retrieve';

const MATCHING_CORPUS_META = {
  embedModel: 'text-embedding-3-large',
  embedDims: 1024,
  corpusHash: 'hash',
};

function chunkRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    slug: 'identity',
    title: 'Who Tanish Is',
    route: '/',
    verbatimOnly: false,
    heading: 'Current situation',
    content: 'He works out of San Francisco.',
    score: 0.42,
    ...overrides,
  };
}

beforeEach(() => {
  fetchCorpusMetaMock.mockReset();
  searchChunksMock.mockReset();
  embedQueryMock.mockReset();
});

describe('assertCorpusMatchesRunningConfig', () => {
  it('resolves silently when corpus_meta matches the running embed config', async () => {
    fetchCorpusMetaMock.mockResolvedValueOnce(MATCHING_CORPUS_META);
    await expect(assertCorpusMatchesRunningConfig()).resolves.toBeUndefined();
  });

  it('throws AskCorpusMismatchError when corpus_meta has no row', async () => {
    fetchCorpusMetaMock.mockResolvedValue(null);
    await expect(assertCorpusMatchesRunningConfig()).rejects.toThrow(AskCorpusMismatchError);
    await expect(assertCorpusMatchesRunningConfig()).rejects.toThrow(/never been ingested/);
  });

  it('throws AskCorpusMismatchError when embed_model disagrees', async () => {
    fetchCorpusMetaMock.mockResolvedValueOnce({ ...MATCHING_CORPUS_META, embedModel: 'text-embedding-3-small' });
    await expect(assertCorpusMatchesRunningConfig()).rejects.toThrow(AskCorpusMismatchError);
  });

  it('throws AskCorpusMismatchError when embed_dims disagrees', async () => {
    fetchCorpusMetaMock.mockResolvedValueOnce({ ...MATCHING_CORPUS_META, embedDims: 256 });
    await expect(assertCorpusMatchesRunningConfig()).rejects.toThrow(AskCorpusMismatchError);
  });
});

describe('retrieve: query construction', () => {
  it('embeds the bare question when there is no previous question', async () => {
    fetchCorpusMetaMock.mockResolvedValueOnce(MATCHING_CORPUS_META);
    searchChunksMock.mockResolvedValueOnce([chunkRow()]);
    embedQueryMock.mockResolvedValueOnce({ embedding: [0.1], tokensUsed: 5 });

    await retrieve('What does Tanish do at FedEx?', null);

    expect(embedQueryMock).toHaveBeenCalledWith('What does Tanish do at FedEx?');
  });

  it('concatenates previousQuestion + currentQuestion for a follow-up', async () => {
    fetchCorpusMetaMock.mockResolvedValueOnce(MATCHING_CORPUS_META);
    searchChunksMock.mockResolvedValueOnce([chunkRow()]);
    embedQueryMock.mockResolvedValueOnce({ embedding: [0.1], tokensUsed: 6 });

    await retrieve('What about the caching part?', 'How does ESMON store data?');

    expect(embedQueryMock).toHaveBeenCalledWith(
      'How does ESMON store data? What about the caching part?'
    );
  });

  it('does not concatenate when previousQuestion is omitted (undefined)', async () => {
    fetchCorpusMetaMock.mockResolvedValueOnce(MATCHING_CORPUS_META);
    searchChunksMock.mockResolvedValueOnce([chunkRow()]);
    embedQueryMock.mockResolvedValueOnce({ embedding: [0.1], tokensUsed: 5 });

    await retrieve('A fresh question');

    expect(embedQueryMock).toHaveBeenCalledWith('A fresh question');
  });
});

describe('retrieve: row mapping and limit', () => {
  it('returns chunks from the repository as RetrievedChunk, unchanged', async () => {
    fetchCorpusMetaMock.mockResolvedValueOnce(MATCHING_CORPUS_META);
    searchChunksMock.mockResolvedValueOnce([chunkRow({ slug: 'faq', verbatimOnly: true, score: 0.55 })]);
    embedQueryMock.mockResolvedValueOnce({ embedding: [0.1], tokensUsed: 5 });

    const result = await retrieve('question');

    expect(result.chunks).toEqual([
      {
        slug: 'faq',
        title: 'Who Tanish Is',
        route: '/',
        heading: 'Current situation',
        content: 'He works out of San Francisco.',
        score: 0.55,
        verbatimOnly: true,
      },
    ]);
    expect(result.embedTokensUsed).toBe(5);
  });

  it('requests a limit of 8 (TOP_K) from the chunk-search repository', async () => {
    fetchCorpusMetaMock.mockResolvedValueOnce(MATCHING_CORPUS_META);
    searchChunksMock.mockResolvedValueOnce([]);
    embedQueryMock.mockResolvedValueOnce({ embedding: [0.1, 0.2], tokensUsed: 3 });

    await retrieve('question');

    expect(searchChunksMock).toHaveBeenCalledWith([0.1, 0.2], 8);
  });

  it('returns an empty chunk list when the index has no rows, without throwing', async () => {
    fetchCorpusMetaMock.mockResolvedValueOnce(MATCHING_CORPUS_META);
    searchChunksMock.mockResolvedValueOnce([]);
    embedQueryMock.mockResolvedValueOnce({ embedding: [0.1], tokensUsed: 4 });

    const result = await retrieve('off-task question');

    expect(result.chunks).toEqual([]);
  });
});

describe('retrieve: corpus_meta assertion runs before embedding', () => {
  it('throws before calling embedQuery when corpus_meta is mismatched', async () => {
    fetchCorpusMetaMock.mockResolvedValueOnce({
      ...MATCHING_CORPUS_META,
      embedModel: 'text-embedding-3-small',
      embedDims: 1536,
    });

    await expect(retrieve('question')).rejects.toThrow(AskCorpusMismatchError);
    expect(embedQueryMock).not.toHaveBeenCalled();
  });
});
