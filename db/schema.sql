-- Ask agent schema. Idempotent: safe to re-run.
-- Source of truth; lib/ask/schema.ts mirrors it and the two change together.
-- Rationale for every column is in docs/ask-agent.md.

create extension if not exists vector;

create table if not exists chunks (
  id        text primary key,          -- "${file}#${heading-slug}", deterministic so reconcile can diff
  content   text not null,
  metadata  jsonb not null,            -- {file, heading, title, embedModel, dims, contentHash}
  embedding vector(1024) not null
);

create table if not exists user_interactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       text,                  -- Clerk userId; null when anonymous
  anon_id       text,                  -- cookie uuid; null when signed in
  question      text not null,
  answer        text,                  -- null on every refused or gated turn
  retrieved     jsonb,
  is_free       boolean not null default false,
  model         text,                  -- non-null exactly when a model was called; both gates count on it
  locked_reason text,                  -- null iff the turn produced an answer
  created_at    timestamptz not null default now()
);

create index if not exists user_interactions_user_created_idx
  on user_interactions (user_id, created_at desc);

create index if not exists user_interactions_anon_created_idx
  on user_interactions (anon_id, created_at desc);
