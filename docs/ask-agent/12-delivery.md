# 12 — Phases, effort, environment variables

← [Index](README.md) · Prev: [11 Evaluation](11-evaluation.md) · Next: [13 Risks](13-risks.md)

## Phases

Ordered so that nothing verifies code that does not exist yet.

0. **Test runner and eval set.** vitest, Playwright, ~50 questions with corpus-independent labels
   only, judges, naive baseline. *Verify:* runner executes in CI; baseline numbers exist.
   → [11 Evaluation](11-evaluation.md)
1. **Corpus pipeline.** Neon, schema, the fourteen corpus files, ingest, `corpus_meta`. Backfill
   the corpus-dependent eval labels. *Verify:* running ingest twice produces identical row counts;
   deleting a corpus file removes its rows; a mismatched `embed_model` 503s.
   → [01 Corpus](01-corpus.md), [02 Ingest](02-ingest.md), [03 Data model](03-data-model.md)
2. **`askOnce()` and grounding.** Retrieval, query rewrite, grading, verbatim path, refusal copy,
   threshold tuning. *Verify:* every eval verdict matches; the mocked-SDK test shows zero model
   invocations on refusal strata.
   → [04 Retrieval and grounding](04-retrieval-grounding.md), [06 Personality](06-personality.md)
3. **Route, streaming, history.** AI SDK data parts, `/api/ask`, turn logging with cost, last-3
   history, environment guard. *Verify:* part ordering; a client disconnect aborts upstream and
   still writes a turn; a follow-up question resolves against the previous turn.
   → [05 Runtime](05-runtime.md) — note the history contradiction flagged there
4. **FAB UI.** `useChat`, trace toggle, citations, refusal block, mobile sheet.
   *Verify:* Playwright over answer, weak-refusal, and rate-limit paths.
   → [10 UI](10-ui.md)
5. **Gate and abuse controls.** Google OAuth client, sign-in, `/api/ask/identify` with nonce, iss,
   aud, email_verified, Origin, `users` upsert, BotID, `rate_counters`, spend reservation under the
   advisory lock. *Verify:* forged, replayed, and wrong-`aud` tokens rejected; a reused nonce finds
   no row; per-user limits bind after clearing cookies; a killed stream stops counting against the
   cap once `expires_at` passes; concurrent requests cannot both pass the cap.
   → [07 Identity and the gate](07-identity-gate.md), [08 Abuse controls](08-abuse-controls.md)
6. **Gap queue and Resend.** Capture, gap endpoint with ownership check, plain-text notification,
   GET-interstitial then POST exchange, answer page, publish confirmation, inline embed, digest.
   *Verify:* tampered, expired, reused, and scanner-prefetched links behave correctly; publishing
   makes the answer retrievable with no deploy.
   → [09 Gap queue](09-gap-queue.md)
7. **`/asked`, privacy, retention.** Public page, counters, `/privacy`, retention job with
   injectable clock. *Verify:* the job nulls content at 90 days.
   → [09 Gap queue](09-gap-queue.md), [07 Identity and the gate](07-identity-gate.md)
8. **Launch gate.** Full eval run. Ship only if false-answer rate is 0, verbatim fidelity is 100%,
   and model-never-called is 0.
   → [11 Evaluation](11-evaluation.md)

## Effort

Code is fast; content is not.

| | Hours |
|---|---|
| Code across all phases | 8–12 |
| Fourteen corpus files in voice, incl. the ESMON disclosure call | 8–15 |
| 12 exemplars and refusal variants | 2 |
| 50 eval questions and expected outcomes | 3 |
| Threshold tuning, iterative | 2–4 |
| Production-only debugging: cold starts, OAuth origins, Resend DNS | unbounded |

The long pole is writing, not building.

## Build status

As of 2026-07-29, against Phase 0 and Phase 1 above.

| | Status |
|---|---|
| `db/schema.sql` (ten tables, idempotent) | Landed |
| `lib/ask/types.ts`, `lib/ask/tokens.ts`, `lib/ask/corpus.ts`, `lib/ask/chunk.ts` | Landed |
| All fourteen files in `content/corpus/` | Landed |
| `lib/ask/db.ts` (pg pool, transaction helper) | Not landed |
| vitest config, `npm test` script, tests | Not landed |
| Voyage embedding client | Not landed |
| Ingest reconcile script | Not landed |

Ingest is blocked on the user, not on code: both disclosure files (`disclosure-esmon.md`,
`disclosure-discovery-agent.md`) carry `clearedOn: TODO`, and `lib/ask/corpus.ts` throws on a
disclosure file with no clearance date, so it refuses them until a real date replaces the
placeholder. Running ingest for real also needs `DATABASE_URL` (Neon) and `VOYAGE_API_KEY` in the
environment, neither of which is set yet.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres, as the least-privilege `ask_app` role. The running app's connection |
| `DATABASE_INGEST_URL` | Neon Postgres, as the least-privilege `ask_ingest` role. Read only by `npm run ingest` |
| `DATABASE_ADMIN_URL` | Neon Postgres, as the owner role. Read only by `npm run db:setup` and `npm run db:roles`; never by the app or by ingest |
| `ASK_INGEST_PASSWORD` / `ASK_APP_PASSWORD` | optional; pins the password `npm run db:roles` sets for each role, for a reproducible rerun. Unset generates a fresh one each run |
| `ANTHROPIC_API_KEY` | generation |
| `VOYAGE_API_KEY` | embeddings |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Sign in with Google; also the `aud` checked server-side |
| `RESEND_API_KEY` | gap notification, answer delivery, weekly digest |
| `EMAIL_FROM` | verified sender, e.g. `ask@tanishnahata.com` |
| `ADMIN_EMAIL` | notifications and digest destination |
| `ASK_SIGNING_SECRET` | HKDF root for cookie and capability signing |
| `IP_HASH_SALT_SEED` | daily-rotated IP salt derivation |
| `DAILY_SPEND_CAP_USD` / `USER_SPEND_CAP_USD` | hard ceilings |
| `APEX_HOST` | asserted against request `Host` in production |

Three connection strings, three roles, one database: see [03 Data model](03-data-model.md) for the
grant matrix and why the split exists. `npm run db:roles` (creates `ask_ingest` and `ask_app`,
applies their grants) and `npm run db:setup` (applies `db/schema.sql`) are separate commands that
can run in either order; `npm run db:roles` prints the `DATABASE_URL` and `DATABASE_INGEST_URL`
values to paste in, derived from `DATABASE_ADMIN_URL`, rather than requiring them to be assembled
by hand.

The Next.js app gets these automatically: `next dev` and `next build` load local configuration
files on their own. Standalone scripts do not get that for free. `npm run ingest`, `npm run
db:setup`, `npm run db:roles`, and the eval harness once it exists, call a shared loader
(`scripts/load-env.ts`) as the first thing they do, which reads local configuration the same way
`next dev` does, before any of the variables above are read. Skipping that call is exactly the bug
where a script reports a variable as unset even though it is correctly set on disk, because
nothing ever loaded the file into `process.env`.

Resend needs DNS verification for the sending domain, which has propagation latency: do it early.
