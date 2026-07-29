# 04 — Retrieval and grounding

← [Index](README.md) · Prev: [03 Data model](03-data-model.md) · Next: [05 Runtime](05-runtime.md)

**Decisions argued here**

| Decision | Rationale in one line |
|---|---|
| `askOnce()` is a pure function; the route is a thin wrapper | Evals call it directly: no HTTP server, no bot check, no production env |
| Follow-ups embed `previousQuestion + currentQuestion` | "What about the caching part?" embeds to noise alone |
| Only `strong` generates | Every corpus doc is about Tanish, so unanswerable questions still score mid-band |
| Corroboration needs two distinct documents | ~100 token overlap makes "≥2 chunks" satisfiable by one passage |
| Verbatim-only docs bypass the model | Clearance was granted on authored sentences, not paraphrases |
| Branded `StrongGrounding` value gates `generate()` | Structural enforcement, not convention |
| Threshold values | **TBD, set in Phase 2 against the eval set** |
| Injection and private pattern lists are UX, not controls | Base64, homoglyphs, other languages walk through them |

---

`askOnce(question, history)` is a **pure function**: retrieve, grade, generate or refuse. The
route is a thin streaming wrapper over it. Evals call it directly, so they need no HTTP server, no
bot check, and no production environment. See [11 Evaluation](11-evaluation.md).

**Query construction.** When the previous turn was `answered`, embed
`previousQuestion + ' ' + currentQuestion`. A follow-up like "what about the caching part?"
embeds to noise on its own. No extra model call, and it handles anaphora.

Embed with `voyage-3.5-lite`, exact cosine scan over `chunks`, take top 8, then grade.

## The grounding ladder

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

`T_STRONG`, `T_SUPPORT`, `T_FLOOR` are **TBD, set in Phase 2** against the eval set. A change of
embedding model invalidates all three. See [02 Ingest](02-ingest.md).

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
languages walk through them. The real defenses are the prompt delimiting in
[06 Personality](06-personality.md) and the fact that the model has no tools.

Refusal copy lives in `lib/ask/refusals.ts` and never enters a prompt. See
[06 Personality](06-personality.md).
