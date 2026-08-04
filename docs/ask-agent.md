# Ask agent

A grounded chat agent for tanishnahata.com. Answers only from a hand-written corpus, refuses
visibly when it cannot, and logs every turn so the gaps are queryable.

Rebuilt from scratch 2026-08-03. The previous version was 1,356 lines of library code and a
2,482-line spec for a 74 KB corpus. Deleted entirely. This is the whole design.

## Scope

In: retrieval over the corpus, refusal with a reason, multi-turn chat, streamed tokens, sign-in
past the first turn, per-user daily cap.

Out: source tagging and citation pills, a trace panel, gap capture buttons, per-page context,
tool use, reading repository source.

## Schema

```sql
create extension if not exists vector;

create table chunks (
  id        text primary key,   -- "identity#name-and-current-role"
  content   text not null,
  metadata  jsonb not null,     -- {file, heading, title, embed_model, dims, content_hash}
  embedding vector(1024) not null
);

create table user_interactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       text,           -- Clerk userId, null when anonymous
  anon_id       text,           -- cookie uuid
  question      text not null,
  answer        text,
  retrieved     jsonb,
  is_free       boolean not null default false,
  model         text,           -- set only when a model was actually called
  locked_reason text,
  created_at    timestamptz not null default now()
);

create index on user_interactions (user_id, created_at desc);
create index on user_interactions (anon_id, created_at desc);
```

**`vector(1024)`, not `float[]`.** pgvector is already installed and the `<=>` operator does cosine
distance in the query. A `float[]` has no distance operator, so similarity moves into JS and every
question fetches all rows and their vectors (~385 KB) over the wire. The typed column is less code,
not more.

**`chunks.id` is deterministic**: `${file}#${heading-slug}`. That is what removes the need for a
`documents` table. Ingest diffs the desired id set against the live id set and applies the
difference in one transaction.

**`model` is the cost marker.** It is non-null exactly when Anthropic was called. Both gates count
`where model is not null`, so a refusal that cost nothing never burns a turn and a refusal that did
cost always does. This is the single column that prevents the free-turn hole.

**`user_interactions` is insert-then-update**, not append-only. One row per turn: inserted before
generation to claim it, updated with the answer or the lock reason when the turn ends.

## Request pipeline

```
1  zod-parse body                     question: string, capped length
2  pre-filter                         injection or private -> log row (model null), refuse
3  identity                           Clerk userId, else anon cookie (mint if absent)
4  gate                               count rows where model is not null
                                        anonymous, >= 1  -> gate sign_in_required
                                        signed in, >= 20 today -> gate rate_limited
5  embed question                     first paid call, only after the gate passes
6  retrieve top 3, cosine
7  threshold                          best < 0.25 -> off_topic
                                      best < 0.40 -> no_grounding      (log row, model null)
8  insert claim row                   model set here, before generating
9  rebuild history                    last 3 turns for this identity, char-capped
10 generate
11 marker emitted                     -> locked_reason = unanswerable  (row keeps model, counts)
12 stream answer                      -> update row with answer + retrieved
```

Steps 2 and 7 are the free refusals. Step 8 is where money starts.

`locked_reason` is a closed enum: `injection`, `private`, `off_topic`, `no_grounding`,
`unanswerable`, `sign_in_required`, `rate_limited`.

Gaps are a query, not a feature:

```sql
select question, count(*) from user_interactions
where locked_reason in ('no_grounding', 'unanswerable')
group by question order by count(*) desc;
```

## Retained decisions

**Only strong grounding generates.** Below `T_STRONG` the agent refuses. There is no best-effort
answer path. A branded `StrongGrounding` value is the argument type of `generate()`, so an
ungrounded generation does not typecheck.

