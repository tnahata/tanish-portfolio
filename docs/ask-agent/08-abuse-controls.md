# 08 — Abuse controls

← [Index](README.md) · Prev: [07 Identity and the gate](07-identity-gate.md) · Next: [09 Gap queue](09-gap-queue.md)

**Decisions argued here**

| Decision | Rationale in one line |
|---|---|
| BotID protects ask, gap, and identify | The gap endpoint writes rows and sends mail from a verified domain |
| Fail closed when `checkBotId` is unavailable | A plan change should not silently remove bot protection |
| Limits and spend live in Postgres, not a separate store | The corpus is already in Postgres, so a limiter outage cannot outlive the agent |
| Fixed windows, incremented with `insert … on conflict do update … returning` | One statement, atomic, no read-then-act race |
| Reservations are rows with an `expires_at`, not a counter to decrement | An abandoned stream stops counting by predicate, so no sweep cron is needed |
| Cap check serialized by a transaction-scoped advisory lock | Two concurrent requests cannot both pass the cap |
| Caps are per-user as well as global | One attacker cannot silence the agent for everybody |
| Warning email at 70% of the global cap | Notice before the cap is hit |

---

| Threat | Stopped by |
|---|---|
| Scripted abuse, including rotating IPs | **BotID** |
| Sustained use by one person, across devices or cleared cookies | **verified identity + per-user limits** |
| Casual over-use, accidental client loops | Postgres rate counters |
| Cost exhaustion | **spend reservation under an advisory lock** |

## BotID

**BotID protects `/api/ask`, `/api/ask/gap`, and `/api/ask/identify`.** The gap endpoint writes
rows and triggers outbound mail from a DKIM-verified domain, so leaving it open would be an
unbounded write and an inbox flood.

```ts
initBotId({ protect: [
  { path: '/api/ask',          method: 'POST' },
  { path: '/api/ask/gap',      method: 'POST' },
  { path: '/api/ask/identify', method: 'POST' },
]});
```

If `checkBotId` is unavailable on the current plan, **fail closed**.

BotID runs at the Vercel edge, before the function body, so bot traffic never reaches Postgres.
That ordering is what keeps the database-backed limiter affordable.

## Rate limits

**Everything counts in Postgres.** There is no second datastore.

The fail-open/fail-closed question disappears with it. `@upstash/ratelimit` defaults to fail-open,
which had to be overridden because a quota outage would otherwise drop every limit and the spend
cap at once. Postgres cannot fail that way here: the corpus lives in it, so a database outage means
no retrieval, which means no answer to rate limit. **The limiter cannot outlive the thing it
protects.**

```sql
create table rate_counters (
  bucket       text not null,          -- 'ip:<prefix_hash>:refusal' | ':gen' | 'user:<uuid>'
  window_start timestamptz not null,   -- truncated to the window
  count        int not null default 1,
  primary key (bucket, window_start)
);
create index rate_counters_window_idx on rate_counters (window_start);
```

One statement per check, atomic, no read-then-act race:

```sql
insert into rate_counters (bucket, window_start)
values ($1, date_trunc($2, now() at time zone 'utc'))
on conflict (bucket, window_start)
  do update set count = rate_counters.count + 1
returning count;
```

| Bucket | Per minute | Per day |
|---|---|---|
| `ip:<prefix_hash>:refusal` | 20 | 200 |
| `ip:<prefix_hash>:gen` (anonymous) | 1 | 1 |
| `user:<users.id>` | 10 | 60 |

**Fixed windows, not sliding.** A burst straddling a boundary can reach twice the nominal limit for
one window. Acceptable: these limits exist to stop accidental client loops and casual over-use, and
BotID plus the spend cap handle the adversarial case.

Two rows per bucket per window. The daily retention job deletes rows older than 48 hours.

**The anonymous free generation is the `:gen` bucket**, not a separate mechanism. The insert returns
`count`; `count = 1` is the free grant, anything higher requires sign-in. Atomic in one statement,
which is what makes it unraceable.

Note what the daily salt rotation implies: `prefix_hash` changes at UTC midnight, so this is **one
free generation per IP prefix per day**, not one ever. A permanent per-IP counter would need a
stable, non-rotating hash of a visitor's address, which is the thing the rotating salt exists to
prevent. Daily is the honest reading, and per-user limits are what actually bound sustained use.

## Spend reservation

Summing today's tokens before generating is a read-then-act race, and it undercounts because
refusals and embeddings bill without producing token rows. So reserve an estimate first, then
reconcile it against actuals.

```sql
create table spend_reservations (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references users(id) on delete set null,
  ip_hash      text,
  est_usd      numeric(10,6) not null,
  actual_usd   numeric(10,6),
  expires_at   timestamptz not null,   -- now() + 60s
  committed_at timestamptz,
  created_at   timestamptz not null default now()
);
create index spend_res_live_idx on spend_reservations (created_at, expires_at);
```

**Reserve**, inside one transaction:

```sql
begin;
select pg_advisory_xact_lock(hashtext('ask:spend'));   -- serializes the cap check only
-- live total = committed actuals + reservations still in flight
select coalesce(sum(coalesce(actual_usd, est_usd)), 0)
  from spend_reservations
 where created_at >= date_trunc('day', now() at time zone 'utc')
   and (committed_at is not null or expires_at > now());
-- over cap → rollback, emit refused_budget
insert into spend_reservations (user_id, ip_hash, est_usd, expires_at)
values ($1, $2, $3, now() + interval '60 seconds');
commit;
```

**Commit**, after the stream ends:

```sql
update spend_reservations
   set actual_usd = $1, committed_at = now()
 where id = $2;
```

The advisory lock is transaction-scoped, auto-released, and held for the duration of one aggregate
over a handful of rows. It is what makes "concurrent requests cannot both pass the cap" true rather
than probable.

**No sweep cron.** This is the part the Redis design paid for and Postgres gets free. There, an
abandoned stream left an `INCRBYFLOAT` on the day counter with nothing to decrement it, so a
one-minute cron had to reconcile expired reservation keys; without it, an attacker who opened
streams and dropped them at 29 seconds could mute the agent for everyone while spending nothing.
Here an abandoned reservation is never committed, `expires_at` passes, and the predicate stops
counting it. Self-healing by construction, with no job to fail.

The same aggregate filtered by `user_id` enforces the per-user cap, so one attacker cannot silence
the agent for everybody. A warning email fires at 70% of the global cap.

Rows older than 48 hours are deleted by the daily retention job. Historical spend is not read from
this table: `turns.cost_usd` is the record. See [03 Data model](03-data-model.md).

## Cost of moving off Redis

Two extra Postgres round trips per request: one rate-limit increment, one reservation. Both land on
a connection the request already needs for retrieval, against a database it already woke. Measured
against the 0.5 to 5 second cold start in [05 Runtime](05-runtime.md), it does not register.

What is gained: one fewer vendor, no 500K-commands-per-month ceiling, no Lua, no cron, and the
atomicity guarantees come from the database rather than from a script that has to be correct.

Hitting a cap produces `refused_budget`. See
[04 Retrieval and grounding](04-retrieval-grounding.md) and the DoS risk in [13 Risks](13-risks.md).
