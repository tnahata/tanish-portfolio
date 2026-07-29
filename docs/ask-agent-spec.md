# Ask Agent — Spec

> **Deprecated.** This is the pre-split single-file draft. It has been superseded by
> [`docs/ask-agent/`](ask-agent/README.md); start there, not here. Kept only for history: do not
> edit it further and do not treat anything below as current.
>
> Specific content below is now wrong. Two examples, verified against the current design:
> line 285 claims "Six tables. Rate limiting and spend reservation live in Upstash." The current
> design is ten tables in one Postgres database (`corpus_meta`, `documents`, `chunks`, `users`,
> `sessions`, `turns`, `gap_questions`, `login_nonces`, `rate_counters`, `spend_reservations`; see
> `db/schema.sql` and [`docs/ask-agent/03-data-model.md`](ask-agent/03-data-model.md)), with no
> Upstash and no Redis: rate limiting and spend reservation are `rate_counters` and
> `spend_reservations` tables in the same database.

A grounded chat agent for tanishnahata.com. Answers only from a curated corpus, shows its
retrieval work live, refuses out-of-scope questions with a visible reason, and turns the
questions it cannot answer into a public backlog.

## Why this instead of a generic portfolio bot

The core loop is deliberately boring: retrieve, grade, generate or refuse. Differentiation lives
in three places, none of them in the loop.

1. **Personality.** A colleague who worked next to Tanish, not a publicist. It volunteers what
   broke.
2. **Glass box.** Retrieval steps, sources, and grounding verdict stream to the UI before the
   answer does.
3. **Gap loop.** Questions it cannot answer reach Tanish by email, get answered, and are published
   at `/asked`. Blind spots become content.

## Goals

- Answer only from the approved corpus.
- Real multi-turn chat with history.
- Stream tokens. Perceived latency matters more than total latency.
- Refuse cleanly and visibly, with the reason exposed.
- Attribute every generated answer, gap, and dollar to a verified person.
- Publish counters, including the refusal rate.

## Non-goals (v1)

- Per-page context awareness. The FAB behaves identically everywhere. (v2)
- First-person voice. v1 speaks about Tanish in third person. (v2)
- Reading repository source at runtime. Code reaches the agent only as quoted snippets inside
  authored corpus files.
- Tool use of any kind. Retrieval is the only capability.

## Corpus

**Authored prose only.** Repository source is never ingested: not the files, not a parsed
version, not a model-generated summary, not a snapshot searched at runtime.

Automated extraction has no notion of what is disclosable, so it re-exposes exactly what the case
studies deliberately abstract away ("binary format", not a spec name). Public is not the same as
disclosable-in-context either: a stale TODO or a test fixture with a real address is public and
still should not be quoted by an agent speaking for a named person.

`content/corpus/*.md` is what the agent is allowed to know. Facts may be richer than a page,
never leakier.

### Manifest

Fourteen authored files plus every blog post.

| File | Contents | Derived from |
|---|---|---|
| `identity.md` | Name, current role, what he builds, positioning, public contact channels | `Hero.tsx`, `About.tsx` |
| `philosophy.md` | Systems thinking, interfaces as contracts, clarity as a proxy for competence, AI as substrate not feature | `About.tsx` |
| `personal.md` | Hybrid athlete, logic puzzles, electronic music, and why those matter to how he works | `About.tsx` |
| `experience-fedex.md` | FedEx Corp. SWE (Jun 2024 to Dec 2025), SWE II (Dec 2025 to present). Metrics, tech, scope | `Experience.tsx` |
| `project-discovery-agent.md` | Pipeline stages, human-in-the-loop as foundation, cost enforcement, style grounding | case study |
| `project-esmon.md` | Offline-first constraint, binary parsing, designing without review, PDF threading deadlock | case study |
| `project-hybrid-fit.md` | Multi-discipline model, heterogeneous workout schema, N+1 and caching work | case study |
| `code-hybrid-fit.md` | **Quoted snippets** with SHA-pinned permalinks: workout schema, enrollment model, caching layer. Chosen, not searched | public repo |
| `project-portfolio.md` | This site: stack, design system, UTM tracking, why it exists | new |
| `stack.md` | Languages, frameworks, AI/ML, infra, tools. **Each group needs reasoning**; bare tag lists retrieve poorly | `app/stack/page.tsx` plus prose |
| `disclosure-esmon.md` | ESMON engineering detail cleared for public disclosure | private repo |
| `disclosure-discovery-agent.md` | Same, for Discovery Agent | private repo |
| `agent-boundaries.md` | What the agent will and will not answer, what is collected, how to reach Tanish | new |
| `faq.md` | Opportunities, work authorization, remote preference, what he is looking for | new |

