# 12: Phases, effort, environment variables

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
   → [05 Runtime](05-runtime.md) (note the history contradiction flagged there)
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

As of 2026-07-28, against Phase 0 and Phase 1 above. Verified against the filesystem, not
inferred from what was planned.

| | Status |
|---|---|
| `db/schema.sql` (ten tables, idempotent) | Landed |
| `db/roles.sql` (three roles, exact per-table grant matrix, session-GUC password mechanism) | Landed |
| `lib/ask/types.ts`, `lib/ask/tokens.ts`, `lib/ask/corpus.ts`, `lib/ask/chunk.ts` | Landed |
| `lib/ask/db.ts` (pg pool keyed per connection string, transaction helper for `ask_app` and `ask_ingest`) | Landed |
| `lib/ask/embed.ts` (OpenAI client: batching, retry on 429/5xx, dimension assertion) | Landed |
| `scripts/ingest.ts` (reconcile, empty-corpus guard, schema/grant preflight checks) | Landed |
| `scripts/db-setup.ts`, `scripts/db-roles.ts`, `scripts/db-shared.ts`, `scripts/load-env.ts` | Landed |
| All fourteen files in `content/corpus/`, both disclosure files carrying a real `clearedOn` date | Landed |
| One blog post in `content/blog/`, picked up by `loadCorpus` automatically | Landed |
| vitest config, `npm test` script, tests (74 passing, across 8 files under `tests/ask/`) | Landed |
| `askOnce()`, retrieval and grounding | Not landed |
| `/api/ask` route, streaming, history | Not landed |
| FAB UI, chat panel | Not landed |
| Google OAuth gate, `/api/ask/identify` | Not landed |
| BotID wiring, rate limiting, spend reservation (the tables exist in `db/schema.sql`; no code reads or writes them yet) | Not landed |
| Gap queue endpoints, Resend integration, `/asked` | Not landed |
| Eval harness (`npm run eval` does not exist in `package.json`) | Not landed |

Whether ingest has actually been run against a live Neon database is not verifiable from the
repository alone: nothing here records a past run. The pipeline is code-complete and covered by 74
unit tests, all against mocked database and OpenAI clients, no real connection or API call in the
suite. The commit that introduced the role split says this plainly and it still holds: "the role
ordering logic is reasoned against documented Postgres semantics, not executed: worth one dry run
on a disposable branch before trusting it."

## Setup sequence

The order this project actually runs in, and why. See [03 Data model](03-data-model.md) for the
full reasoning behind the schema-before-roles preference.

1. Set `DATABASE_ADMIN_URL` (the Neon owner connection string, from the Neon project dashboard) in
   the local environment.
2. `npm run db:setup`, applying `db/schema.sql`. Creates the ten tables; idempotent, safe to
   re-run any time the schema changes.
3. `npm run db:roles`, applying `db/roles.sql`. Creates (or converges) `ask_ingest` and `ask_app`,
   sets their passwords, and applies the grant matrix. Because the tables already exist from step
   2, the exact per-table matrix lands directly on this run rather than the broader
   default-privilege baseline a roles-first run would leave in place. Prints the two ready-to-paste
   connection strings.
4. Copy the printed `DATABASE_INGEST_URL` and `DATABASE_URL` values into the local environment.
5. Set `OPENAI_API_KEY`.
6. `npm run ingest`, to embed and load the corpus (fourteen files plus every blog post) into the
   corpus tables.
7. `npm test`, to confirm the 74 unit tests still pass. These are mocked and need no live database,
   so they can run at any point in this sequence, including before step 1.

Both apply orders for steps 2 and 3 are safe to run in practice (see `db/roles.sql`'s own "Apply
order" section), but schema-first is the one without an intermediate window where `ask_app` holds
broader grants than intended.

## Role grants: design notes

Referenced from `db/roles.sql`, which keeps only short pointers to this section.

**Apply order.** `npm run db:roles` is designed to run either before or after `npm run db:setup`
creates any table. Roles-first: `db/roles.sql`'s `alter default privileges` baseline (full CRUD
for `ask_ingest`, SELECT+INSERT for `ask_app`) makes each table usable the instant `db/schema.sql`
creates it, but this is a real, accepted gap until `db:roles` runs a second time: `ask_app`
briefly holds INSERT on `corpus_meta` (should be SELECT-only) and only SELECT+INSERT on the
identity/traffic tables (should be full CRUD). Schema-first: every table already exists on
`db:roles`' one run, so the exact per-table matrix lands directly, no intermediate window.
`scripts/db-roles.ts` detects which case it is in (checking whether the corpus tables exist
already) and states which one happened in its own output, including a reminder to re-run when it
was the roles-first case.

**Convergent, not merely idempotent.** Re-running `db/roles.sql` produces exactly the grant state
written in the file, discarding whatever either role held before on an existing table, rather
than layering new grants on old ones. This also makes it safe against a database where
`ask_ingest`/`ask_app` were granted access by hand before this file existed: whatever they held
is revoked and rebuilt from the file alone.

**Password mechanism.** `create role` / `alter role ... password` takes the password as a literal
grammar token, not an expression, so there is no `$1` placeholder to bind it into safely the way
a `select ... where col = $1` can. `scripts/db-roles.ts` routes the value through
`select set_config($1, $2, false)` first (an ordinary bindable parameter position), keeping it out
of the SQL text and out of the committed file; `db/roles.sql` then reads it back with
`current_setting` and quotes it with `format(..., %L)` before splicing it into a dynamic
`alter role` statement, rather than ever concatenating the raw value into SQL text.

