import { randomUUID } from 'crypto';
import { Client } from 'pg';
import { loadScriptEnv } from './load-env';
import { ADMIN_CONNECT_TIMEOUT_MS, redactSecrets } from './db-shared';

// Must run before any process.env read; standalone scripts get no automatic env loading.
// See scripts/load-env.ts.
loadScriptEnv();

/** Proves the least-privilege split in db/roles.sql holds live: connects as each role and
 *  checks both what should work and what must be refused, inside begin/rollback (SQLSTATE 42501). */

const DATABASE_URL_ENV = 'DATABASE_URL';
const DATABASE_INGEST_URL_ENV = 'DATABASE_INGEST_URL';

/** Postgres's SQLSTATE for insufficient_privilege: covers every negative case here (missing
 *  GRANT, missing CREATE, a DROP refused for non-ownership), checked by code, never message text. */
const POSTGRES_INSUFFICIENT_PRIVILEGE = '42501';

/** Thrown when a required connection string is missing, before any connection is attempted. */
export class AskVerifyRolesConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AskVerifyRolesConfigError';
  }
}

export interface VerifyRolesConfig {
  appUrl: string;
  ingestUrl: string;
}

function requireConnectionString(
  env: Record<string, string | undefined>,
  envVar: string,
  purpose: string
): string {
  const value = env[envVar];
  if (!value) {
    throw new AskVerifyRolesConfigError(
      `Missing ${envVar}: it is not set in this process's environment. db:verify-roles needs ` +
        `${purpose} to connect as that role and check its grants directly. If you have already ` +
        'set it in a local configuration file, note that standalone scripts load configuration ' +
        'explicitly rather than picking it up automatically the way next dev and next build do; ' +
        'confirm that loading step ran before this. Never commit a real connection string.'
    );
  }
  return value;
}

/** Reads both role connection strings. `env` defaults to `process.env`; a parameter only so
 *  tests can exercise the missing-configuration paths against a plain object. */
export function loadVerifyRolesConfig(
  env: Record<string, string | undefined> = process.env
): VerifyRolesConfig {
  const appUrl = requireConnectionString(env, DATABASE_URL_ENV, "ask_app's own connection string");
  const ingestUrl = requireConnectionString(
    env,
    DATABASE_INGEST_URL_ENV,
    "ask_ingest's own connection string"
  );
  return { appUrl, ingestUrl };
}

type ExpectedOutcome = 'succeeds' | 'fails-with-insufficient-privilege';

interface AssertionSpec {
  description: string;
  client: Client;
  expected: ExpectedOutcome;
  /** Runs inside a transaction that is always rolled back after this returns or throws. */
  action: (client: Client) => Promise<void>;
}

export interface AssertionOutcome {
  description: string;
  passed: boolean;
  detail?: string;
}

function postgresErrorCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const { code } = err as { code?: unknown };
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

/**
 * Classifies a completed attempt into PASS/FAIL (no I/O), kept separate from `runAssertion` so
 * the SQLSTATE logic is testable against fabricated errors, with no database involved.
 */
export function classifyOutcome(
  description: string,
  expected: ExpectedOutcome,
  result: { ok: true } | { ok: false; error: unknown }
): AssertionOutcome {
  if (expected === 'succeeds') {
    if (result.ok) return { description, passed: true };
    return { description, passed: false, detail: `expected to succeed but failed: ${describeFailure(result.error)}` };
  }

  // expected === 'fails-with-insufficient-privilege'
  if (result.ok) {
    return {
      description,
      passed: false,
      detail: 'statement unexpectedly SUCCEEDED (expected a permission error); this is a real gap, not a test bug',
    };
  }

  const code = postgresErrorCode(result.error);
  if (code === POSTGRES_INSUFFICIENT_PRIVILEGE) {
    return { description, passed: true };
  }
  return {
    description,
    passed: false,
    detail:
      `failed, but not with insufficient_privilege (${POSTGRES_INSUFFICIENT_PRIVILEGE}): ` +
      `got ${describeFailure(result.error)}`,
  };
}

function describeFailure(err: unknown): string {
  const code = postgresErrorCode(err);
  const message = err instanceof Error ? err.message : String(err);
  return code ? `[${code}] ${message}` : message;
}

/** Runs `spec.action` inside `begin ... rollback`, always rolled back in `finally`: an aborted
 *  transaction from a negative case must be cleared before the connection is reused. */
async function runAssertion(spec: AssertionSpec): Promise<AssertionOutcome> {
  await spec.client.query('begin');
  let result: { ok: true } | { ok: false; error: unknown };
  try {
    await spec.action(spec.client);
    result = { ok: true };
  } catch (err) {
    result = { ok: false, error: err };
  } finally {
    await spec.client.query('rollback').catch(() => undefined);
  }
  return classifyOutcome(spec.description, spec.expected, result);
}