**Not in v1:** opinions (`/opinions` is a placeholder), Claude Code practice (route exists locally
but is unshipped), repository source, private notes, the resume PDF.

### Frontmatter

```yaml
---
id: project-esmon           # stable key, the ingest primary key
title: ESMON
kind: project               # blog | project | code | disclosure | page | meta | asked
route: /projects/esmon      # citation link target; null when no page exists
externalUrl: https://...    # optional, e.g. a SHA-pinned GitHub permalink
verbatimOnly: false         # true = quote, never paraphrase
clearedOn: 2026-07-27       # disclosure files only
---
```

`route: null` on `faq.md`, `agent-boundaries.md`, `project-portfolio.md`, and both disclosure
files. Disclosure files deliberately hold detail their case-study page omits, so citing the page
would point somewhere precise-looking and wrong.

`verbatimOnly: true` on `faq.md` and both disclosure files. See Retrieval.

**Blog files** carry `lib/blog.ts` frontmatter (`title`, `date`, `excerpt`, `featured`) and none of
the above. Ingest derives `id = 'blog-' + slug`, `kind = 'blog'`, `route = '/blog/' + slug`, and
strips `excerpt` before chunking since it duplicates the opening paragraph.

**Citations link to a route, not a fragment.** The case study pages carry no section `id`
attributes, so anchor links would land at the top of the page while appearing precise.

**No automated drift check.** Corpus files and pages can disagree. Hashing the source TSX to catch
it fires on cosmetic changes (those files are mostly SVG coordinates), so it would be routinely
bypassed. Case studies change a few times a year; keep drift manual.

### Chunking and ingest

- Split on markdown headings (`##` / `###`), pack to ~800 tokens with ~100 token overlap.
- Short files (`identity.md`, `faq.md`) stay single chunks.

### Embedding lifecycle

**Ingest is a reconciliation to a declared desired state, not a rebuild.** Read the files, compute
what the index *should* contain, diff against what it *does* contain, apply the difference.

Embeddings are stored inline on the chunk row: one chunk, one `vector(1024)` (voyage-3.5-lite's
default dimensionality). There is no separate vector store to keep in sync, which removes an
entire class of drift.

**Four things make an embedding stale**, and each is detected differently:

| Cause | Detected by | Action |
|---|---|---|
| Chunk text edited | `content_hash` differs | re-embed that chunk |
| Chunk removed (file shortened) | `ordinal` beyond the new chunk count | delete those rows |
| Whole document deleted from disk | **set difference** against the manifest | delete the document, cascade |
| Embedding model or dims changed | `corpus_meta` mismatch | forced full re-embed, re-tune thresholds |

The third row is the one an earlier draft got wrong. Iterating files on disk never visits a
deleted file, so its rows survive and keep being retrieved forever. **Deletion has to be driven by
the desired-state set, not by a per-file loop:**

```sql
begin;
-- 1. upsert documents present on disk, by slug
-- 2. per document: re-embed only chunks whose content_hash changed,
--    upsert on (document_id, ordinal)
-- 3. drop chunks whose ordinal exceeds the new chunk count
-- 4. the sweep: anything file-sourced that disk no longer declares
delete from documents
 where source = 'file'
   and slug <> all($1::text[]);   -- $1 = every slug found on disk
-- 5. update corpus_meta
commit;
```

One transaction, so MVCC keeps concurrent readers on the previous snapshot until commit. No
window where the index is empty.

Unchanged chunks are not re-embedded. At 150 chunks that is a rounding error either way, but the
reconcile shape is what makes step 4 correct, and correctness is the reason to prefer it over
delete-everything.

**`source` is why reconcile matters here.** Documents come from two places: corpus files, and
published gap answers written at runtime. Scoping the sweep to `source = 'file'` leaves runtime
rows alone automatically. A delete-everything rebuild would wipe published answers and require
reading them back out of `gap_questions` to restore them.

