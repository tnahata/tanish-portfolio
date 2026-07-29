import { describe, it, expect, vi } from 'vitest';
import type { QueryResult, QueryResultRow } from 'pg';
import { chunkDocument } from '../../lib/ask/chunk';
import type { AskQueryFn } from '../../lib/ask/db';
import type { EmbedBatchResult } from '../../lib/ask/embed';
import type { CorpusDocument } from '../../lib/ask/types';
import {
  assertSchemaExists,
  planDocumentChunks,
  reconcileCorpus,
  AskIngestEmptyCorpusError,
  AskIngestMissingGrantError,
  AskIngestSchemaMissingError,
  type ExistingChunkRef,
  type IngestRuntime,
} from '../../scripts/ingest';

/**
 * Behavioural tests for the ingest reconcile, with the database and OpenAI both mocked.
 *
 * `reconcileCorpus` is exercised against `FakeRuntime`, an in-memory stand-in for `documents`
 * and `chunks` that answers the exact SQL shapes `scripts/ingest.ts` issues. Nothing here
 * opens a real connection or calls OpenAI: `embed` is a `vi.fn`, so every assertion about
 * "was OpenAI called" is a call-count assertion on that mock, not an inference from output.
 *
 * `planDocumentChunks` is also tested directly: it is the pure decision function the reconcile
 * is built on (see docs/ask-agent/02-ingest.md, "four things make an embedding stale"), and
 * testing it standalone covers the ordinal/hash logic without any I/O at all.
 */

interface FakeDocumentRow {
  id: string;
  slug: string;
  source: string;
  route: string | null;
  external_url: string | null;
  title: string;
  kind: string;
  verbatim_only: boolean;
}

interface FakeChunkRow {
  document_id: string;
  ordinal: number;
  heading: string | null;
  content: string;
  content_hash: string;
  token_count: number;
  embedding: string;
}

function makeResult<Row extends QueryResultRow>(rows: Row[]): QueryResult<Row> {
  return { rows, rowCount: rows.length, command: '', oid: 0, fields: [] } as QueryResult<Row>;
}

/**
 * A minimal in-memory `documents`/`chunks` pair, driven purely by pattern-matching the SQL
 * text `scripts/ingest.ts` sends. `ON DELETE CASCADE` on `chunks.document_id` is simulated by
 * hand in the sweep branch, matching `db/schema.sql`.
 */
function createFakeRuntime(initial: {
  documents: FakeDocumentRow[];
  chunks: FakeChunkRow[];
}): IngestRuntime & { documents: FakeDocumentRow[]; chunks: FakeChunkRow[] } {
  const documents = [...initial.documents];
  const chunks = [...initial.chunks];
  let nextId = 1000;
  const newId = (): string => `fake-${nextId++}`;

  async function fakeQueryImpl(
    text: string,
    params: unknown[]
  ): Promise<QueryResult<Record<string, unknown>>> {
    const sql = text.replace(/\s+/g, ' ').trim();

    if (sql.startsWith('select id, slug from documents where source')) {
      const [source] = params as [string];
      const rows = documents.filter((d) => d.source === source).map((d) => ({ id: d.id, slug: d.slug }));
      return makeResult(rows);
    }

    if (sql.startsWith('select document_id, ordinal, content_hash from chunks')) {
      const [ids] = params as [string[]];
      const rows = chunks
        .filter((c) => ids.includes(c.document_id))
        .map((c) => ({ document_id: c.document_id, ordinal: c.ordinal, content_hash: c.content_hash }));
      return makeResult(rows);
    }

    if (sql.startsWith('insert into documents')) {
      const [slug, source, route, externalUrl, title, kind, verbatimOnly] = params as [
        string,
        string,
        string | null,
        string | null,
        string,
        string,
        boolean,
      ];
      let doc = documents.find((d) => d.slug === slug);
      let inserted = false;
      if (!doc) {
        doc = {
          id: newId(),
          slug,
          source,
          route,
          external_url: externalUrl,
          title,
          kind,
          verbatim_only: verbatimOnly,
        };
        documents.push(doc);
        inserted = true;
      } else {
        doc.route = route;
        doc.external_url = externalUrl;
        doc.title = title;
        doc.kind = kind;
        doc.verbatim_only = verbatimOnly;
      }
      return makeResult([{ id: doc.id, inserted }]);
    }

    if (sql.startsWith('insert into chunks')) {
      const [documentId, ordinal, heading, content, contentHash, tokenCount, embedding] = params as [
        string,
        number,
        string | null,
        string,
        string,
        number,
        string,
      ];
      const existingChunk = chunks.find((c) => c.document_id === documentId && c.ordinal === ordinal);
      if (existingChunk) {
        Object.assign(existingChunk, {
          heading,
          content,
          content_hash: contentHash,
          token_count: tokenCount,
          embedding,
        });
      } else {
        chunks.push({
          document_id: documentId,
          ordinal,
          heading,
          content,
          content_hash: contentHash,
          token_count: tokenCount,
          embedding,
        });
      }
      return makeResult([]);
    }

    if (sql.startsWith('delete from chunks where document_id')) {
      const [documentId, ordinals] = params as [string, number[]];
      for (let i = chunks.length - 1; i >= 0; i--) {
        if (chunks[i].document_id === documentId && ordinals.includes(chunks[i].ordinal)) {
          chunks.splice(i, 1);
        }
      }
      return makeResult([]);
    }

    if (sql.startsWith('delete from documents where source')) {
      const [source, desiredSlugs] = params as [string, string[]];
      const toDelete = documents.filter((d) => d.source === source && !desiredSlugs.includes(d.slug));
      for (const doc of toDelete) {
        const index = documents.indexOf(doc);
        documents.splice(index, 1);
        for (let i = chunks.length - 1; i >= 0; i--) {
          if (chunks[i].document_id === doc.id) chunks.splice(i, 1);
        }
      }
      return makeResult(toDelete.map((d) => ({ slug: d.slug })));
    }

    if (sql.startsWith('insert into corpus_meta')) {
      return makeResult([]);
    }

    throw new Error(`fake runtime: unhandled query: ${sql}`);
  }

  const query = fakeQueryImpl as unknown as AskQueryFn;
  const withTransaction = async <T,>(callback: (txQuery: AskQueryFn) => Promise<T>): Promise<T> =>
    callback(query);

  return {
    documents,
    chunks,
    query,
    withTransaction,
    embed: vi.fn(),
  };
}