/** A 1024-length zero vector literal: pgvector's bracketed text input format, cast with ::vector. */
function zeroVectorLiteral(dims: number): string {
  return `[${Array(dims).fill('0').join(',')}]`;
}

const PROBE_VECTOR = zeroVectorLiteral(1024);

/** Unique per run so concurrent runs (or a re-run right after a failed one) never collide. */
function probeTag(): string {
  return `verify-roles-${randomUUID()}`;
}

async function insertProbeDocument(client: Client, slug: string): Promise<string> {
  const result = await client.query<{ id: string }>(
    `insert into documents (slug, source, route, external_url, title, kind, verbatim_only)
     values ($1, 'asked', null, null, 'verify-roles probe', 'meta', false)
     returning id`,
    [slug]
  );
  return result.rows[0].id;
}

async function insertProbeChunk(client: Client, documentId: string): Promise<void> {
  await client.query(
    `insert into chunks (document_id, ordinal, heading, content, content_hash, token_count, embedding)
     values ($1, 0, null, 'probe content', 'probe-hash', 1, $2::vector)`,
    [documentId, PROBE_VECTOR]
  );
}

/** Insert, update, then delete one probe row in `table`, proving all three verbs in sequence. */
interface CrudProbe {
  table: string;
  insert: (client: Client) => Promise<string | { key: [string, string] }>;
  update: (client: Client, id: string | [string, string]) => Promise<void>;
  delete: (client: Client, id: string | [string, string]) => Promise<void>;
}

async function runCrudProbe(client: Client, probe: CrudProbe): Promise<void> {
  const inserted = await probe.insert(client);
  const id = typeof inserted === 'object' && 'key' in inserted ? inserted.key : inserted;
  await probe.update(client, id);
  await probe.delete(client, id);
}

/** Builds every assertion declaratively; `runAssertion` stays the only place that opens and
 *  closes a transaction. */
