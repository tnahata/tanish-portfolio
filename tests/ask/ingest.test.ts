import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { EMBED_DIMS, EMBED_MODEL } from '../../lib/ask/config';
import * as corpusModule from '../../lib/ask/corpus';
import { EmptyCorpusError, ingest, planReconcile } from '../../lib/ask/ingest';
import type { ChunkMetadata, CorpusChunk } from '../../lib/ask/types';

vi.mock('../../lib/ask/corpus', () => ({ loadCorpus: vi.fn() }));

vi.mock('../../lib/ask/embed', () => ({
  embedOne: vi.fn(async () => new Array(EMBED_DIMS).fill(0.001)),
  embedMany: vi.fn(async (texts: string[]) => texts.map(() => new Array(EMBED_DIMS).fill(0.001))),
}));

function metadata(overrides: Partial<ChunkMetadata> = {}): ChunkMetadata {
  return {
    file: 'about.md',
    heading: 'Role',
    title: 'About',
    embedModel: EMBED_MODEL,
    dims: EMBED_DIMS,
    contentHash: 'hash-a',
    ...overrides,
  };
}

function vectorLiteral(fill: number): string {
  return `[${new Array(EMBED_DIMS).fill(fill).join(',')}]`;
}

describe('planReconcile', () => {
  it('treats a chunk whose content changed but whose id did not as an update, not an insert plus delete', () => {
    const desired: CorpusChunk[] = [
      { id: 'about#role', content: 'new content', metadata: metadata({ contentHash: 'hash-new' }) },
    ];
    const live = new Map([['about#role', 'hash-old']]);

    const plan = planReconcile(desired, live);

    expect(plan.update.map((c) => c.id)).toEqual(['about#role']);
    expect(plan.insert).toHaveLength(0);
    expect(plan.deleteIds).toHaveLength(0);
  });

  it('deletes a chunk that no longer exists in the desired corpus', () => {
    const desired: CorpusChunk[] = [
      { id: 'about#role', content: 'kept', metadata: metadata({ contentHash: 'hash-a' }) },
    ];
    const live = new Map([
      ['about#role', 'hash-a'],
      ['about#retired-section', 'hash-b'],
    ]);

    const plan = planReconcile(desired, live);

    expect(plan.deleteIds).toEqual(['about#retired-section']);
  });

  it('inserts a chunk with no live counterpart', () => {
    const desired: CorpusChunk[] = [
      { id: 'about#new-section', content: 'brand new', metadata: metadata({ contentHash: 'hash-new' }) },
    ];
    const live = new Map<string, string>();

    const plan = planReconcile(desired, live);

    expect(plan.insert.map((c) => c.id)).toEqual(['about#new-section']);
    expect(plan.update).toHaveLength(0);
    expect(plan.deleteIds).toHaveLength(0);
  });

  it('counts a chunk whose id and content hash both match live as unchanged, and re-embeds nothing', () => {
    const desired: CorpusChunk[] = [
      { id: 'about#role', content: 'same', metadata: metadata({ contentHash: 'hash-a' }) },
    ];
    const live = new Map([['about#role', 'hash-a']]);

    const plan = planReconcile(desired, live);

    expect(plan.unchanged).toBe(1);
    expect(plan.insert).toHaveLength(0);
    expect(plan.update).toHaveLength(0);
    expect(plan.deleteIds).toHaveLength(0);
  });

  it('refuses an empty desired corpus so the delete sweep cannot wipe a non-empty index', () => {
    const live = new Map([['about#role', 'hash-a']]);

    expect(() => planReconcile([], live)).toThrow(EmptyCorpusError);
  });

  it('computes insert, update, delete and unchanged together in a single reconcile', () => {
    const desired: CorpusChunk[] = [
      { id: 'about#role', content: 'unchanged', metadata: metadata({ contentHash: 'hash-a' }) },
      { id: 'about#bio', content: 'edited', metadata: metadata({ contentHash: 'hash-c-new' }) },
      { id: 'projects#new', content: 'new', metadata: metadata({ contentHash: 'hash-d' }) },
    ];
    const live = new Map([
      ['about#role', 'hash-a'],
      ['about#bio', 'hash-c-old'],
      ['about#gone', 'hash-e'],
    ]);

    const plan = planReconcile(desired, live);

    expect(plan.unchanged).toBe(1);
    expect(plan.update.map((c) => c.id)).toEqual(['about#bio']);
    expect(plan.insert.map((c) => c.id)).toEqual(['projects#new']);
    expect(plan.deleteIds).toEqual(['about#gone']);
  });
});

const TEST_DATABASE_URL = process.env.DATABASE_URL;

