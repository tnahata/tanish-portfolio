-- Ask agent schema. Ten tables in three groups: corpus, identity and traffic, and
-- operational state. One database, no second datastore on the request path.
--
-- Authority: docs/ask-agent/03-data-model.md. Idempotent: safe to re-run against a live
-- database. Apply with `psql "$DATABASE_URL" -f db/schema.sql`.

create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- Corpus
-- ---------------------------------------------------------------------------

-- Single-row table. Asserted at query time: the retrieval thresholds are calibrated
-- against whichever model built the index, so a mismatch with the running config 503s
-- rather than scoring a query vector against an incompatible space.
create table if not exists corpus_meta (
  id           int primary key default 1 check (id = 1),
  embed_model  text not null,          -- e.g. 'text-embedding-3-large'
  embed_dims   int  not null,
  corpus_hash  text not null,          -- hash of all corpus content
  ingested_at  timestamptz not null default now()
);

create table if not exists documents (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,  -- frontmatter `id`
  -- 'file' | 'asked'. Scopes the ingest deletion sweep: only file-sourced rows are swept,
  -- so published gap answers written at runtime survive an ingest.
  source        text not null,
  route         text,                  -- null when no page exists
  external_url  text,
  title         text not null,
  kind          text not null,
  verbatim_only boolean not null default false
);

-- No HNSW index. Exact scan over ~150 vectors is faster and more accurate at this size.
create table if not exists chunks (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  ordinal      int  not null,
  heading      text,
  content      text not null,
  content_hash text not null,          -- skips re-embedding unchanged chunks
  token_count  int  not null,
  embedding    vector(1024) not null,  -- text-embedding-3-large, truncated via the dimensions param
  unique (document_id, ordinal)
);
create index if not exists chunks_document_idx on chunks (document_id);

-- ---------------------------------------------------------------------------
-- Identity and traffic
-- ---------------------------------------------------------------------------

-- Separate from sessions because the identity, not the cookie, is the principal: one
-- person on three devices is one users row and three sessions rows.
create table if not exists users (
  id           uuid primary key default gen_random_uuid(),
  google_sub   text not null unique,   -- the principal
  email        text not null,          -- verified by Google; NOT unique, addresses get reassigned
  name         text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists users_email_idx on users (email);

create table if not exists sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references users(id) on delete cascade,
  identified_at timestamptz,
  ip_hash       text not null,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);
create index if not exists sessions_user_idx on sessions (user_id);

-- One row per TURN, not per message. A role column would leave half the per-turn metric
-- columns null on user rows and double-count the "asked" figure.
create table if not exists turns (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,       -- groups a thread; resumable per user
  session_id      uuid not null references sessions(id) on delete cascade,
  question        text,                -- nulled by the retention job at 90 days
  answer          text,                -- nulled by the retention job at 90 days
  outcome         text not null,       -- answered | refused_no_grounding | refused_off_task
                                       -- | refused_injection | refused_private | refused_budget
  grounding       text,                -- strong | weak | none
  top_score       real,
  -- A snapshot of what the agent actually read, not pointers into the index. Ingest
  -- destroys chunk UUIDs, and resolving an old pointer against today's corpus would show
  -- text the agent never saw.
  retrieved       jsonb,               -- [{slug, title, route, score, excerpt}] AS SEEN
  ask_version     text not null,
  corpus_hash     text not null,
  latency_ms      int,
  input_tokens    int,
  output_tokens   int,
  embed_tokens    int,
  cost_usd        numeric(10,6),
  created_at      timestamptz not null default now()
);
create index if not exists turns_session_idx on turns (session_id);
create index if not exists turns_conversation_idx on turns (conversation_id, created_at);
create index if not exists turns_created_idx on turns (created_at);

-- answer_token_used_at and publish_token_used_at are separate because one shared column
-- would mean answering a question permanently blocks publishing it.
create table if not exists gap_questions (
  id                    uuid primary key default gen_random_uuid(),
  session_id            uuid references sessions(id) on delete set null,
  turn_id               uuid references turns(id) on delete set null,
  question              text not null, -- nulled by retention alongside turns
  status                text not null default 'new',
  answer                text,
  published_slug        text,
  answer_token_used_at  timestamptz,
  publish_token_used_at timestamptz,
  created_at            timestamptz not null default now(),
  answered_at           timestamptz
);

-- ---------------------------------------------------------------------------
-- Operational state
--
-- The only tables the retention job truncates on age rather than nulling: nonces are dead
-- at 300 seconds, counters and reservations at 48 hours. None of them record what
-- happened, so they can be deleted outright. `turns` is the permanent record.
-- ---------------------------------------------------------------------------

create table if not exists login_nonces (
  nonce      text primary key,
  session_id uuid not null references sessions(id) on delete cascade,
  expires_at timestamptz not null      -- issued + 300s
);
create index if not exists login_nonces_expiry_idx on login_nonces (expires_at);

-- Fixed windows incremented by a single `insert ... on conflict do update ... returning`,
-- so a check is atomic with no read-then-act race. The composite primary key is what that
-- upsert conflicts on.
create table if not exists rate_counters (
  bucket       text not null,          -- 'ip:<prefix_hash>:refusal' | ':gen' | 'user:<uuid>'
  window_start timestamptz not null,   -- truncated to the window
  count        int not null default 1,
  primary key (bucket, window_start)
);
create index if not exists rate_counters_window_idx on rate_counters (window_start);

-- Rows with an expires_at, not a counter to decrement: an abandoned stream is never
-- committed, expires_at passes, and the live-total predicate stops counting it. No sweep
-- cron. Historical spend is read from turns.cost_usd, not from here.
create table if not exists spend_reservations (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references users(id) on delete set null,
  ip_hash      text,
  est_usd      numeric(10,6) not null,
  actual_usd   numeric(10,6),
  expires_at   timestamptz not null,   -- now() + 60s
  committed_at timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists spend_res_live_idx on spend_reservations (created_at, expires_at);
