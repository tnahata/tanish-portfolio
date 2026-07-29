# 03 — Data model

← [Index](README.md) · Prev: [02 Ingest](02-ingest.md) · Next: [04 Retrieval and grounding](04-retrieval-grounding.md)

**Decisions argued here**

| Decision | Rationale in one line |
|---|---|
| Postgres (Neon) with `pgvector`, ten tables, no second datastore | Neon, Anthropic, Voyage, Resend, Google, Vercel is the whole vendor list |
| No HNSW index | Exact scan over ~150 vectors is faster and more accurate |
| `corpus_meta` asserted at query time, 503 on mismatch | Thresholds are meaningless in a different embedding space |
| One row per turn, not per message | A `role` column leaves half the metrics null and double-counts `/asked` |
| `turns.retrieved` is a snapshot, not a pointer | Resolving an old pointer shows text the agent never saw |
| `users` separate from `sessions` | Identity, not the cookie, is the principal |
| `users.email` not unique | Addresses get reassigned; `google_sub` is the key |
| Nonces, rate counters, and reservations are tables | Removing Redis removes a vendor and an outage mode |

---

Postgres (Neon) with `pgvector`. Ten tables in three groups: corpus, identity and traffic, and
operational state. There is no second datastore.

## Corpus tables

```sql
create extension if not exists vector;

create table corpus_meta (
  id           int primary key default 1 check (id = 1),
  embed_model  text not null,          -- e.g. 'voyage-3.5-lite'
  embed_dims   int  not null,
  corpus_hash  text not null,          -- hash of all corpus content
  ingested_at  timestamptz not null default now()
);

create table documents (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,   -- frontmatter `id`
  source       text not null,          -- file | asked; scopes the deletion sweep
  route        text,                   -- null when no page exists
  external_url text,
  title        text not null,
  kind         text not null,
  verbatim_only boolean not null default false
);

create table chunks (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  ordinal      int  not null,
  heading      text,
  content      text not null,
  content_hash text not null,          -- skips re-embedding unchanged chunks
  token_count  int  not null,
  embedding    vector(1024) not null,  -- voyage-3.5-lite default dims
  unique (document_id, ordinal)
);
create index chunks_document_idx on chunks (document_id);
```

**No HNSW index.** Exact scan over ~150 vectors is faster and more accurate than an approximate
index at this size.

**`corpus_meta` is asserted at query time.** The thresholds in
[04 Retrieval and grounding](04-retrieval-grounding.md) are calibrated against whatever model
produced the index; changing the embedding model silently invalidates them. If `embed_model` or
`embed_dims` disagree with the running config, the route returns 503 rather than scoring against an
incompatible space.

## Identity and traffic tables

```sql
create table users (
  id            uuid primary key default gen_random_uuid(),
  google_sub    text not null unique,  -- the principal
  email         text not null,         -- verified by Google; NOT unique, addresses get reassigned
  name          text,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);
create index users_email_idx on users (email);

create table sessions (
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
create index sessions_user_idx on sessions (user_id);

-- one row per TURN, not per message
create table turns (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,       -- groups a thread; resumable per user
  session_id      uuid not null references sessions(id) on delete cascade,
  question      text,                  -- nulled by the retention job at 90 days
  answer        text,                  -- nulled by the retention job at 90 days
  outcome       text not null,         -- answered | refused_no_grounding | refused_off_task
                                       -- | refused_injection | refused_private | refused_budget
  grounding     text,                  -- strong | weak | none
  top_score     real,
  retrieved     jsonb,                 -- [{slug, title, route, score, excerpt}] AS SEEN
  ask_version   text not null,
  corpus_hash   text not null,
  latency_ms    int,
  input_tokens  int,
  output_tokens int,
  embed_tokens  int,
  cost_usd      numeric(10,6),
  created_at    timestamptz not null default now()
);
create index turns_session_idx on turns (session_id);
create index turns_conversation_idx on turns (conversation_id, created_at);
create index turns_created_idx on turns (created_at);

create table gap_questions (
  id                   uuid primary key default gen_random_uuid(),
  session_id           uuid references sessions(id) on delete set null,
  turn_id              uuid references turns(id) on delete set null,
  question             text not null,  -- nulled by retention alongside turns
  status               text not null default 'new',
  answer               text,
  published_slug       text,
  answer_token_used_at timestamptz,
  publish_token_used_at timestamptz,
  created_at           timestamptz not null default now(),
  answered_at          timestamptz
);
```

## Operational state

Short-lived rows: login nonces, rate-limit counters, and in-flight spend reservations. Full
rationale for each shape is in [08 Abuse controls](08-abuse-controls.md); the nonce belongs to
[07 Identity and the gate](07-identity-gate.md).

```sql
create table login_nonces (
  nonce      text primary key,
  session_id uuid not null references sessions(id) on delete cascade,
  expires_at timestamptz not null       -- issued + 300s
);
create index login_nonces_expiry_idx on login_nonces (expires_at);

create table rate_counters (
  bucket       text not null,           -- 'ip:<prefix_hash>:refusal' | ':gen' | 'user:<uuid>'
  window_start timestamptz not null,
  count        int not null default 1,
  primary key (bucket, window_start)
);
create index rate_counters_window_idx on rate_counters (window_start);

create table spend_reservations (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references users(id) on delete set null,
  ip_hash      text,
  est_usd      numeric(10,6) not null,
  actual_usd   numeric(10,6),
  expires_at   timestamptz not null,    -- now() + 60s
  committed_at timestamptz,
  created_at   timestamptz not null default now()
);
create index spend_res_live_idx on spend_reservations (created_at, expires_at);
```

Ten tables, one database, no second vendor on the request path.

These three are the only tables the retention job truncates on age rather than nulling: nonces are
dead at 300 seconds, counters and reservations at 48 hours. Nothing in them is a record of what
happened, which is why they can be deleted outright. `turns` is the permanent record.

**One row per turn, not per message.** A `role` column with per-turn metrics attached leaves half
the columns null on user rows and double-counts the "asked" figure on `/asked`.

**`retrieved` is a snapshot, not a pointer.** Full-replace ingest destroys chunk UUIDs on every
run, and a stable `slug#heading` ref still breaks when a heading is renamed. Worse, resolving an
old pointer against today's corpus shows text the agent never saw, which makes debugging actively
misleading. The row records what the agent actually read at that moment, permanently.

**`users` is separate from `sessions`** because the identity, not the cookie, is the principal.
One person on three devices is one `users` row and three `sessions` rows, which is what makes
per-user rate limiting and cost attribution correct rather than per-browser.

**Cost attribution:** `turns.cost_usd` joined through `sessions.user_id`.

Separate `answer_token_used_at` and `publish_token_used_at` columns exist because one shared column
means answering a question permanently blocks publishing it. See [09 Gap queue](09-gap-queue.md).