**Model change is the one case that needs a forced full re-embed.** `npm run ingest --force`
re-embeds every chunk and rewrites `corpus_meta`. Until it runs, the query path 503s on the
mismatch rather than scoring new query vectors against an index built in a different space.
Thresholds are calibrated to that space, so a model change also invalidates `T_STRONG`,
`T_SUPPORT`, and `T_FLOOR`: treat it as a re-tune, not a swap.

**Historical tracking is unaffected by any of this**, because `turns.retrieved` stores a snapshot
of what was read rather than pointers into an index that keeps changing.

`npm run ingest` runs manually while authoring, and in CI on push to `main` when `content/`
changes. Not part of `next build`.

**Published gap answers reach the corpus without a deploy.** Publishing writes a `documents` row
with `source = 'asked'`, `kind = 'asked'`, `route = '/asked'` and embeds it inline with one Voyage
call, so the next visitor gets the answer immediately.

## Data model

Postgres (Neon) with `pgvector`.

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

**`corpus_meta` is asserted at query time.** The thresholds below are calibrated against whatever
model produced the index; changing the embedding model silently invalidates them. If
`embed_model` or `embed_dims` disagree with the running config, the route returns 503 rather than
scoring against an incompatible space.

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

Six tables. Rate limiting and spend reservation live in Upstash.

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

## Retrieval and grounding

`askOnce(question, history)` is a **pure function**: retrieve, grade, generate or refuse. The
route is a thin streaming wrapper over it. Evals call it directly, so they need no HTTP server, no
bot check, and no production environment.

**Query construction.** When the previous turn was `answered`, embed
`previousQuestion + ' ' + currentQuestion`. A follow-up like "what about the caching part?"
embeds to noise on its own. No extra model call, and it handles anaphora.

Embed with `voyage-3.5-lite`, exact cosine scan over `chunks`, take top 8, then grade.

| Verdict | Condition | Behavior |
|---|---|---|
| `strong` | top ≥ T_STRONG and ≥ 2 chunks ≥ T_SUPPORT **from ≥ 2 distinct documents** | generate |
| `weak` | top ≥ T_FLOOR | refuse, name the closest source, offer capture |
| `none` | below T_FLOOR | refuse as off-task, no capture |

**Only `strong` generates.** Every corpus document is about Tanish, so a question about Tanish the
corpus cannot answer still scores in the middle band. That is ordinary embedding behavior for
topically-related-but-non-answering text, and letting it answer with a hedge would make it the
single most likely source of a confident wrong claim.

**Corroboration requires distinct documents.** With ~100-token overlap, two adjacent chunks of one
passage clear any support threshold together, which makes "≥2 chunks" satisfiable by a single
passage counted twice.

**Verbatim-only documents skip generation entirely.** When the top chunk belongs to a document
with `verbatim_only`, return the quoted chunk plus its citation instead of calling the model.
Clearance on `disclosure-esmon.md` was granted on *authored sentences*; paraphrasing produces new
sentences nobody cleared. Work authorization in `faq.md` gets the same treatment for the same
reason. This is the grounding ladder's own move applied one level deeper.

**The enforcement property: the generation model is never invoked without evidence.** Structural,
not conventional: `generate()` takes a branded `StrongGrounding` value that only the scorer can
construct. A test mocks the SDK and asserts zero invocations across every refusal stratum.

`T_STRONG`, `T_SUPPORT`, `T_FLOOR` are **TBD, set in Phase 2** against the eval set.

## Conversation history

**The full conversation is sent**, capped by a token budget rather than a turn count.

A question is roughly 30 tokens and a 120-word answer roughly 160, so a turn costs about 190.
Sixty turns, which is the entire per-user daily limit, is ~11k tokens against a 200k window. A
fixed three-pair window would truncate ordinary conversations for no benefit.

- Budget: **15k tokens of history**. Beyond it, evict oldest pairs first.
- Summarization on eviction is deferred. Nothing in this product's shape reaches the budget.
- Refused turns are included as history. "Why can't you answer that?" is a real follow-up, and
  dropping refusals makes the transcript incoherent.

**History is persisted and resumable.** `turns.conversation_id` groups a thread. An identified
visitor returning on any device resumes their most recent conversation, because the thread belongs
to `users.id`, not to a cookie. Anonymous visitors resume within their session only.

Prior answers are already grounded output, so including them is safe. One constraint in
`constraints.md` guards the remaining risk: **answer the current question from the current
context, never from what you said earlier.** Otherwise the model can synthesize a new claim by
combining two old answers without new evidence.

