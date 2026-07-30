# Ask Agent — Spec Index

A grounded chat agent for tanishnahata.com. Answers only from a curated corpus (~12,000 words),
shows its retrieval work, refuses out-of-scope questions with a visible reason, and surfaces what it
cannot answer as a gap for the corpus to close later; publishing an answer means running ingest, not
a runtime write.

Rewritten 2026-07-29, down from a 17-file, 2,482-line spec to this 7-file target: that spec argued
every decision before any code existed, and the 5,582 lines of code it produced for a 12,000-word
corpus is the signal to cut back. Git history holds the old files, including `CORPUS-AUDIT.md`,
whose findings depended on a grading rule this rewrite removes.

## Goals and non-goals

Answer only from the approved corpus; real multi-turn chat with history; stream tokens (perceived
latency matters more than total latency); refuse cleanly and visibly with the reason exposed;
attribute every generated answer and every dollar to a verified person.

Not in scope: per-page context awareness, first-person voice, reading repository source at
runtime, tool use of any kind.

## Read in this order

| # | File | Answers |
|---|---|---|
| 01 | [corpus.md](01-corpus.md) | File format, frontmatter, chunking, ingest |
| 02 | [retrieval.md](02-retrieval.md) | Embedding, retrieval, grounding ladder, thresholds |
| 03 | [data-model.md](03-data-model.md) | The four tables, and what replaced each deleted one |
| 04 | [runtime.md](04-runtime.md) | Route order, BotID, auth, rate limiting, streaming, audit log |
| 05 | [voice-and-ui.md](05-voice-and-ui.md) | Personality, prompt assembly, refusal copy, the chat panel |
| 06 | [evaluation.md](06-evaluation.md) | Eval set, harness, delivery phases |

## Decision register

| Decision | Where | Status |
|---|---|---|
| Authored prose only; repository source never ingested | [01](01-corpus.md) | settled |
| `route: null` when no page exists to cite | [01](01-corpus.md) | settled |
| Citations link to a route, never a fragment | [01](01-corpus.md) | settled |
| No automated corpus/page drift check | [01](01-corpus.md) | accepted risk |
| One chunk per `##` section; no packing, no overlap, no token targets | [01](01-corpus.md) | settled |
| Reconcile-not-rebuild ingest, one transaction | [01](01-corpus.md) | settled |
| Only ingest writes to `documents` and `chunks`; the delete sweep is unscoped | [01](01-corpus.md), [03](03-data-model.md) | settled |
| Ingest refuses to run against an empty desired corpus | [01](01-corpus.md) | settled |
| Model change forces a full re-embed and a threshold re-tune | [01](01-corpus.md) | settled |
| Only `strong` grounding generates | [02](02-retrieval.md) | settled |
| Answerability judged by the model, at generation time, via an unforgeable marker | [02](02-retrieval.md) | settled |
| Branded `StrongGrounding` value gates `generate()` | [02](02-retrieval.md) | settled |
| Injection/private pre-filter runs before retrieval, not after grading | [02](02-retrieval.md) | **reversed**, found defect |
| `T_STRONG = 0.40`, `T_FLOOR = 0.25` | [02](02-retrieval.md) | provisional |
| Four tables, no second datastore | [03](03-data-model.md) | settled |
| No HNSW index; exact scan | [03](03-data-model.md) | settled |
| `ask_events` is append-only; event is a closed enum | [03](03-data-model.md) | settled |
| Retrieved snapshot stored in the event payload, not chunk pointers | [03](03-data-model.md) | settled |
| Gaps are a query over `refused` events, not a table | [03](03-data-model.md) | settled |
| Clerk for auth, not hand-rolled, not Neon Auth | [04](04-runtime.md) | settled |
| Users upserted just-in-time, not by webhook | [04](04-runtime.md) | settled |
| Gate is on generation; embedding blocked until the gate passes | [04](04-runtime.md) | settled |
| Per-user rate limit is one `UPDATE` statement; free turn keyed on a clearable cookie | [04](04-runtime.md) | settled |
| BotID fails closed | [04](04-runtime.md) | settled |
| Voice is a colleague, not a publicist | [05](05-voice-and-ui.md) | settled |
| Refusal copy deterministic by question hash | [05](05-voice-and-ui.md) | settled |
| Sign-in interstitial inline, pending question held and replayed | [05](05-voice-and-ui.md) | settled |
| Eval set and harness are built first and survive a rewrite | [06](06-evaluation.md) | settled |
| No hidden holdout | [06](06-evaluation.md) | deliberate tradeoff |

## Deleted, and why (full reasoning at the pointer)

| Deleted | Where |
|---|---|
| `corpus_meta`, `sessions`, `turns`, `gap_questions` tables | [03](03-data-model.md) |
| `login_nonces`, `rate_counters`, `spend_reservations` tables | [03](03-data-model.md), [04](04-runtime.md) |
| `verbatimOnly` frontmatter/grading path | [02](02-retrieval.md) |
| `clearedOn` frontmatter | [01](01-corpus.md) |
| `ASK_VERSION` | [05](05-voice-and-ui.md) |
| Three-role database split (`owner` / `ask_ingest` / `ask_app`) | [03](03-data-model.md) |
| `TARGET_TOKENS`, `OVERLAP_TOKENS`, `SHORT_DOC_TARGET_TOKENS`, the packing loop, the overlap-tail function | [01](01-corpus.md) |
| Cross-document corroboration for `strong` | [02](02-retrieval.md) |

## Risks

| Risk | Mitigation |
|---|---|
| Hallucination about a real person | `generate()` unreachable without `StrongGrounding`; false-answer rate gates launch |
| Cold start | Immediate status part on handler entry; mitigated, not eliminated |
| Thin corpus at launch | Refusal rate starts high; honest rather than broken |
| Corpus drift (pages vs. corpus files) | None automated; manual review |
| Identity is a hard dependency past the first free turn | Accepted; refusals stay ungated so the differentiated behavior is still visible |
| Spend cap as DoS | Per-user daily limit bounds a signed-in user; BotID and a WAF per-IP rule blunt scripted/volumetric abuse; the Anthropic console cap is the hard ceiling underneath all of it |
| Anonymous free-turn cookie is clearable | Accepted; BotID and the spend cap are the real bound, not the cookie |

## Vendors

Postgres, Anthropic, OpenAI (embeddings), Clerk, Vercel (hosting, BotID). Five, down from six:
Resend and Google are gone as direct relationships (Google sits behind Clerk now; the
gap-notification flow they served is unspecified here, see [03](03-data-model.md)).
