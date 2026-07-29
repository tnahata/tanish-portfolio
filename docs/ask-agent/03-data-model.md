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
| Three roles (`owner`, `ask_ingest`, `ask_app`), no `alter default privileges` on the exact grant matrix | A prompt-injection write must stop at "insert", never reach "rewrite or delete the corpus" |

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

## Access control: three roles, not one

One database, but not one login. `owner` (Neon's existing role, `DATABASE_ADMIN_URL`) runs DDL and
nothing else touches it. `ask_ingest` (`DATABASE_INGEST_URL`) is what `npm run ingest` connects as.
`ask_app` (`DATABASE_URL`) is what the running app connects as. Full grant matrix, reasoning, and
the exact SQL live in `db/roles.sql`; this is the summary.

| | `corpus_meta`, `documents`, `chunks` | the other seven tables |
|---|---|---|
| `ask_ingest` | SELECT, INSERT, UPDATE, DELETE | nothing |
| `ask_app` | SELECT everywhere; INSERT on `documents`/`chunks` only; never UPDATE, never DELETE | SELECT, INSERT, UPDATE, DELETE |

**Why `ask_app` cannot UPDATE or DELETE a corpus row.** The corpus defines what the agent is
allowed to know. If a path from prompt injection to a database write ever existed, its blast
radius has to stop at "insert an asked-sourced row"; it must never reach "rewrite or delete what
the agent already knows", because that would be corpus poisoning, not just a bad write. `ask_app`
still needs INSERT on `documents` and `chunks` because publishing a gap answer happens at runtime
and writes a `documents` row with `source = 'asked'`, embedded inline with no deploy (see
[09 Gap queue](09-gap-queue.md)). INSERT-only keeps that path open while keeping every
file-sourced row `ask_ingest` maintains immutable to the runtime.

**Why `ask_ingest` has no access at all to the other seven tables.** Ingest reconciles corpus
content read from disk against the corpus tables (see [02 Ingest](02-ingest.md)). It has no
legitimate reason to read or write a `users` row, a `session`, or a `turn`, so it is not given the
surface that would make it a target if it were ever compromised.

**`db/roles.sql` deliberately does not use `alter default privileges` to express this matrix.**
That mechanism is scoped to a schema and a creating role, not to a named list of tables, so it
cannot reproduce the asymmetry above: a default broad enough to cover `ask_app`'s access to a
future identity-shaped table would just as automatically apply to a future corpus-shaped table,
handing `ask_app` UPDATE/DELETE on the exact thing this split exists to protect. `db/roles.sql`
does still use `alter default privileges`, but only as a temporary, intentionally-broader baseline
that makes a table usable the instant `npm run db:setup` creates it; the exact matrix above is
applied by an explicit per-table pass that only touches tables that already exist. See
"Apply order" in `db/roles.sql` for the two commands' full sequencing, and the practical
consequence below.

**Practical consequence: adding a table to `db/schema.sql` requires re-running `npm run
db:roles`.** Until that command runs again, the new table has no explicit grant, not because
something is broken but because the exact grant matrix is table-by-table by design. A query
against it fails with a plain Postgres permission-denied error in the meantime.
`scripts/ingest.ts`'s preflight check turns exactly that error, on any of the three corpus tables,
into a message naming the fix rather than a bare "permission denied for table".