function makeDocument(overrides: Partial<CorpusDocument> & { slug: string; content: string }): CorpusDocument {
  return {
    title: 'Test title',
    kind: 'page',
    source: 'file',
    route: '/test',
    externalUrl: null,
    verbatimOnly: false,
    filePath: `${overrides.slug}.md`,
    ...overrides,
  };
}

function successfulEmbed(dims = 4): (texts: string[]) => Promise<EmbedBatchResult> {
  return async (texts: string[]) => ({
    embeddings: texts.map(() => Array.from({ length: dims }, () => 0.1)),
    tokensUsed: texts.length * 10,
  });
}

describe('planDocumentChunks', () => {
  it('treats a chunk with no stored ordinal as needing embedding', () => {
    const chunks = chunkDocument('Brand new content, never seen before.');

    const plan = planDocumentChunks(chunks, [], false);

    expect(plan.toEmbed).toEqual(chunks);
    expect(plan.toSkip).toEqual([]);
    expect(plan.obsoleteOrdinals).toEqual([]);
  });

  it('skips a chunk whose content_hash matches what is stored', () => {
    const chunks = chunkDocument('Content that has not changed.');
    const existing: ExistingChunkRef[] = chunks.map((c) => ({ ordinal: c.ordinal, contentHash: c.contentHash }));

    const plan = planDocumentChunks(chunks, existing, false);

    expect(plan.toEmbed).toEqual([]);
    expect(plan.toSkip).toEqual(chunks);
  });

  it('re-embeds every chunk under force, even when every hash still matches', () => {
    const chunks = chunkDocument('Content that has not changed.');
    const existing: ExistingChunkRef[] = chunks.map((c) => ({ ordinal: c.ordinal, contentHash: c.contentHash }));

    const plan = planDocumentChunks(chunks, existing, true);

    expect(plan.toEmbed).toEqual(chunks);
    expect(plan.toSkip).toEqual([]);
  });

  it('marks ordinals beyond the new chunk count as obsolete, for a shortened file', () => {
    const newChunks = [{ ordinal: 0, heading: null, content: 'a', contentHash: 'hash-a', tokenCount: 1 }];
    const existing: ExistingChunkRef[] = [
      { ordinal: 0, contentHash: 'hash-a' },
      { ordinal: 1, contentHash: 'hash-b' },
      { ordinal: 2, contentHash: 'hash-c' },
    ];

    const plan = planDocumentChunks(newChunks, existing, false);

    expect(plan.obsoleteOrdinals).toEqual([1, 2]);
    expect(plan.toSkip.map((c) => c.ordinal)).toEqual([0]);
  });
});