Grounding is graded fresh on every turn. History never substitutes for retrieval.

## Refusal taxonomy

| Outcome | Trigger | Capture offered? |
|---|---|---|
| `refused_no_grounding` | grounding `weak` | **Yes** |
| `refused_off_task` | grounding `none` | No |
| `refused_injection` | pattern list, before retrieval | No, logged |
| `refused_private` | pattern list, before retrieval | No |
| `refused_budget` | spend cap reached | No |

`weak` means the corpus is nearby but does not answer, which is exactly a content gap worth
capturing. `none` means nothing in the corpus is close, which is off-task.

The private and injection pattern lists are UX, not controls: base64, homoglyphs, and other
languages walk through them. The real defenses are the delimiting below and the fact that the
model has no tools.

## Framework and streaming

**Vercel AI SDK (`ai` + `@ai-sdk/anthropic`). No second library, now or later.**

The AI SDK has a full tool loop built in. `streamText` accepts `tools` and
`stopWhen: stepCountIs(n)`, appends each response to the conversation, executes tool calls, feeds
results back, and repeats until a text response or the step limit. AI SDK 6 packages the same
behavior as `ToolLoopAgent`. So adding a tool later is a `tools: { ... }` argument on the call
that already exists, not a new dependency.

v1 declares no tools, so the loop degenerates to a single completion. That is a property of this
agent's shape, not a limitation of the SDK.

Standalone agent harnesses (deepagents, and similar) add planning steps, subagents, and virtual
filesystems on top of that loop. Nothing here needs them.

The AI SDK also earns its place on the chat side, which is where the work actually is:

- `useChat` owns the client state machine: message list, streaming, loading, errors, input.
- **Typed data parts** carry the glass box instead of a hand-rolled SSE contract.
- **Transient parts** (`onData`) carry progress without polluting message history.
- **Same-ID reconciliation** updates one status part in place rather than appending noise.

```ts
// server
const stream = createUIMessageStream({
  execute: async ({ writer }) => {
    writer.write({ type: 'data-status', id: 'status',
                   data: { label: 'searching corpus' }, transient: true });
    const { chunks, verdict } = await retrieveAndGrade(q, history);
    for (const c of chunks) writer.write({ type: 'data-source', data: c });
    writer.write({ type: 'data-verdict', data: { grounding: verdict } });
    if (verdict !== 'strong') {
      writer.write({ type: 'data-refusal', data: refusalFor(verdict, chunks) });
      return;
    }
    writer.merge(streamText({ model, system, messages }).toUIMessageStream());
  },
});
```

The grounding gate sits before `streamText` and decides whether there is a call at all. Refusals
never reach the model.

**Write a status part on handler entry, before any await.** Vercel cold start plus Neon
scale-to-zero wake means a sporadic-traffic site pays 0.5 to 5 seconds before the first byte, and
`X-Accel-Buffering` is nginx-specific and a no-op on Vercel. An immediate first part forces the
flush and gives the panel something to render.

Runtime is Node, the App Router default, with `export const maxDuration = 30`. The request is
database-heavy, so the function belongs near Neon.

**Input cap:** questions over 1,000 characters are rejected before embedding.

## Personality

**A colleague who worked next to Tanish and will tell you what actually happened.** Not a
publicist. It volunteers what broke, says "he hasn't done that" without softening, and answers in
three sentences when that is the answer. This decides what the agent says when the honest answer
is unflattering, which is the only moment personality is visible.

```
prompts/
  system.md          — colleague framing, role, boundaries
  constraints.md     — the hard rules below
  exemplars.md       — 12 question/answer pairs in voice
lib/ask/refusals.ts  — refusal copy by bucket; never enters a prompt
lib/ask/prompt.ts    — assembles, exports ASK_VERSION
```

`ASK_VERSION` hashes the three prompt files, `refusals.ts`, and the thresholds module, and is
stamped on every turn. Refusal copy is user-visible output and needs the same version hygiene as
generated text.

### Assembly

```ts
const tag = randomTag();   // per request
system: [{ type: 'text', text: system + constraints + exemplars }],
messages: [
  ...last3Pairs,
  { role: 'user',
    content: `<ctx-${tag} trust="none">${chunks}</ctx-${tag}>\n`
           + `<q-${tag}>${question}</q-${tag}>` },
]
```

