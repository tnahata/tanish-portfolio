-- Ask agent schema. Idempotent: safe to re-run against an existing database.
-- See docs/ask-agent/03-data-model.md for the full rationale behind each table.

create extension if not exists vector;

create table if not exists documents (
  id     uuid primary key default gen_random_uuid(),
  slug   text not null unique,
  title  text not null,
  route  text,
  kind   text not null
);

create table if not exists chunks (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  ordinal      int  not null,
  heading      text,
  content      text not null,
  content_hash text not null,
  embedding    vector(1024) not null,
  unique (document_id, ordinal)
);

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  msg_count     int  not null default 0,
  window_start  date not null default current_date,
  daily_limit   int  not null default 20,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

create table if not exists ask_events (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid null,
  user_id    uuid null references users(id),
  turn_id    uuid null,
  seq        int  not null,
  event      text not null check (event in (
               'question_received', 'retrieved', 'graded', 'generation_started',
               'generated', 'refused', 'captured', 'error', 'ingest_completed')),
  payload    jsonb not null default '{}',
  cost_usd   numeric(10,6),
  created_at timestamptz not null default now(),
  unique (turn_id, seq)
);