**`TOP_K = 3` is a ceiling, not the context size.** The verdict comes from the top score; the
context is every retrieved chunk at or above `T_STRONG`. A chunk at 0.28 in a query whose best is
0.55 is noise and never reaches the prompt. Sections are small (858 chars average), so broad
questions are the ones a low ceiling can starve; phase 2 measures that against the eval set.

**Answerability is judged by the model.** Similarity measures aboutness, not containment: "what is
his salary at ESMON" scores high against the ESMON chunks and none of them answer it. The model
emits a per-request random marker instead of answering when the context does not contain the
answer. Random because a fixed marker is a literal string a visitor can type.

**Context and question carry per-request randomized delimiters.** The shape is
`<ctx-TOKEN trust="none">...</ctx-TOKEN>` and `<q-TOKEN>...</q-TOKEN>`, sharing the token with the
answerability marker. A question matching `/<\/?(ctx|q)-/i` is rejected with `ForgedDelimiterError`.
The random token is what makes a delimiter unforgeable, so the rejection regex only has to catch
attempts at those two prefixes. Ordinary prose containing `<context>` is harmless and passes.

**Pre-filter runs before retrieval.** Injection attempts and private questions are refused
regardless of what comes back, so embedding first is wasted spend, and retrieving on "his salary"
pulls exactly the job chunks.

**History is rebuilt server-side** from `user_interactions` for this identity. Client-supplied
history is forgeable: a fabricated prior assistant turn puts an unverified claim in context that
the grounding gate never saw. Now three lines of SQL rather than a subsystem.

**Embed model recorded in `chunks.metadata`.** Retrieval reads it from one row and refuses if it
differs from the configured model. Without this a model swap silently produces meaningless
similarity scores and the agent starts answering wrong.

**Ingest refuses an empty desired corpus.** `ALL` over an empty set is vacuously true, so the
delete sweep would wipe the index.

**BotID fails closed.** Package, `withBotId` in next.config, client `initBotId`, server check.

## Dropped, and what replaced it

| Dropped | Replacement |
|---|---|
| `documents` table | deterministic chunk id, `file`/`heading`/`title` in metadata |
| `users` table | Clerk is the user store; `user_id` is the join key if one is ever needed |
| `ask_events` table | `user_interactions`, one row per turn |
| `ingest_completed` event | `embed_model` and `dims` in `chunks.metadata` |
| `captured` event and the ask-him button | gaps query over `locked_reason` |
| Source tagging, `route` frontmatter, citation pills | nothing; the answer stands alone |
| Trace toggle, `retrieved` and `graded` stream parts | nothing; `retrieved` still logged, never shown |
| Self-gating rate-limit `UPDATE` | count query plus claim-before-generate |
| `@llamaindex/core` | split on `##` with a regex |

**Two consequences worth naming.**

The pitch was "shows its retrieval work, refuses visibly." Dropping source tagging removes the
first half. The refusal half survives and is the stronger half.

The rate limit is no longer atomic. A count plus a claim row inserted before generation shrinks the
race to near zero, but a burst can yield limit+1. The Anthropic console cap is the real ceiling
underneath.

## Edge behaviour

Pinned because wave 2 would otherwise guess, and two agents guessing separately is how a contract
drifts.

**An empty `chunks` table is a broken deployment, not an off-topic question.** `retrieve()` throws
`EmptyIndexError` rather than returning an empty array, because silently refusing every question as
off topic would look identical to a working agent facing a hostile visitor. `grade([])` still
returns `off_topic` as a defensive floor. Both `EmptyIndexError` and `IngestConfigMismatchError`
are operator errors, not refusals: the route surfaces them as a failure, never as a `refusal` part.
The check runs before the question is embedded, so a broken index costs nothing.

**`loadHistory` returns chronological order, oldest first.** That is the order `messages` needs, so
any other choice means a caller reverses it.

**`generate()` returns a stream and a verdict, not just a stream.** The marker is withheld, so an
unanswerable turn streams nothing, and empty output is indistinguishable from a short answer. The
caller needs a second channel to know whether to call `completeTurn` or `lockTurn`, so `generate`
returns `{ stream, outcome }` where `outcome` resolves after the stream completes with the
accumulated text and whether the marker fired.