Both tags are randomized per request. A fixed `</question>` marker is forgeable by a question
containing that literal string. Inputs matching `/<\/?(ctx|q)-/i` are rejected outright.

No `cache_control`: the ephemeral cache expires in five minutes and portfolio traffic is sporadic,
so the write premium would be paid on nearly every request for no read discount.

**All twelve exemplars are answers.** None demonstrate refusals or thin-coverage hedges, because
those paths never reach the model.

### Constraints

- Answer in the first sentence. No restating the question, no "great question".
- ≤120 words. Under 40 when the answer is short.
- No em-dashes.
- No hedging stacks. Say it or say you do not know.
- No emoji, exclamation marks, or roleplay stage directions.
- Quantify when the corpus quantifies: "8+ seconds to under 2", not "significantly faster".
- Name the tradeoff, do not sell the outcome.
- **Answer from the current context, never from an earlier answer in this conversation.**

### Refusal copy

In `lib/ask/refusals.ts`, three or four variants per bucket, selected by hashing the question so
the same question always yields the same line. Deterministic reads as consistent; random reads as
a slot machine. Topic is templated in deterministically, with no model call:

> "Not something he's written about (Kubernetes). Want me to ask him?"

### Verifying voice

Only detectable by reading. Every eval answer is read by hand before launch and after any prompt
edit, keyed by `ASK_VERSION`.

## Identity and the gate

**The gate is on generation, not on message count.**

Refusals cost one embedding call, roughly a thousandth of a cent, and never invoke Sonnet.
Generation is where cost, abuse risk, and attribution value all live. So:

- **Refusals are unlimited and anonymous.** A visitor can watch the agent decline, see the trace,
  and use the capture affordance without signing in. Refusal is the differentiated behavior; hiding
  it behind auth would hide the product.
- **The first generated answer is free. The second requires Google sign-in.**

This preserves everything identity was for (per-user rate limits, cost attribution, analytics)
because everything expensive is on the generation path.

`ask_sid` is a **signed** httpOnly SameSite=Lax cookie holding a session UUID. Signed because it
now authorizes a free generation.

**The free generation is counted per IP prefix, not per cookie**, in Postgres:
`freeused:<ip_hash>` where `ip_hash` covers the **/32 for IPv4 and /56 for IPv6**. Hashing a full
IPv6 address gives an attacker 2^64 free generations from one subscription. The salt derives as
`HMAC(seed, utcDate)` and any counter keyed on it uses the same `utcDate`, so rotation and window
boundaries coincide instead of silently resetting mid-window.

### Mechanics

Standard Sign in with Google button, not One Tap (mid-migration to FedCM, degrades where
third-party cookies are blocked).

```
server  → nonce = random; SET nonce:<sid> EX 300 NX   (Upstash)
client  → Google button returns an ID token carrying that nonce
        → POST /api/ask/identify { credential }        (Origin checked)
server  → verifyIdToken(credential, { audience: GOOGLE_CLIENT_ID })
        → assert iss ∈ {accounts.google.com, https://accounts.google.com}
        → assert email_verified === true
        → GETDEL nonce:<sid>, assert match
        → reject if sessions.user_id already set to a different user
        → upsert users by `sub`; never trust client-decoded claims
        → set sessions.user_id, replay the held question
```

Without the nonce, any ID token minted for this public client ID replays. Without the Origin
check, login-CSRF binds a victim's session to an attacker's account.

Scopes are `openid`, `email`, `profile`, all non-sensitive, so **no Google app review is
required**. The ID token flow needs only the client ID, no secret.

A **separate OAuth client for development** with `localhost:3000` as an origin. Never add
localhost to the production client.

**The pending question is held and replayed** after sign-in.

### Environments

`/api/ask` returns 503 unless `VERCEL_ENV === 'production'` **and** the request `Host` matches the
apex domain. Never branch on `NODE_ENV`, which is `production` on previews too. The `Host` check
matters because every historical production deployment keeps a public immutable URL that
Deployment Protection does not cover.

Evals call `askOnce()` in process and never touch the route, so the guard costs nothing in
testing. Deployment Protection is enabled on all non-production deployments.

The gate itself cannot be driven by Playwright, since Google blocks automated browsers. Phase 5
tests the panel with the identify step stubbed, and the gate is smoke-tested by hand once on
production.

### Privacy and retention

