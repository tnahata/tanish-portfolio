import { beforeEach, describe, expect, it, vi } from 'vitest';

const { selectMock, getDbMock, embedTextsMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  getDbMock: vi.fn(),
  embedTextsMock: vi.fn(),
}));

vi.mock('@/lib/ask/db', () => ({ getDb: getDbMock }));
vi.mock('@/lib/ask/embed', () => ({ embedTexts: embedTextsMock }));

import { IngestConfigMismatchError, NoIngestRecordedError, retrieve } from '@/lib/ask/retrieve';

// Chain-returns-self stub matching the subset of the Drizzle query builder retrieve.ts calls
// (select/from/where/innerJoin/orderBy/limit), resolving to `result` when awaited.
function queryBuilder<T>(result: T): T & Record<string, (...args: unknown[]) => unknown> {
  const builder: Record<string, unknown> = {};
  for (const method of ['from', 'where', 'orderBy', 'limit', 'innerJoin']) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (resolve: (value: T) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return builder as T & Record<string, (...args: unknown[]) => unknown>;
}

const INGEST_ROW = [{ payload: { embed_model: 'text-embedding-3-large', dims: 1024, corpus_hash: 'x' } }];
const CHUNK_ROW = [
  {
    documentId: 'doc-1',
    slug: 'identity',
    title: 'Who Tanish Is',
    route: '/',
    ordinal: 0,
    heading: 'Current situation',
    content: 'He works out of San Francisco.',
    similarity: 0.55,
  },
];

beforeEach(() => {
  selectMock.mockReset();
  getDbMock.mockReset();
  embedTextsMock.mockReset();
  getDbMock.mockReturnValue({ select: selectMock });
  embedTextsMock.mockResolvedValue({ embeddings: [new Array(1024).fill(0.1)], tokensUsed: 5, model: 'text-embedding-3-large', dimensions: 1024 });
});

describe('retrieve', () => {
  it('throws NoIngestRecordedError when no ingest_completed event exists', async () => {
    selectMock.mockReturnValueOnce(queryBuilder([]));

    await expect(retrieve({ question: 'What is ESMON?' })).rejects.toThrow(NoIngestRecordedError);
    expect(embedTextsMock).not.toHaveBeenCalled();
  });

  it('throws IngestConfigMismatchError when the running embed config differs from the last ingest', async () => {
    selectMock.mockReturnValueOnce(queryBuilder([{ payload: { embed_model: 'text-embedding-3-small', dims: 1536 } }]));

    await expect(retrieve({ question: 'What is ESMON?' })).rejects.toThrow(IngestConfigMismatchError);
    expect(embedTextsMock).not.toHaveBeenCalled();
  });

  it('embeds the bare question when there is no previous turn', async () => {
    selectMock.mockReturnValueOnce(queryBuilder(INGEST_ROW)).mockReturnValueOnce(queryBuilder(CHUNK_ROW));

    await retrieve({ question: 'What is ESMON?' });

    expect(embedTextsMock).toHaveBeenCalledWith(['What is ESMON?']);
  });

  it('embeds previousQuestion + current question when the previous turn was answered', async () => {
    selectMock.mockReturnValueOnce(queryBuilder(INGEST_ROW)).mockReturnValueOnce(queryBuilder(CHUNK_ROW));

    await retrieve({ question: 'what about the caching part?', previousQuestion: 'How does HybridFit cut query load?' });

    expect(embedTextsMock).toHaveBeenCalledWith(['How does HybridFit cut query load? what about the caching part?']);
  });

  it('returns the retrieved rows as-is, similarity included', async () => {
    selectMock.mockReturnValueOnce(queryBuilder(INGEST_ROW)).mockReturnValueOnce(queryBuilder(CHUNK_ROW));

    const result = await retrieve({ question: 'What is ESMON?' });

    expect(result).toEqual(CHUNK_ROW);
  });
});