function buildAssertions(appClient: Client, ingestClient: Client): AssertionSpec[] {
  const specs: AssertionSpec[] = [];

  // ---------------------------------------------------------------------------------------
  // Positive: ask_app
  // ---------------------------------------------------------------------------------------

  specs.push({
    description: 'ask_app can SELECT from documents',
    client: appClient,
    expected: 'succeeds',
    action: (c) => c.query('select 1 from documents limit 0').then(() => undefined),
  });

  specs.push({
    description: 'ask_app can SELECT from chunks',
    client: appClient,
    expected: 'succeeds',
    action: (c) => c.query('select 1 from chunks limit 0').then(() => undefined),
  });

  specs.push({
    description: 'ask_app can INSERT into documents and chunks (the published-gap-answer path)',
    client: appClient,
    expected: 'succeeds',
    action: async (c) => {
      const documentId = await insertProbeDocument(c, probeTag());
      await insertProbeChunk(c, documentId);
    },
  });

  const appOwnedTables: CrudProbe[] = [
    {
      table: 'users',
      insert: async (c) => {
        const r = await c.query<{ id: string }>(
          `insert into users (google_sub, email) values ($1, 'probe@example.com') returning id`,
          [probeTag()]
        );
        return r.rows[0].id;
      },
      update: (c, id) => c.query('update users set name = $2 where id = $1', [id, 'probe']).then(() => undefined),
      delete: (c, id) => c.query('delete from users where id = $1', [id]).then(() => undefined),
    },
    {
      table: 'sessions',
      insert: async (c) => {
        const r = await c.query<{ id: string }>(
          `insert into sessions (ip_hash) values ($1) returning id`,
          [probeTag()]
        );
        return r.rows[0].id;
      },
      update: (c, id) =>
        c.query('update sessions set utm_source = $2 where id = $1', [id, 'probe']).then(() => undefined),
      delete: (c, id) => c.query('delete from sessions where id = $1', [id]).then(() => undefined),
    },
    {
      table: 'turns',
      insert: async (c) => {
        // turns.session_id is NOT NULL + FK, so a probe session is a dependency here, not a second thing under test.
        const session = await c.query<{ id: string }>(
          `insert into sessions (ip_hash) values ($1) returning id`,
          [probeTag()]
        );
        const r = await c.query<{ id: string }>(
          `insert into turns (conversation_id, session_id, outcome, ask_version, corpus_hash)
           values (gen_random_uuid(), $1, 'answered', 'verify-roles-probe', 'probe-hash')
           returning id`,
          [session.rows[0].id]
        );
        return r.rows[0].id;
      },
      update: (c, id) => c.query('update turns set latency_ms = 1 where id = $1', [id]).then(() => undefined),
      delete: (c, id) => c.query('delete from turns where id = $1', [id]).then(() => undefined),
    },
    {
      table: 'gap_questions',
      insert: async (c) => {
        const r = await c.query<{ id: string }>(
          `insert into gap_questions (question) values ($1) returning id`,
          ['probe question']
        );
        return r.rows[0].id;
      },
      update: (c, id) =>
        c.query('update gap_questions set status = $2 where id = $1', [id, 'reviewed']).then(() => undefined),
      delete: (c, id) => c.query('delete from gap_questions where id = $1', [id]).then(() => undefined),
    },
    {
      table: 'login_nonces',
      insert: async (c) => {
        const session = await c.query<{ id: string }>(
          `insert into sessions (ip_hash) values ($1) returning id`,
          [probeTag()]
        );
        const nonce = probeTag();
        await c.query(
          `insert into login_nonces (nonce, session_id, expires_at) values ($1, $2, now() + interval '5 minutes')`,
          [nonce, session.rows[0].id]
        );
        return nonce;
      },
      update: (c, id) =>
        c
          .query(`update login_nonces set expires_at = now() + interval '10 minutes' where nonce = $1`, [id])
          .then(() => undefined),
      delete: (c, id) => c.query('delete from login_nonces where nonce = $1', [id]).then(() => undefined),
    },
    {
      table: 'rate_counters',
      insert: async (c) => {
        const bucket = probeTag();
        const r = await c.query<{ bucket: string; window_start: string }>(
          `insert into rate_counters (bucket, window_start) values ($1, now()) returning bucket, window_start`,
          [bucket]
        );
        return { key: [r.rows[0].bucket, r.rows[0].window_start] };
      },
      update: (c, id) => {
        const [bucket, windowStart] = id as [string, string];
        return c
          .query('update rate_counters set count = count + 1 where bucket = $1 and window_start = $2', [
            bucket,
            windowStart,
          ])
          .then(() => undefined);
      },
      delete: (c, id) => {
        const [bucket, windowStart] = id as [string, string];
        return c
          .query('delete from rate_counters where bucket = $1 and window_start = $2', [bucket, windowStart])
          .then(() => undefined);
      },
    },
    {
      table: 'spend_reservations',
      insert: async (c) => {
        const r = await c.query<{ id: string }>(
          `insert into spend_reservations (est_usd, expires_at) values (0.01, now() + interval '1 minute') returning id`,
          []
        );
        return r.rows[0].id;
      },
      update: (c, id) =>
        c.query('update spend_reservations set actual_usd = 0.01 where id = $1', [id]).then(() => undefined),
      delete: (c, id) => c.query('delete from spend_reservations where id = $1', [id]).then(() => undefined),
    },
  ];

  for (const probe of appOwnedTables) {
    specs.push({
      description: `ask_app can INSERT, UPDATE, and DELETE a ${probe.table} row (identity/traffic table it owns at runtime)`,
      client: appClient,
      expected: 'succeeds',
      action: (c) => runCrudProbe(c, probe),
    });
  }

  // ---------------------------------------------------------------------------------------
  // Positive: ask_ingest
  // ---------------------------------------------------------------------------------------

  for (const table of ['documents', 'chunks', 'corpus_meta']) {
    specs.push({
      description: `ask_ingest can SELECT from ${table}`,
      client: ingestClient,
      expected: 'succeeds',
      action: (c) => c.query(`select 1 from ${table} limit 0`).then(() => undefined),
    });
  }

  specs.push({
    description: 'ask_ingest can INSERT, UPDATE, and DELETE documents and chunks rows',
    client: ingestClient,
    expected: 'succeeds',
    action: async (c) => {
      const documentId = await insertProbeDocument(c, probeTag());
      await insertProbeChunk(c, documentId);
      await c.query('update chunks set heading = $2 where document_id = $1', [documentId, 'updated']);
      await c.query('update documents set title = $2 where id = $1', [documentId, 'updated']);
      await c.query('delete from chunks where document_id = $1', [documentId]);
      await c.query('delete from documents where id = $1', [documentId]);
    },
  });

  specs.push({
    description: 'ask_ingest can INSERT, UPDATE, and DELETE the corpus_meta row',
    client: ingestClient,
    expected: 'succeeds',
    action: async (c) => {
      // Upsert covers INSERT-or-UPDATE on the singleton row without assuming one exists; DELETE
      // proven right after. Safe either way: the whole action rolls back.
      await c.query(
        `insert into corpus_meta (id, embed_model, embed_dims, corpus_hash, ingested_at)
         values (1, 'verify-roles-probe', 1, 'probe-hash', now())
         on conflict (id) do update set embed_model = excluded.embed_model`
      );
      await c.query('delete from corpus_meta where id = 1');
    },
  });

  // ---------------------------------------------------------------------------------------
  // Negative: ask_app cannot rewrite or erase the corpus (the important one)
  // ---------------------------------------------------------------------------------------

  specs.push({
    description: 'ask_app CANNOT UPDATE documents',
    client: appClient,
    expected: 'fails-with-insufficient-privilege',
    // `where false`: Postgres checks the UPDATE privilege before scanning any row, so this tests the grant alone.
    action: (c) => c.query('update documents set title = title where false').then(() => undefined),
  });

  specs.push({
    description: 'ask_app CANNOT DELETE from documents',
    client: appClient,
    expected: 'fails-with-insufficient-privilege',
    action: (c) => c.query('delete from documents where false').then(() => undefined),
  });

  specs.push({
    description: 'ask_app CANNOT UPDATE chunks',
    client: appClient,
    expected: 'fails-with-insufficient-privilege',
    action: (c) => c.query('update chunks set heading = heading where false').then(() => undefined),
  });

  specs.push({
    description: 'ask_app CANNOT DELETE from chunks',
    client: appClient,
    expected: 'fails-with-insufficient-privilege',
    action: (c) => c.query('delete from chunks where false').then(() => undefined),
  });

  // ---------------------------------------------------------------------------------------
  // Negative: ask_ingest has no access at all to the identity and traffic tables
  // ---------------------------------------------------------------------------------------

  for (const table of ['users', 'sessions', 'turns']) {
    specs.push({
      description: `ask_ingest CANNOT SELECT from ${table}`,
      client: ingestClient,
      expected: 'fails-with-insufficient-privilege',
      action: (c) => c.query(`select 1 from ${table} limit 0`).then(() => undefined),
    });
  }

  // ---------------------------------------------------------------------------------------
  // Negative: neither role can run DDL
  // ---------------------------------------------------------------------------------------

  for (const [role, client] of [
    ['ask_app', appClient],
    ['ask_ingest', ingestClient],
  ] as const) {
    specs.push({
      description: `${role} CANNOT CREATE TABLE`,
      client,
      expected: 'fails-with-insufficient-privilege',
      action: (c) =>
        c.query(`create table ${probeTag().replace(/-/g, '_')} (id int)`).then(() => undefined),
    });

    specs.push({
      description: `${role} CANNOT DROP TABLE documents`,
      client,
      expected: 'fails-with-insufficient-privilege',
      action: (c) => c.query('drop table documents').then(() => undefined),
    });
  }

  return specs;
}