- **Retention:** a daily job nulls `turns.question`, `turns.answer`, and `gap_questions.question`
  older than 90 days, keeping the metric columns. The job accepts an injectable clock so the
  behavior is testable without backdated rows.
- **Deletion:** by email request, stated on `/privacy`. No endpoint. A self-serve delete would
  also be a free reset for every per-user limit and spend counter, since a fresh `users.id`
  restarts them.
- **IP salt rotates daily**, since a static salt over IPv4 space is brute-forceable in seconds.
- **`/privacy` names every subprocessor**: Anthropic, Voyage, Vercel, Neon, Upstash, Resend,
  Google. Linked from the gate.

## Abuse controls

| Threat | Stopped by |
|---|---|
| Scripted abuse, including rotating IPs | **BotID** |
| Sustained use by one person, across devices or cleared cookies | **verified identity + per-user limits** |
| Casual over-use, accidental client loops | Upstash limits |
| Cost exhaustion | **atomic spend reservation** |

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

**Upstash limits.** `@upstash/ratelimit` defaults to fail-open on error; override to **fail
closed**, because a quota outage would otherwise remove every limit and the spend cap
simultaneously. Combine the limiter and reservation into a single Lua `EVAL` to keep command count
low, since 500K commands per month is exhaustible at roughly 50K requests if each costs a dozen.

| Key | Per minute | Per day |
|---|---|---|
| `ip:<prefix_hash>` refusals | 20 | 200 |
| `ip:<prefix_hash>` generations, anonymous | 1 | 1 free total |
| `user:<users.id>` | 10 | 60 |

**Spend reservation.** Summing today's tokens before generating is a read-then-act race, and it
undercounts because refusals and embeddings bill without producing token rows.

```
reserve → SET spend:res:<uuid> <est> EX 60        (self-expiring)
          INCRBYFLOAT spend:day:<utcDate> <est>   (EXPIRE 48h)
commit  → adjust spend:day by (actual - est), DEL the reservation
```

A one-minute cron decrements `spend:day` for reservation keys that expired without committing.
Without that, `maxDuration` kills a stream before any `finally` runs, the reservation is held
forever, and an attacker who opens streams and drops them at 29 seconds mutes the agent for
everyone while spending nothing.

Reserve and commit run in one Lua script so the global and per-user counters move atomically. Caps
are per-user as well as global, so one attacker cannot silence the agent for everybody. A warning
email fires at 70% of the global cap.

## Gap queue

1. Agent emits `refused_no_grounding`. The capture affordance is offered to anonymous visitors
   too, since refusals are ungated.
2. `POST /api/ask/gap` inserts a row. The server verifies the referenced turn belongs to the
   caller's session and has `outcome = 'refused_no_grounding'`; the client supplies an id, not a
   claim.
3. Resend notifies `ADMIN_EMAIL` as **plain text**, never HTML: the question, UTM source, and a
   signed capability link. Visitor prose in an HTML email alongside a real admin link is an
   invitation to inject a decoy. Email is best effort and never blocks the insert; notifications
   coalesce into the digest above five per day.
4. Reply delivery goes to `users.email` when the session is identified. Anonymous askers get their
   answer on `/asked` only; there is no attacker-supplied address anywhere in the schema.
5. Publishing requires an explicit second confirmation and publishes **the answer only, never the
   question text**. `/asked` renders escaped plain text, no markdown, no HTML.

### Admin access

```
GET  /admin/answer/<id>?t=<token>   → static interstitial with a POST button
POST /admin/answer/<id>             → verify, exchange, redirect
```

The GET does nothing but render. Mail scanners (SafeLinks, Gmail proxy) issue GETs on every link,
which would otherwise burn a single-use token and set an admin cookie inside the scanner.

The token is an HMAC over a versioned fixed-order string containing `{jti, gapId, scope, exp}`,
not "canonical JSON", and scope is inside the signature rather than a query parameter. Compare
length first, then `timingSafeEqual`, which throws on length mismatch and would otherwise turn a
403 into a 500 length oracle. Signing keys derive per purpose:
`HKDF(ASK_SIGNING_SECRET, 'ask_sid')` and `HKDF(ASK_SIGNING_SECRET, 'admin-cap-v1')`.

Separate `answer_token_used_at` and `publish_token_used_at` columns, because one shared column
means answering a question permanently blocks publishing it.