describe('reconcileCorpus: unchanged content', () => {
  it('calls OpenAI zero times when every chunk hash already matches', async () => {
    const content = 'Stable content that never changes between runs.';
    const chunks = chunkDocument(content);
    const doc = makeDocument({ slug: 'stable-doc', content });

    const runtime = createFakeRuntime({
      documents: [
        {
          id: 'doc-stable',
          slug: 'stable-doc',
          source: 'file',
          route: '/test',
          external_url: null,
          title: 'Test title',
          kind: 'page',
          verbatim_only: false,
        },
      ],
      chunks: chunks.map((c) => ({
        document_id: 'doc-stable',
        ordinal: c.ordinal,
        heading: c.heading,
        content: c.content,
        content_hash: c.contentHash,
        token_count: c.tokenCount,
        embedding: '[0.1,0.1]',
      })),
    });
    const embed = vi.fn(successfulEmbed());

    const summary = await reconcileCorpus([doc], { force: false }, { ...runtime, embed });

    expect(embed).not.toHaveBeenCalled();
    expect(summary.chunksEmbedded).toBe(0);
    expect(summary.chunksSkipped).toBe(chunks.length);
  });
});

describe('reconcileCorpus: edited content', () => {
  it('re-embeds a chunk whose content_hash changed, exactly once', async () => {
    const originalContent = 'Original wording before the edit.';
    const editedContent = 'Original wording after the edit.';
    const originalChunks = chunkDocument(originalContent);
    const doc = makeDocument({ slug: 'edited-doc', content: editedContent });

    const runtime = createFakeRuntime({
      documents: [
        {
          id: 'doc-edited',
          slug: 'edited-doc',
          source: 'file',
          route: '/test',
          external_url: null,
          title: 'Test title',
          kind: 'page',
          verbatim_only: false,
        },
      ],
      chunks: originalChunks.map((c) => ({
        document_id: 'doc-edited',
        ordinal: c.ordinal,
        heading: c.heading,
        content: c.content,
        content_hash: c.contentHash,
        token_count: c.tokenCount,
        embedding: '[0.1,0.1]',
      })),
    });
    const embed = vi.fn(successfulEmbed());

    const summary = await reconcileCorpus([doc], { force: false }, { ...runtime, embed });

    expect(embed).toHaveBeenCalledTimes(1);
    expect(summary.chunksEmbedded).toBe(1);
    const storedChunk = runtime.chunks.find((c) => c.document_id === 'doc-edited');
    expect(storedChunk?.content_hash).not.toBe(originalChunks[0].contentHash);
  });
});

describe('reconcileCorpus: shortened document', () => {
  it('deletes chunks whose ordinal is beyond the new, shorter chunk count', async () => {
    const words = (prefix: string): string =>
      Array.from({ length: 14 }, (_, w) => `${prefix}w${w}`).join(' ');
    const section = (heading: string, lines: number): string =>
      `## ${heading}\n\n${Array.from({ length: lines }, (_, i) => words(`${heading}${i}`)).join('\n')}`;

    const longContent = [section('Alpha', 20), section('Beta', 20), section('Gamma', 20)].join('\n\n');
    const longChunks = chunkDocument(longContent);
    expect(longChunks.length).toBeGreaterThan(1);

    const shortContent = section('Alpha', 2);
    const shortChunks = chunkDocument(shortContent);
    expect(shortChunks.length).toBeLessThan(longChunks.length);

    const doc = makeDocument({ slug: 'shrinking-doc', content: shortContent });
    const runtime = createFakeRuntime({
      documents: [
        {
          id: 'doc-shrink',
          slug: 'shrinking-doc',
          source: 'file',
          route: '/test',
          external_url: null,
          title: 'Test title',
          kind: 'page',
          verbatim_only: false,
        },
      ],
      chunks: longChunks.map((c) => ({
        document_id: 'doc-shrink',
        ordinal: c.ordinal,
        heading: c.heading,
        content: c.content,
        content_hash: c.contentHash,
        token_count: c.tokenCount,
        embedding: '[0.1,0.1]',
      })),
    });
    const embed = vi.fn(successfulEmbed());

    const summary = await reconcileCorpus([doc], { force: false }, { ...runtime, embed });

    const remainingOrdinals = runtime.chunks
      .filter((c) => c.document_id === 'doc-shrink')
      .map((c) => c.ordinal)
      .sort((a, b) => a - b);
    expect(remainingOrdinals).toEqual(shortChunks.map((c) => c.ordinal));
    expect(summary.chunksDeleted).toBe(longChunks.length - shortChunks.length);
  });
});

