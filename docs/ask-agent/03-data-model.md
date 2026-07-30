# 03 — Data model

← [Index](README.md) · Prev: [02 Retrieval](02-retrieval.md) · Next: [04 Runtime](04-runtime.md)

Four tables. One Postgres holds the vector index, application state, and the audit log.

```sql
create table documents (
  id     uuid primary key default gen_random_uuid(),
  slug   text not null unique,     -- frontmatter `id`, the reconcile key
  title  text not null,
  route  text,                     -- null when no page exists to cite
  kind   text not null             -- blog | project | code | disclosure | page | meta
);

create table chunks (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  ordinal      int  not null,
  heading      text,
  content      text not null,
  content_hash text not null,      -- change detector only, not chunk identity
  embedding    vector(1024) not null,
  unique (document_id, ordinal)
);

create table users (
  id            uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  msg_count     int  not null default 0,
  window_start  date not null default current_date,
  daily_limit   int  not null default 20,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

create table ask_events (
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
```

`(document_id, ordinal)` is chunk identity; `content_hash` only detects whether re-embedding is
needed. No HNSW index: exact scan over ~50 vectors is faster and more accurate at this size.

`users` holds no email or name; those live in Clerk and are read from there, so this table isn't a
second source of truth for them.

`ask_events` is append-only, `event` a closed enum enforced in code and by the check constraint
above. `seq` exists because Postgres `now()` is transaction-start time, so several events written
in one transaction share a timestamp; `seq` orders them. `session_id` and `turn_id` are nullable so
system events (`ingest_completed`) fit the same table as request events.

`payload.reason` on a `refused` event is a closed enum, one of three sources: threshold-derived
(`off_task` below `T_FLOOR`, `no_grounding` between the two thresholds), model-derived
(`unanswerable`, the marker came back), or pre-filter-derived (`injection`, `private`). The eval set
grades refusal accuracy by stratum, so one `refused` event value alone can't tell those apart; see
[06-evaluation.md](06-evaluation.md) for how the logged outcome is read.

## What replaced each deleted table

| Deleted | Replaced by |
|---|---|
| `corpus_meta` | An `ingest_completed` event, payload `{embed_model, dims, corpus_hash}`. Retrieval reads the latest one; ingest history comes free as a side effect. |
| `sessions` | A `session_id` column on `ask_events`. |
| `turns` | Assembled from events sharing a `turn_id`. |
| `gap_questions` | A query (below). Earns a table only when a backlog is actually being worked and needs per-item status — not before. |
| `login_nonces`, `rate_counters`, `spend_reservations` | Clerk (auth, sessions), the atomic counter on `users` (rate limiting, see [04](04-runtime.md)), and a hard spend cap set on the Anthropic key in the vendor console. |

**Gaps are a query:**

```sql
select payload->>'question', count(*) from ask_events
where event = 'refused' group by 1 order by 2 desc;
```

**Turns that died mid-flight are findable**, which is the whole reason the log is written before
the action rather than after:

```sql
select e.turn_id from ask_events e where e.event = 'generation_started'
and not exists (select 1 from ask_events
                where turn_id = e.turn_id and event = 'generated');
```

**Kept, and why:** the retrieved snapshot lives in the event payload, not a chunk pointer, because
ingest destroys chunk identity on every run and a stored pointer would resolve against a corpus the
agent never actually read. The empty-corpus guard exists because `x <> all('{}')` is vacuously true
in Postgres, so an empty desired-state set would delete every document in one committed
transaction. Reconcile-not-rebuild ingest and the per-request random tag also survive; see
[01](01-corpus.md), [02](02-retrieval.md).

**The three-role database split is gone.** `owner` / `ask_ingest` / `ask_app`, with an exact
per-table grant matrix, was 1,163 lines closing a prompt-injection-to-corpus-poisoning path that
stayed open anyway: `ask_app` still needed INSERT on `documents`/`chunks` for published gap
answers, so the split never reached "the runtime role cannot touch the corpus." One connection now.

**Note:** only ingest writes to `documents` and `chunks`. A gap answer is authored as a markdown
file and committed like any other corpus file, so nothing at runtime touches these tables: that
closes the corpus-poisoning path the deleted three-role split was built to defend, rather than
leaving it unguarded. The cost is that publishing an answer requires running ingest, not clicking a
link.