**Verified against Neon's documentation** (neon.com/docs/manage/roles,
neon.com/docs/manage/database-access), 2026-07-28: roles created by plain SQL (as `db/roles.sql`
does) receive only basic public-schema privileges and no `neon_superuser` membership, unlike
roles created through the Neon console/API/CLI, which are auto-granted `neon_superuser`. That is
exactly the least-privilege starting point this design wants. Neon also confirms
`neon_superuser` cannot itself log in and cannot be altered, and already carries `grant all` on
public-schema tables and sequences, so the owner role needs no extra setup to run the grants in
`db/roles.sql`.

## Environment variables

**Implemented today**, present in `.env.example` and read by landed code:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_BASE_URL` | Base URL for building UTM-tagged links (pre-dates the ask agent) |
| `DATABASE_URL` | Neon Postgres, as the least-privilege `ask_app` role. The running app's connection |
| `DATABASE_INGEST_URL` | Neon Postgres, as the least-privilege `ask_ingest` role. Read only by `npm run ingest` |
| `DATABASE_ADMIN_URL` | Neon Postgres, as the owner role. Read only by `npm run db:setup` and `npm run db:roles`; never by the app or by ingest |
| `ASK_INGEST_PASSWORD` / `ASK_APP_PASSWORD` | optional; pins the password `npm run db:roles` sets for each role, for a reproducible rerun. Unset generates a fresh one each run |
| `OPENAI_API_KEY` | embeddings, read by `lib/ask/embed.ts` |

**Planned, for phases not yet built.** Named here so the shape is decided in advance; none of
these are in `.env.example` yet, and no landed code reads them.

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | generation |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Sign in with Google; also the `aud` checked server-side |
| `RESEND_API_KEY` | gap notification, answer delivery, weekly digest |
| `EMAIL_FROM` | verified sender, e.g. `ask@tanishnahata.com` |
| `ADMIN_EMAIL` | notifications and digest destination |
| `ASK_SIGNING_SECRET` | HKDF root for cookie and capability signing |
| `IP_HASH_SALT_SEED` | daily-rotated IP salt derivation |
| `DAILY_SPEND_CAP_USD` / `USER_SPEND_CAP_USD` | hard ceilings |
| `APEX_HOST` | asserted against request `Host` in production |

Three connection strings, three roles, one database: see [03 Data model](03-data-model.md) for the
grant matrix, the vendor comparison against Supabase, and why Neon Auth was rejected for v1.

The Next.js app gets the implemented variables automatically: `next dev` and `next build` load
local configuration files on their own. Standalone scripts do not get that for free. `npm run
ingest`, `npm run db:setup`, `npm run db:roles`, and the eval harness once it exists, call a shared
loader (`scripts/load-env.ts`) as the first thing they do, which reads local configuration the same
way `next dev` does, before any of the variables above are read. Skipping that call is exactly the
bug where a script reports a variable as unset even though it is correctly set on disk, because
nothing ever loaded the file into `process.env`.

`scripts/load-env.ts` uses `@next/env`, not the `dotenv` package or Node's `--env-file` flag: only
`@next/env` resolves variables with the exact file precedence Next itself uses, so a script and the
running app never disagree about which file wins. It calls `loadEnvConfig` with `dev: true`, since
every caller is a manual or CI dev-time tool, never a deployment.

**Import-hoisting caveat:** `loadScriptEnv()` only has to run before the *first* `process.env`
read in the process, not before every import. ES module imports are evaluated before any
top-level statement in the importing file runs, so a module that reads `process.env` at its own
top level would already have executed before `loadScriptEnv()`'s call site does, regardless of
where that call site sits in the file. `lib/ask/db.ts` and `lib/ask/embed.ts` both read
`process.env` lazily, inside functions invoked later at runtime, so calling `loadScriptEnv()`
after a script's imports (but before any real work) is sufficient today. A future `lib/ask` module
that reads configuration at module scope would break that assumption and would need the call
moved ahead of its import instead.

Resend needs DNS verification for the sending domain, which has propagation latency: do it early.

## Process and tooling safety

**Implementation is delegated to subagents on Sonnet, not done inline.** Recorded in `AGENTS.md`
as a standing instruction: a subagent reads the relevant spec file in `docs/ask-agent/` plus every
source file it will touch before writing code, and reports actual command output (test runs, type
checks, script results) rather than a claim of success without it.

**A PreToolUse hook denies any tool call referencing a local dotenv file**
(`.claude/hooks/block-env-local.sh`, wired in `.claude/settings.json`), with permission `deny`
rules on `Read` for the same filenames as a second, independent layer that does not depend on the
hook script path resolving. Local dotenv files hold live credentials; nothing an assistant does
needs their values, since code reads them from `process.env` at runtime and a missing variable
already fails loudly with its own message (see `AskDbConfigError` in `lib/ask/db.ts` and
`AskEmbedConfigError` in `lib/ask/embed.ts`). The check is deliberately blunt: it denies on any
mention of the dotenv prefix, after scrubbing the phrases that legitimately contain it
(`process.env`, `import.meta.env`, and the committed `.env.example` template), rather than
matching one exact filename, since a single literal match is defeated by a glob or a bare name.
**The scrub list is exactly as load-bearing as the match itself:** an early version of this hook
denied every command containing `process.env`, which is how the code reads these variables and
appears throughout a Next.js repo, and it blocked its own commit.