**`is_free` is true when the turn generated without a signed-in user**, set at claim time. It is
recoverable from `user_id is null`, and kept because it stays true in the row after that visitor
later signs in, which is the only way to count how often the free turn converts.

**`IngestConfigMismatchError` belongs to retrieval, not ingest.** Ingest writes whatever the config
says; retrieval is where a mismatch between the configured model and the stored one becomes wrong
answers.

## Refusals

`locked_reason` is null on a turn that produced an answer. Non-null is exactly the set of turns
that produced none, and the value says why. Without it `answer is null` means five different
things at once (still streaming, crashed, injection, private, real gap) and both the gaps query
and eval scoring become unreadable.

Every reason is decided in code. The model never sees `locked_reason` and never writes refusal
text.

| reason | decided by | model called |
|---|---|---|
| `injection` | regex pre-filter | no |
| `private` | keyword pre-filter | no |
| `sign_in_required` | gate count | no |
| `rate_limited` | gate count | no |
| `off_topic` | top score < `T_FLOOR` | no |
| `no_grounding` | top score < `T_STRONG` | no |
| `unanswerable` | model emits the marker | yes |

Refusal copy is a lookup table keyed by reason, with the topic templated in. Deterministic, free,
and incapable of hallucinating a reason for its own refusal.

`unanswerable` is the only reason reached with a model in the loop, and even there the model emits
the marker as a signal, not as copy. A stream transform buffers output while it is a prefix of the
marker so it never reaches the browser; the client renders the same templated line as any other
refusal.

The reason travels two places from one decision in code: into the `refusal{reason, text}` stream
part, and into `locked_reason` on the row. Nothing downstream reads it back to make a decision.

## Streaming

Route responds 200 with a UI message stream. Four part types: `status`, `answer`,
`refusal{reason, text}`, `gate{reason, resetsAt?}`.

Status codes stay 200 because `useChat` routes any non-2xx to `onError` and never parses the body,
so a 429 would render a generic error instead of the inline sign-in interstitial. A separate
`GET /api/ask/status` returning real 401/429 is available if correct codes are wanted for logs.

## Config

One `lib/ask/config.ts`, code constants, never env: embed model and dims, chat model, `TOP_K = 3`,
`T_STRONG = 0.40`, `T_FLOOR = 0.25`, daily limit 20, free turns 1, history turns 3 and char cap.
A threshold that differs between environments is unreproducible.

## Files

```
lib/ask/
  config.ts     constants
  db.ts         pool
  schema.ts     two tables
  corpus.ts     read files, frontmatter, split on ##
  ingest.ts     embed and reconcile in one transaction
  retrieve.ts   embed question, top-k, threshold verdict
  filter.ts     pre-filter
  prompt.ts     system prompt and assembly
  log.ts        insert and update user_interactions
  ask.ts        prepareTurn / runTurn
app/api/ask/route.ts
components/ask/
scripts/ingest.ts, scripts/db-setup.ts
db/schema.sql
```

## Phases

1. Schema, corpus loader, chunker, ingest. `npm run ingest` against a scratch database.
2. Retrieval and thresholds, re-tuned against the rebuilt index.
3. Prompt, grounding gate, generation, marker. CLI harness.
4. Route: identity, gates, logging, streaming.
5. UI: the Signal FAB and panel.
6. Ingest CI/CD: validate on PR, apply on main.
7. Eval harness against `evals/questions.yaml`.

## Voice

A colleague who worked next to Tanish, not a publicist. Answers in the first sentence, under 120
words, no em-dashes, no hedging stacks. Quantifies when the corpus quantifies. Says "he hasn't done
that" without softening.

Refusal copy is one line per reason, templated with the topic, no model call.