function printOutcomes(outcomes: AssertionOutcome[]): void {
  for (const outcome of outcomes) {
    const label = outcome.passed ? 'PASS' : 'FAIL';
    const detail = outcome.detail ? `: ${outcome.detail}` : '';
    console.log(`${label}  ${outcome.description}${detail}`);
  }

  const passCount = outcomes.filter((o) => o.passed).length;
  console.log('');
  console.log(`${passCount}/${outcomes.length} assertions passed.`);

  const failed = outcomes.filter((o) => !o.passed);
  if (failed.length > 0) {
    console.log('');
    console.log(
      `${failed.length} assertion(s) FAILED. This means the live grants on this database do not ` +
        'match what db/roles.sql declares. Do not edit db/roles.sql to make this pass; treat a ' +
        'failure here as a finding about the database, and re-run `npm run db:roles` if the fix ' +
        'is to re-apply grants that have drifted.'
    );
  }
}

async function main(): Promise<void> {
  const config = loadVerifyRolesConfig();
  const secrets = [config.appUrl, config.ingestUrl];

  const appClient = new Client({ connectionString: config.appUrl, connectionTimeoutMillis: ADMIN_CONNECT_TIMEOUT_MS });
  const ingestClient = new Client({
    connectionString: config.ingestUrl,
    connectionTimeoutMillis: ADMIN_CONNECT_TIMEOUT_MS,
  });

  try {
    await appClient.connect();
    await ingestClient.connect();

    const specs = buildAssertions(appClient, ingestClient);
    const outcomes: AssertionOutcome[] = [];
    for (const spec of specs) {
      outcomes.push(await runAssertion(spec));
    }

    printOutcomes(outcomes);

    if (outcomes.some((o) => !o.passed)) {
      process.exitCode = 1;
    }
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    throw new Error(redactSecrets(raw, secrets));
  } finally {
    // Swallowed so a teardown failure never masks the real error above (same pattern as
    // lib/ask/db.ts's withTransaction).
    await appClient.end().catch(() => undefined);
    await ingestClient.end().catch(() => undefined);
  }
}

// Only run when executed directly; tests import this module without triggering main().
const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
