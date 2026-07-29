# Ask Agent — Spec Index

A grounded chat agent for tanishnahata.com. Answers only from a curated corpus, shows its
retrieval work live, refuses out-of-scope questions with a visible reason, and turns the
questions it cannot answer into a public backlog.

Split out of the single-file draft at `docs/ask-agent-spec.md`. That file is deprecated: this split
set is the source of record. The draft is kept only for history and is not maintained further.

## Read in this order

| # | File | Answers |
|---|---|---|
| 00 | [overview.md](00-overview.md) | What it is, why it is not a generic portfolio bot, goals, non-goals |
| 01 | [corpus.md](01-corpus.md) | What the agent is allowed to know, manifest, frontmatter, chunking |
| 02 | [ingest.md](02-ingest.md) | Embedding lifecycle, reconcile-not-rebuild, staleness detection |
| 03 | [data-model.md](03-data-model.md) | Postgres schema and why each table is shaped that way |
| 04 | [retrieval-grounding.md](04-retrieval-grounding.md) | `askOnce()`, the grounding ladder, verbatim path, refusal taxonomy |
| 05 | [runtime.md](05-runtime.md) | AI SDK, streaming, data parts, conversation history, route config |
| 06 | [personality.md](06-personality.md) | Voice, prompt assembly, constraints, refusal copy |
| 07 | [identity-gate.md](07-identity-gate.md) | Gate on generation, Google sign-in mechanics, environments, privacy |
| 08 | [abuse-controls.md](08-abuse-controls.md) | BotID, Postgres rate counters, spend reservation |
| 09 | [gap-queue.md](09-gap-queue.md) | Capture, admin capability links, `/asked` |
| 10 | [ui.md](10-ui.md) | FAB, panel, starter chips |
| 11 | [evaluation.md](11-evaluation.md) | Eval set design, strata, dimensions, harness |
| 12 | [delivery.md](12-delivery.md) | Phases, effort, environment variables |
| 13 | [risks.md](13-risks.md) | Open risks and what each is mitigated by |
| 14 | [architecture.md](14-architecture.md) | Diagrams: request lifecycle, grading, content loop, components |

New to this? Read [00 Overview](00-overview.md), then [14 Architecture](14-architecture.md), then
the decision register below.

## Decision register

Every non-obvious call, with the file that argues it. Review this table first; open a file when a
row looks wrong.

| Decision | Where | Status |
|---|---|---|
| Authored prose only, repository source never ingested | [01](01-corpus.md) | settled |
| Fourteen corpus files plus blog posts | [01](01-corpus.md) | settled |
| Citations link to a route, never a fragment | [01](01-corpus.md) | settled |
| No automated corpus/page drift check | [01](01-corpus.md) | accepted risk |
| `clearedOn` required on every disclosure file, ingest refuses without it | [01](01-corpus.md) | settled |
| Ingest is a reconcile against a declared desired state | [02](02-ingest.md) | settled |
| Embeddings stored inline on the chunk row, no separate vector store | [02](02-ingest.md) | settled |
| Chunk identity is `(document_id, ordinal)`, not a content hash | [02](02-ingest.md) | settled |
| Model change forces a full re-embed and a threshold re-tune | [02](02-ingest.md) | settled |
| Ten tables in one Postgres; no second datastore | [03](03-data-model.md) | settled |
| Vendor list is Neon, Anthropic, Voyage, Resend, Google, Vercel | [03](03-data-model.md), [13](13-risks.md) | settled |
| One row per turn, not per message | [03](03-data-model.md) | settled |
| `turns.retrieved` is a snapshot, not a pointer | [03](03-data-model.md) | settled |
| `users` separate from `sessions`; identity is the principal | [03](03-data-model.md) | settled |
| No HNSW index; exact scan over ~150 vectors | [03](03-data-model.md) | settled |
| Only `strong` grounding generates | [04](04-retrieval-grounding.md) | settled |
| Corroboration requires two distinct documents | [04](04-retrieval-grounding.md) | settled |
| Verbatim-only documents skip generation entirely | [04](04-retrieval-grounding.md) | settled |
| `generate()` gated structurally by a branded `StrongGrounding` value | [04](04-retrieval-grounding.md) | settled |
| `T_STRONG` / `T_SUPPORT` / `T_FLOOR` values | [04](04-retrieval-grounding.md) | **TBD, Phase 2** |
| Vercel AI SDK only, no second agent framework | [05](05-runtime.md) | settled |
| Full history sent under a 15k token budget, not a turn window | [05](05-runtime.md) | settled |
| Refused turns kept in history | [05](05-runtime.md) | settled |
| No `cache_control` on the system prompt | [06](06-personality.md) | settled |
| All twelve exemplars are answers, none are refusals | [06](06-personality.md) | settled |
| Refusal copy selected deterministically by hashing the question | [06](06-personality.md) | settled |
| Gate on generation, not on message count | [07](07-identity-gate.md) | settled |
| First generated answer free, per IP prefix (/32, /56), per day | [07](07-identity-gate.md) | settled |
| Nonce is a row, single-used by `delete … returning` | [07](07-identity-gate.md) | settled |
| Google button, not One Tap | [07](07-identity-gate.md) | settled |
| Production guard on `VERCEL_ENV` plus `Host`, never `NODE_ENV` | [07](07-identity-gate.md) | settled |
| Deletion by email request, no self-serve endpoint | [07](07-identity-gate.md) | settled |
| BotID fails closed and runs at the edge, before Postgres | [08](08-abuse-controls.md) | settled |
| Fixed-window rate counters, one atomic upsert per check | [08](08-abuse-controls.md) | settled |
| Reservations expire by predicate, so no sweep cron exists | [08](08-abuse-controls.md) | settled |
| Cap check serialized by `pg_advisory_xact_lock` | [08](08-abuse-controls.md) | settled |
| Publish the answer only, never the question text | [09](09-gap-queue.md) | settled |
| GET interstitial then POST exchange for admin capability links | [09](09-gap-queue.md) | settled |
| Publish the refusal rate on `/asked` | [09](09-gap-queue.md) | settled |
| Eval questions written before the corpus exists | [11](11-evaluation.md) | settled |
| Labels assigned in two passes, no strata quotas up front | [11](11-evaluation.md) | settled |
| No hidden holdout | [11](11-evaluation.md) | deliberate tradeoff |
| Launch gated on false-answer rate 0 and verbatim fidelity 100% | [11](11-evaluation.md) | settled |