The exchanged cookie carries `{gapId, scope, exp: +30m}`, `Path=/admin`, `SameSite=Strict`, so one
leaked link yields access to one question for thirty minutes, not a general admin session.
`/admin/*` sets `Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex` and is excluded from
Vercel Analytics, which this site already mounts.

A weekly digest lists every question still `new`. No login page, no session table, no auth vendor.

## `/asked`

Reverse-chronological published answers, each linking to any blog post it grew into.

```
847 asked · 61 refused · 23 queued · 12 answered · 4 became posts
```

Publishing the refusal rate is the credibility move. Empty state renders zeros with a line
explaining the page.

## UI

Fixed bottom-right FAB, all pages. `useChat` owns panel state.

- Collapsed: circular button, cyan accent (`#00d9ff`), `aria-label="Ask about Tanish's work"`.
- Expanded: ~380px panel, max 70vh, bottom sheet on mobile.
- Answer area, sources as citation pills linking to `route` or `external_url`.
- Trace toggle reads transient parts via `onData`.
- Refusals render as a distinct block, not an error.
- Sign-in interstitial appears inline before the second generated answer, with the pending
  question held and replayed.
- Respects `prefers-reduced-motion`. Focus trap, Esc closes, WCAG AA contrast.

### Starter chips

1. "What is he working on now?" — factual, strongly grounded.
2. "What broke while building ESMON?" — where the colleague voice separates from a publicist.
3. "How does HybridFit model a workout?" — answered from `code-hybrid-fit.md` with a quoted
   snippet and a permalink.

**Every chip is verified against the eval set before shipping.** They are the only questions
guaranteed to be asked, so a chip regression is a launch blocker. No refusal chip: refusal is good
to encounter, not to advertise on arrival.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres |
| `ANTHROPIC_API_KEY` | generation |
| `VOYAGE_API_KEY` | embeddings |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Sign in with Google; also the `aud` checked server-side |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | rate limiting, nonces, spend reservation |
| `RESEND_API_KEY` | gap notification, answer delivery, weekly digest |
| `EMAIL_FROM` | verified sender, e.g. `ask@tanishnahata.com` |
| `ADMIN_EMAIL` | notifications and digest destination |
| `ASK_SIGNING_SECRET` | HKDF root for cookie and capability signing |
| `IP_HASH_SALT_SEED` | daily-rotated IP salt derivation |
| `DAILY_SPEND_CAP_USD` / `USER_SPEND_CAP_USD` | hard ceilings |
| `APEX_HOST` | asserted against request `Host` in production |

Resend needs DNS verification for the sending domain, which has propagation latency: do it early.

## Evaluation

**Questions are written before the corpus exists**, from the visitor's side. Written afterwards,
they only ask what the corpus already answers.

**Labels are assigned in two passes**, because most are properties of a corpus and thresholds that
do not exist yet.

| Phase 0 assigns | After the corpus exists |
|---|---|
| should-answer / must-refuse, plus off-task, private, injection | citation target, multi-hop, thin-coverage, verbatim |

No strata quotas in Phase 0 either. Fixing "10% multi-hop" up front guarantees a reshuffle when
those questions turn out to be single-hop.

Set size: **~50 questions**, with absolute minimums on the gated strata rather than percentages.
A 4% stratum of 50 is two items, which is not a gate.

| Stratum | Minimum | Expected |
|---|---|---|
| Unanswerable, fair | 12 | refuse `weak`, offer capture |
| Off-task | 6 | refuse `none`, no capture |
| Private | 5 | hard refuse |
| Injection | 8 | refuse, hold voice |
| Verbatim-sensitive | 10 | quoted, never paraphrased |
| Answerable | remainder | answer, cite correctly |

The verbatim stratum exists because the false-answer gate only covers unanswerable questions. A
confident, wrong, *grounded-looking* claim about work authorization or cleared ESMON detail is a
different failure.

**No hidden holdout.** A `deny` rule blocks the Read tool but not Bash, the same session writes the
harness, and the operator authoring the holdout is the operator tuning the thresholds. The
contamination it guards against is human. One honest visible set, declined-to-be-overfit, is worth
more than a firewall that does not hold. If it ever matters enough, do it properly: a private
repository fetched only by a GitHub Actions job holding a secret the local environment lacks.

### Dimensions

