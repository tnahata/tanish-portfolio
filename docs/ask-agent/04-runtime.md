# 04 — Route, auth, rate limiting, streaming

← [Index](README.md) · Prev: [03 Data model](03-data-model.md) · Next: [05 Voice and UI](05-voice-and-ui.md)

## Auth: Clerk, not hand-rolled

Chosen over WorkOS AuthKit and Auth0 for one reason: sign-in must appear inline in the chat panel
with the pending question held and replayed, and Clerk's modal preserves panel state where a
redirect-first flow unmounts it. Free to 10k MAU. Google-only is a dashboard setting, not code.

Clerk owns identity: OAuth, sessions, token verification, sign-in UI, refresh. Postgres owns
application state: the local user id, the Clerk join key, rate-limit counters, per-user overrides.
Do not mirror email or name as a second source of truth.

Users are upserted just-in-time on first authenticated request, not by webhook: no second
endpoint, no shared secret, no ordering problem between "user created" and "user's first request."

Supabase and Neon Auth were evaluated and rejected earlier for the underlying Postgres and identity
choices (Supabase pauses inactive free projects and this site's traffic is sporadic by design;
Neon Auth was beta and would weld the project to Neon); neither evaluation considered a standalone
identity provider, which has neither problem. The earlier estimate of "about 120 lines" for a
hand-rolled Google ID token flow omitted JWKS caching, nonce lifecycle, CSRF origin checks, cookie
signing, and expiry handling — the real number was never actually 120.

## Clerk instances, no environment guard

One Clerk application, two instances (Clerk's own model, not two separate apps). Development keys (`pk_test_`/`sk_test_`)
work on localhost and `*.vercel.app` previews; production keys (`pk_live_`/`sk_live_`) need DNS on the apex domain and
are locked to it. In Vercel, the development pair is scoped to Development and Preview, the production pair to
Production; Google is configured once, at the application level.

Two consequences: a development instance shows Clerk's own consent screen (its shared Google OAuth
app, not this site's), and users don't carry between instances, so a preview sign-in doesn't sign you
in on production. **No production-only environment guard** either: the route is deliberately
reachable on preview deployments for testing, so preview URLs are public and share the same spend
cap; the bound is BotID, sign-in required after the first turn, and the console cap.

## Route order

```
POST /api/ask
  1. BotID check                       → 403. Fails closed if unavailable on the plan.
  2. auth() -> clerkId | null
  3. if anonymous:
         freeUsed = count(ask_events where session_id = cookie
                          and event = 'generated')
         if freeUsed >= 1: return 401 { error: 'sign_in_required' }
  4. if signed in:
         user = upsertUser(clerkId)
         if !consumeMessage(user.id): return 429 { error: 'daily_limit', resetsAt }
  5. injection / private pattern pre-filter  → refuse, still no embedding
  6. embed question, retrieve top 8
  7. grade: strong | weak | none
  8. if not strong: refuse, log, return
  9. generate
 10. log events throughout
```

The first full turn is free for an anonymous visitor. Every turn after requires sign-in. Embedding
is blocked until the gate passes, so an unauthenticated caller cannot make the endpoint pay for a
model call in a loop, and cannot enumerate corpus excerpts by iterating queries.

## Session cookie and abuse layers

`session_id`, and the anonymous free-turn count, key off a cookie: `HttpOnly`, `Secure`,
`SameSite=Lax`, holding a random uuid, set on first request. Deliberately unsigned: forging or
clearing it buys exactly one free turn, same as clearing it legitimately — stated plainly so nobody
later signs it believing it's load-bearing.

Four layers guard the route, currently conflated:

| Layer | Stops | Where |
|---|---|---|
| BotID | scripted request loops, including automated cookie clearing | code, fails closed |
| Vercel edge plus a WAF per-IP rate rule | volumetric floods | config, not code |
| Anthropic console spend cap | total cost, the hard ceiling | vendor console |
| Per-user daily limit | one signed-in user monopolizing the budget | `users.daily_limit` |

Residual risk: a real browser with rotating IP addresses can farm free turns at roughly half a cent each;
the console cap is the only thing that bounds it, which is why that cap is load-bearing, not a nicety.

## Per-user rate limiting is one statement

```sql
update users
   set msg_count = case when window_start = current_date
                        then msg_count + 1 else 1 end,
       window_start = current_date,
       last_seen_at = now()
 where id = $1
returning msg_count, daily_limit
```

One statement, no read-then-act race: a read-then-write scheme lets two concurrent requests at
19 of 20 both read 19 and both pass, but Postgres serializes this row update. The `case` is the
window reset, so there's no cron; `daily_limit` is a column, so raising it for one person is an
`UPDATE`, not a deploy.

Two accepted trade-offs: the increment happens before generation, so a crashed generation still
costs the user a message (the alternative hands out free messages on every error, the wrong
direction), and the window is fixed daily, so 20 messages at 23:59 and 20 more at 00:01 is possible.

## Streaming and audit logging

Status, sources, and the grounding verdict stream to the client as typed data parts before the
answer does, written on handler entry so a cold start doesn't sit silent. The route runs on Node,
not Edge: the request is Postgres-heavy, and a Node function keeps running for pending I/O
(generation, then the log write) independent of whether the client's socket is still open, which
is what lets a turn always get logged even after a disconnect.

Every step from `question_received` onward writes an `ask_events` row matching the enum in
[03-data-model.md](03-data-model.md). `question_received` writes after authentication and the
rate-limit check pass (after step 4 above), not on entry: a request rejected at BotID, the sign-in
gate, or the daily limit writes no `ask_events` row at all, only an application log line, because
the audit table records turns the agent actually took and mixing in rejected requests would make
every per-turn aggregate wrong. `retrieved`, `graded`, `generation_started`, `generated`/`refused`,
`error` follow as each stage resolves; `cost_usd` attaches to `generated`. This is the audit log; there
is no separate table for it. Accepted consequence: limit-hit and gate-hit rates are then only observable
in application logs, not queryable in SQL.