describe('reconcileCorpus: deletion sweep', () => {
  it('sweeps a document deleted from disk, and never touches a source = asked row', async () => {
    const survivingContent = 'This document is still on disk.';
    const doc = makeDocument({ slug: 'still-here', content: survivingContent });

    const runtime = createFakeRuntime({
      documents: [
        {
          id: 'doc-gone',
          slug: 'gone-from-disk',
          source: 'file',
          route: '/gone',
          external_url: null,
          title: 'Gone',
          kind: 'page',
          verbatim_only: false,
        },
        {
          id: 'doc-asked',
          slug: 'published-gap-answer',
          source: 'asked',
          route: '/asked',
          external_url: null,
          title: 'Published answer',
          kind: 'asked',
          verbatim_only: false,
        },
        {
          id: 'doc-stay',
          slug: 'still-here',
          source: 'file',
          route: '/test',
          external_url: null,
          title: 'Test title',
          kind: 'page',
          verbatim_only: false,
        },
      ],
      chunks: [
        {
          document_id: 'doc-gone',
          ordinal: 0,
          heading: null,
          content: 'gone content',
          content_hash: 'hash-gone',
          token_count: 5,
          embedding: '[0.1]',
        },
        {
          document_id: 'doc-asked',
          ordinal: 0,
          heading: null,
          content: 'asked content',
          content_hash: 'hash-asked',
          token_count: 5,
          embedding: '[0.1]',
        },
      ],
    });
    const embed = vi.fn(successfulEmbed());

    const summary = await reconcileCorpus([doc], { force: false }, { ...runtime, embed });

    expect(summary.documentsDeleted).toBe(1);
    expect(runtime.documents.find((d) => d.slug === 'gone-from-disk')).toBeUndefined();
    expect(runtime.chunks.some((c) => c.document_id === 'doc-gone')).toBe(false);

    const askedDoc = runtime.documents.find((d) => d.slug === 'published-gap-answer');
    expect(askedDoc).toBeDefined();
    expect(runtime.chunks.some((c) => c.document_id === 'doc-asked')).toBe(true);
  });
});

/**
 * An empty desired corpus is never a legitimate reconcile (see `AskIngestEmptyCorpusError`
 * on `reconcileCorpus`): the bug this guards against is Postgres evaluating
 * `slug <> all($1::text[])` as vacuously true for every row when `$1` is empty, so
 * `sweepDeletedDocuments` would otherwise delete every file-sourced document. The second
 * test below is the one that actually exercises that bug: it seeds a file-sourced document
 * so there is something for the old, unguarded sweep to wrongly delete. Before the guard
 * existed, that test failed with `summary.documentsDeleted` equal to `1`, not `0`, proving
 * the predicate matches real rows rather than passing vacuously on an already-empty table.
 */
describe('reconcileCorpus: empty corpus guard', () => {
  it('refuses when the corpus is empty and no documents exist', async () => {
    const runtime = createFakeRuntime({ documents: [], chunks: [] });
    const embed = vi.fn(successfulEmbed());

    await expect(reconcileCorpus([], { force: false }, { ...runtime, embed })).rejects.toThrow(
      AskIngestEmptyCorpusError
    );

    expect(embed).not.toHaveBeenCalled();
  });

  it('refuses when the corpus is empty and file-sourced documents exist, before opening a transaction or calling OpenAI', async () => {
    const runtime = createFakeRuntime({
      documents: [
        {
          id: 'doc-should-survive',
          slug: 'should-survive',
          source: 'file',
          route: '/test',
          external_url: null,
          title: 'Should survive',
          kind: 'page',
          verbatim_only: false,
        },
      ],
      chunks: [],
    });

    let queryCalls = 0;
    let transactionCalls = 0;
    const guardedQuery = ((text: string, params: unknown[]) => {
      queryCalls++;
      return runtime.query(text, params);
    }) as unknown as AskQueryFn;
    const guardedWithTransaction = async <T,>(
      callback: (txQuery: AskQueryFn) => Promise<T>
    ): Promise<T> => {
      transactionCalls++;
      return runtime.withTransaction(callback);
    };
    const embed = vi.fn(successfulEmbed());

    await expect(
      reconcileCorpus(
        [],
        { force: false },
        { query: guardedQuery, withTransaction: guardedWithTransaction, embed }
      )
    ).rejects.toThrow(AskIngestEmptyCorpusError);

    expect(queryCalls).toBe(0);
    expect(transactionCalls).toBe(0);
    expect(embed).not.toHaveBeenCalled();
    expect(runtime.documents.find((d) => d.slug === 'should-survive')).toBeDefined();
  });
});