| Dimension | Method | Gate |
|---|---|---|
| Refusal accuracy | deterministic, from `outcome` | **false-answer rate = 0** |
| Verbatim fidelity | deterministic string containment | **100%** |
| Model-never-called | mocked SDK, refusal strata | **0 invocations** |
| Citation validity | deterministic route existence, judged containment | 100% exist |
| Length and style | deterministic regex | 100% |
| Grounding fidelity | LLM judge, answer vs retrieved | no unsupported assertions |
| Voice | LLM judge against `exemplars.md`, plus hand reading | scored |

### Harness

`npm run eval` calls `askOnce()` directly against a Neon branch database, writes per-item results
to `evals/results/<timestamp>-<ASK_VERSION>.json`, and prints the summary. Runs are keyed by
`ASK_VERSION` and `corpus_hash`.

Run the set against Sonnet with a bio and no retrieval first, as a floor. Every later number is a
delta rather than an assertion.

**A test runner must be added first.** `package.json` has none: no vitest, no Playwright.

## Phases

Ordered so that nothing verifies code that does not exist yet.

0. **Test runner and eval set.** vitest, Playwright, ~50 questions with corpus-independent labels
   only, judges, naive baseline. *Verify:* runner executes in CI; baseline numbers exist.
1. **Corpus pipeline.** Neon, schema, the fourteen corpus files, ingest, `corpus_meta`. Backfill
   the corpus-dependent eval labels. *Verify:* running ingest twice produces identical row counts;
   deleting a corpus file removes its rows; a mismatched `embed_model` 503s.
2. **`askOnce()` and grounding.** Retrieval, query rewrite, grading, verbatim path, refusal copy,
   threshold tuning. *Verify:* every eval verdict matches; the mocked-SDK test shows zero model
   invocations on refusal strata.
3. **Route, streaming, history.** AI SDK data parts, `/api/ask`, turn logging with cost, last-3
   history, environment guard. *Verify:* part ordering; a client disconnect aborts upstream and
   still writes a turn; a follow-up question resolves against the previous turn.
4. **FAB UI.** `useChat`, trace toggle, citations, refusal block, mobile sheet.
   *Verify:* Playwright over answer, weak-refusal, and rate-limit paths.
5. **Gate and abuse controls.** Google OAuth client, sign-in, `/api/ask/identify` with nonce, iss,
   aud, email_verified, Origin, `users` upsert, BotID, Upstash limits, spend reservation with
   expiry cron. *Verify:* forged, replayed, and wrong-`aud` tokens rejected; per-user limits bind
   after clearing cookies; a killed stream releases its reservation within 60s; concurrent
   requests cannot both pass the cap.
6. **Gap queue and Resend.** Capture, gap endpoint with ownership check, plain-text notification,
   GET-interstitial then POST exchange, answer page, publish confirmation, inline embed, digest.
   *Verify:* tampered, expired, reused, and scanner-prefetched links behave correctly; publishing
   makes the answer retrievable with no deploy.
7. **`/asked`, privacy, retention.** Public page, counters, `/privacy`, retention job with
   injectable clock. *Verify:* the job nulls content at 90 days.
8. **Launch gate.** Full eval run. Ship only if false-answer rate is 0, verbatim fidelity is 100%,
   and model-never-called is 0.

### Effort

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

## Risks

- **Hallucination about a real person.** Mitigated structurally: `generate()` is unreachable
  without a `StrongGrounding` value. Gated at launch on false-answer rate 0.
- **Paraphrased disclosure.** Handled by `verbatim_only`, gated at 100%.
- **The gate costs funnel.** Requiring Google before a second generated answer loses casual
  visitors and excludes anyone without a Google account. Refusals staying ungated limits the
  damage, since the differentiated behavior is still visible anonymously.
- **Google is a hard dependency** for anything past the first generated answer.
- **Cold start.** Sporadic traffic means most visitors pay Vercel plus Neon wake before the first
  token. Mitigated by an immediate status part, not eliminated.
- **Thin corpus at launch.** Refusal rate starts high. Honest rather than broken, and the gap queue
  is the mechanism that fixes it.
- **Corpus drift.** No automated check; case studies and corpus files can disagree until noticed.
- **Gap queue depends on a human.** Unanswered questions make `/asked` a stale list of things
  ignored, which is worse than not having the page.
- **Spend cap as DoS.** An attacker exhausting the global cap makes the agent say "hit my daily
  budget", which reads as broken. Per-user caps limit blast radius but do not remove it.
- **Six vendors.** Neon, Anthropic, Voyage, Upstash, Resend, Google.