if (!TEST_DATABASE_URL) {
  console.warn(
    '[ingest.test.ts] DATABASE_URL is not set; skipping ingest() Postgres-backed tests. Start ' +
      '`docker run --rm -d -e POSTGRES_PASSWORD=postgres -p 55433:5432 pgvector/pgvector:pg16`, ' +
      'apply db/schema.sql, and export DATABASE_URL before running the suite.',
  );
}

/**
 * Each database-backed test file owns a private schema, scoped by mutating DATABASE_URL itself
 * (not just this file's own pool), so ingest() also lands there once it builds its own pool from
 * the same env var. A whole-table read in one file must never see another file's rows.
 */
const SCHEMA = `ask_test_ingest_${randomUUID().replace(/-/g, '_')}`;

if (TEST_DATABASE_URL) {
  const scoped = new URL(TEST_DATABASE_URL);
  scoped.searchParams.set('options', `-c search_path=${SCHEMA},public`);
  process.env.DATABASE_URL = scoped.toString();
}

const pool = TEST_DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : undefined;

function requirePool(): Pool {
  if (!pool) {
    throw new Error('Postgres pool requested without DATABASE_URL set');
  }
  return pool;
}

async function readSchemaSql(): Promise<string> {
  const schemaPath = fileURLToPath(new URL('../../db/schema.sql', import.meta.url));
  return readFile(schemaPath, 'utf8');
}

describe.skipIf(!TEST_DATABASE_URL)('ingest() reconcile against a live database', () => {
  const prefix = `ingest-test-${randomUUID()}`;

  beforeAll(async () => {
    const db = requirePool();
    await db.query(`create schema if not exists ${SCHEMA}`);
    await db.query(await readSchemaSql());
  });

  beforeEach(async () => {
    await requirePool().query('truncate table chunks');
    vi.mocked(corpusModule.loadCorpus).mockReset();
  });

  afterAll(async () => {
    await requirePool().query(`drop schema if exists ${SCHEMA} cascade`);
    await pool?.end();
  });

  it('applies insert, update and delete in one pass and leaves an unchanged chunk untouched', async () => {
    const db = requirePool();
    const keptId = `${prefix}#kept`;
    const updatedId = `${prefix}#updated`;
    const goneId = `${prefix}#gone`;
    const keptEmbedding = vectorLiteral(0.5);

    await db.query(
      `insert into chunks (id, content, metadata, embedding) values
       ($1, 'kept content', $2::jsonb, $3::vector),
       ($4, 'stale content', $5::jsonb, $3::vector),
       ($6, 'orphaned content', $7::jsonb, $3::vector)`,
      [
        keptId,
        JSON.stringify(metadata({ contentHash: 'hash-kept' })),
        keptEmbedding,
        updatedId,
        JSON.stringify(metadata({ contentHash: 'hash-old' })),
        goneId,
        JSON.stringify(metadata({ contentHash: 'hash-gone' })),
      ],
    );

    vi.mocked(corpusModule.loadCorpus).mockReturnValue([
      { id: keptId, content: 'kept content', metadata: metadata({ contentHash: 'hash-kept' }) },
      { id: updatedId, content: 'refreshed content', metadata: metadata({ contentHash: 'hash-new' }) },
    ]);

    await ingest('/fixtures/does-not-matter');

    const { rows } = await db.query<{ id: string; content: string; embedding: string }>(
      'select id, content, embedding::text as embedding from chunks where id = any($1) order by id',
      [[keptId, updatedId, goneId]],
    );

    expect(rows.map((r) => r.id)).toEqual([keptId, updatedId]);

    const kept = rows.find((r) => r.id === keptId);
    expect(kept?.content).toBe('kept content');
    expect(kept?.embedding).toBe(keptEmbedding);

    const updated = rows.find((r) => r.id === updatedId);
    expect(updated?.content).toBe('refreshed content');
  });

  it('refuses an empty desired corpus and leaves existing chunks in place', async () => {
    const db = requirePool();
    const survivorId = `${prefix}#survivor`;

    await db.query(
      `insert into chunks (id, content, metadata, embedding) values ($1, 'still here', $2::jsonb, $3::vector)`,
      [survivorId, JSON.stringify(metadata({ contentHash: 'hash-survivor' })), vectorLiteral(0.2)],
    );

    vi.mocked(corpusModule.loadCorpus).mockReturnValue([]);

    await expect(ingest('/fixtures/empty')).rejects.toThrow(EmptyCorpusError);

    const { rows } = await db.query('select id from chunks where id = $1', [survivorId]);
    expect(rows).toHaveLength(1);
  });
});