/**
 * `assertSchemaExists` is the preflight the brief asked for directly: it is what turns a raw
 * Postgres error (a missing relation, or a missing grant) into a message that names the fix,
 * before `main` does anything else. Exercised here against a fake `AskQueryFn` that answers by
 * pattern-matching the exact SQL text the function sends, the same style `createFakeRuntime`
 * above uses, with no real database or OpenAI call anywhere near it.
 */
describe('assertSchemaExists', () => {
  interface FakeSchemaCheckOptions {
    /** Row returned for the to_regclass/to_regtype probe. Defaults to "schema present". */
    schemaRow?: { documents_reg: string | null; vector_reg: string | null };
    /** Postgres error code to throw for `select 1 from <table> limit 0`, keyed by table name. */
    tableErrorCodes?: Partial<Record<'corpus_meta' | 'documents' | 'chunks', string>>;
  }

  function makeSchemaCheckQuery(options: FakeSchemaCheckOptions): { query: AskQueryFn; calls: string[] } {
    const calls: string[] = [];

    const query = (async (text: string, _params: unknown[]) => {
      const sql = text.replace(/\s+/g, ' ').trim();
      calls.push(sql);

      if (sql.startsWith("select to_regclass('public.documents')")) {
        return makeResult([options.schemaRow ?? { documents_reg: 'documents', vector_reg: 'vector' }]);
      }

      const tableMatch = sql.match(/^select 1 from (\w+) limit 0$/);
      if (tableMatch) {
        const table = tableMatch[1] as 'corpus_meta' | 'documents' | 'chunks';
        const code = options.tableErrorCodes?.[table];
        if (code) {
          const err = new Error(`simulated failure for ${table}`) as Error & { code: string };
          err.code = code;
          throw err;
        }
        return makeResult([]);
      }

      throw new Error(`fake schema-check query: unhandled SQL: ${sql}`);
    }) as unknown as AskQueryFn;

    return { query, calls };
  }

  it('resolves without throwing when the schema exists and every corpus table is reachable', async () => {
    const { query, calls } = makeSchemaCheckQuery({});

    await expect(assertSchemaExists(query)).resolves.toBeUndefined();
    // The schema probe, then one reachability probe per corpus table.
    expect(calls).toHaveLength(4);
  });

  it('throws AskIngestSchemaMissingError when public.documents does not resolve', async () => {
    const { query, calls } = makeSchemaCheckQuery({
      schemaRow: { documents_reg: null, vector_reg: 'vector' },
    });

    await expect(assertSchemaExists(query)).rejects.toThrow(AskIngestSchemaMissingError);
    // Fails on the first round trip; never probes an individual corpus table afterward.
    expect(calls).toHaveLength(1);
  });

  it('throws AskIngestSchemaMissingError when the vector type does not resolve', async () => {
    const { query, calls } = makeSchemaCheckQuery({
      schemaRow: { documents_reg: 'documents', vector_reg: null },
    });

    await expect(assertSchemaExists(query)).rejects.toThrow(AskIngestSchemaMissingError);
    expect(calls).toHaveLength(1);
  });

  it('throws AskIngestMissingGrantError naming the table when ask_ingest lacks a grant on it', async () => {
    const { query } = makeSchemaCheckQuery({
      tableErrorCodes: { chunks: '42501' },
    });

    await expect(assertSchemaExists(query)).rejects.toThrow(AskIngestMissingGrantError);
    await expect(assertSchemaExists(query)).rejects.toThrow(/chunks/);
  });

  it('maps an undefined-table error on a corpus table back to AskIngestSchemaMissingError', async () => {
    const { query } = makeSchemaCheckQuery({
      tableErrorCodes: { corpus_meta: '42P01' },
    });

    await expect(assertSchemaExists(query)).rejects.toThrow(AskIngestSchemaMissingError);
  });

  it('does not swallow an unrelated error from a table probe', async () => {
    const { query } = makeSchemaCheckQuery({
      tableErrorCodes: { documents: '53300' }, // too_many_connections: not a grant or schema problem
    });

    await expect(assertSchemaExists(query)).rejects.toThrow(/simulated failure for documents/);
  });
});
