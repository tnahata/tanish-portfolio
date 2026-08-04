import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

import { EMBED_DIMS, EMBED_MODEL, T_FLOOR, T_STRONG } from '../../lib/ask/config';
import * as embedModule from '../../lib/ask/embed';
import { grade, IngestConfigMismatchError, retrieve } from '../../lib/ask/retrieve';
import type { ChunkMetadata, RetrievedChunk } from '../../lib/ask/types';

vi.mock('../../lib/ask/embed', () => ({
  embedOne: vi.fn(),
  embedMany: vi.fn(),
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

function chunk(score: number, id = 'c'): RetrievedChunk {
  return { id, content: 'x', score, metadata: metadata() };
}

describe('grade', () => {
  it('grades a top score exactly at T_STRONG as strong grounding', () => {
    const result = grade([chunk(T_STRONG, 'a')]);

    expect(result.verdict).toBe('strong');
    if (result.verdict === 'strong') {
      expect(result.grounding.topScore).toBe(T_STRONG);
      expect(result.grounding.chunks.map((c) => c.id)).toEqual(['a']);
    }
  });

  it('grades a top score exactly at T_FLOOR as weak, on the no_grounding side of the boundary', () => {
    const result = grade([chunk(T_FLOOR, 'a')]);

    expect(result.verdict).toBe('weak');
    if (result.verdict === 'weak') {
      expect(result.reason).toBe('no_grounding');
    }
  });

  it('grades every chunk below the floor as off topic', () => {
    const result = grade([chunk(T_FLOOR - 0.1, 'a'), chunk(T_FLOOR - 0.2, 'b')]);

    expect(result.verdict).toBe('off_topic');
    if (result.verdict === 'off_topic') {
      expect(result.reason).toBe('off_topic');
    }
  });

  it('excludes a trailing chunk below T_STRONG from the grounded context, even though the top score is strong', () => {
    const result = grade([chunk(0.55, 'top'), chunk(T_STRONG - 0.05, 'trailing')]);

    expect(result.verdict).toBe('strong');
    if (result.verdict === 'strong') {
      expect(result.grounding.chunks.map((c) => c.id)).toEqual(['top']);
    }
  });

  it('grades an empty chunk array as off topic rather than throwing', () => {
    const result = grade([]);

    expect(result.verdict).toBe('off_topic');
  });
});

const TEST_DATABASE_URL = process.env.DATABASE_URL;

if (!TEST_DATABASE_URL) {
  console.warn(
    '[retrieve.test.ts] DATABASE_URL is not set; skipping retrieve() Postgres-backed tests. Start ' +
      '`docker run --rm -d -e POSTGRES_PASSWORD=postgres -p 55433:5432 pgvector/pgvector:pg16`, ' +
      'apply db/schema.sql, and export DATABASE_URL before running the suite.',
  );
}

const pool = TEST_DATABASE_URL ? new Pool({ connectionString: TEST_DATABASE_URL }) : undefined;

function requirePool(): Pool {
  if (!pool) {
    throw new Error('Postgres pool requested without DATABASE_URL set');
  }
  return pool;
}

function unitVector(onesAt: number[]): number[] {
  const v = new Array(EMBED_DIMS).fill(0);
  const norm = Math.sqrt(onesAt.length);
  for (const i of onesAt) {
    v[i] = 1 / norm;
  }
  return v;
}

function vectorLiteral(values: number[]): string {
  return `[${values.join(',')}]`;
}

describe.skipIf(!TEST_DATABASE_URL)('retrieve() against a live database', () => {
  const prefix = `retrieve-test-${randomUUID()}`;

  afterEach(async () => {
    await requirePool().query('delete from chunks where id like $1', [`${prefix}%`]);
    vi.mocked(embedModule.embedOne).mockReset();
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('orders results best first by cosine similarity to the embedded question', async () => {
    const db = requirePool();
    const queryVector = unitVector([0, 1, 2, 3]);
    const bestId = `${prefix}#best`;
    const mediumId = `${prefix}#medium`;
    const worstId = `${prefix}#worst`;

    await db.query(
      `insert into chunks (id, content, metadata, embedding) values
       ($1, 'best match', $2::jsonb, $3::vector),
       ($4, 'medium match', $2::jsonb, $5::vector),
       ($6, 'worst match', $2::jsonb, $7::vector)`,
      [
        bestId,
        JSON.stringify(metadata()),
        vectorLiteral(queryVector),
        mediumId,
        vectorLiteral(unitVector([0, 1, 2, 500])),
        worstId,
        vectorLiteral(unitVector([600, 601, 602, 603])),
      ],
    );

    vi.mocked(embedModule.embedOne).mockResolvedValue(queryVector);

    const results = await retrieve('what is his role');

    expect(results.map((r) => r.id)).toEqual([bestId, mediumId, worstId]);
    expect(results[0].score).toBeGreaterThan(results[1].score);
    expect(results[1].score).toBeGreaterThan(results[2].score);
  });

  it('raises IngestConfigMismatchError when a retrieved chunk records a different embed model than config', async () => {
    const db = requirePool();
    const mismatchedId = `${prefix}#mismatched`;
    const queryVector = unitVector([0, 1, 2, 3]);

    await db.query(
      `insert into chunks (id, content, metadata, embedding) values ($1, 'stale embedding', $2::jsonb, $3::vector)`,
      [mismatchedId, JSON.stringify(metadata({ embedModel: 'text-embedding-ada-002' })), vectorLiteral(queryVector)],
    );

    vi.mocked(embedModule.embedOne).mockResolvedValue(queryVector);

    await expect(retrieve('what is his role')).rejects.toThrow(IngestConfigMismatchError);
  });
});
