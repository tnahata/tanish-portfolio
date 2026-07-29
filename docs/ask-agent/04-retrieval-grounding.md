# 04 — Retrieval and grounding

← [Index](README.md) · Prev: [03 Data model](03-data-model.md) · Next: [05 Runtime](05-runtime.md)

**Decisions argued here**

| Decision | Rationale in one line |
|---|---|
| `askOnce()` is a pure function; the route is a thin wrapper | Evals call it directly: no HTTP server, no bot check, no production env |
| Follow-ups embed `previousQuestion + currentQuestion` | "What about the caching part?" embeds to noise alone |
| Only `strong` generates | Every corpus doc is about Tanish, so unanswerable questions still score mid-band |
| Answerability is judged by the model, at generation time | Cross-document corroboration measured false: single-author corpus, mismeasures topical adjacency as evidence. **Reversed**, see below and [README](README.md) |
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

Embed with `text-embedding-3-large` (truncated to 1024 dimensions; see
[02 Ingest](02-ingest.md#embedding-provider)), exact cosine scan over `chunks`, take top 8, then
grade.

## The grounding ladder

| Verdict | Condition | Behavior |
|---|---|---|
| `strong` | top ≥ T_STRONG | generate, and let the model judge answerability (see below) |
| `weak` | top ≥ T_FLOOR | refuse, name the closest source, offer capture |
| `none` | below T_FLOOR | refuse as off-task, no capture |

**Only `strong` generates.** Every corpus document is about Tanish, so a question about Tanish the
corpus cannot answer still scores in the middle band. That is ordinary embedding behavior for
topically-related-but-non-answering text, and letting it answer with a hedge would make it the
single most likely source of a confident wrong claim.

`strong` means **"worth generating over," not "answerable."** That distinction used to be
collapsed: see the reversal below for why, and for where the answerability judgment moved.

**Verbatim-only documents skip generation entirely.** When the top chunk belongs to a document
with `verbatim_only`, return the quoted chunk plus its citation instead of calling the model.
Clearance on `disclosure-esmon.md` was granted on *authored sentences*; paraphrasing produces new
sentences nobody cleared. Work authorization in `faq.md` gets the same treatment for the same
reason. There is no model in this path, so it never runs an answerability check either: a quoted
sentence is either the whole cleared document or nothing, and there is nothing for a model to
judge.

**The enforcement property: the generation model is never invoked without evidence.** Structural,
not conventional: `generate()` takes a branded `StrongGrounding` value that only the scorer can
construct. A test mocks the SDK and asserts zero invocations across every refusal stratum. This
property is unchanged by the reversal below: it governs *whether* `generate()` runs at all, not
what happens once it does.

`T_STRONG` and `T_FLOOR` are **TBD, set in Phase 2** against the eval set. A change of embedding
model invalidates both. Chunking's later move to LlamaIndex (see
[01 Corpus](01-corpus.md#chunking)) reproduced all 47 chunk hashes byte for byte, so it moved no
boundary and shifted no score; re-tuning is owed to the missing eval set, not to the parser change.

## Reversal: document corroboration removed, replaced by a model-judged answerability check

**This section used to read differently.** The original design required `strong` to clear not
just `T_STRONG` on the top chunk, but a second bar: at least 2 chunks scoring at or above a
`T_SUPPORT` threshold, drawn from at least 2 distinct documents. The reasoning was that a single
passage's ~100-token chunk overlap could otherwise satisfy "≥2 chunks" by counting one passage
twice, so corroboration was scoped to *documents*, not chunks. That rule is gone. It is recorded
here, not deleted, per this project's practice of keeping reversed decisions visible rather than
quietly rewriting history; see [README](README.md)'s decision register and rejected-alternatives
log for the settled-then-reversed entry.

**Why it was adopted.** Every corpus document is authored prose about one person, so a question
the corpus cannot answer still tends to retrieve *something* topically adjacent. A pure score
threshold on the top chunk alone had no way to distinguish "this single chunk is a strong,
specific match" from "this single chunk is a strong, generic match to a person-shaped corpus."
Requiring a second, independent document to also clear a support bar looked like a cheap way to
demand corroborating evidence rather than trusting one score.

**What measurement found.** Running the real `retrieve()` and `grade()` against the live index for
10 questions:

- Both off-task probes ("What is the capital of France?", top score 0.0960; "Write me a poem
  about cats", top score 0.1594) were already refused by `T_FLOOR` alone, with zero supporting
  chunks. The document-diversity check never even evaluated for either. It was not doing the work
  it was adopted for.
- The only verdict corroboration actually *changed* was "When can he start?": the top chunk
  scored 0.4171 against `faq :: Availability`, clearing `T_STRONG`, but both of its supporting
  chunks came from `faq`, so the corroboration check downgraded it to `weak` and refused. The
  corpus answers this question in one sentence. That is a false refusal caused by the rule, not
  prevented by it.
- The rule failed to block the two cases it exists to catch, because both had enough distinct
  documents: "Does Tanish need visa sponsorship?" graded `strong` with supporting documents
  `[identity, faq]`, but its top two chunks were `identity :: Where to find him` and `identity ::
  Name and current role`, neither of which answers the question. "What does he think about Rust?"
  graded `strong` across three documents, when the only whole-word occurrence of "Rust" in the
  entire corpus is the clause "He has not written Go or Rust" — the opposite of an opinion.

`identity.md` turned out to be a universal corroborator: 644 words of person-dense prose that
scores above the old support threshold for most personal questions, supplying a rubber-stamp
"second document" for sponsorship, work authorization, what-he-is-looking-for, and FedEx alike.
Corroboration across documents is only evidence when the sources are independent, and one person
wrote every document in this corpus. The corpus is also deliberately non-redundant by design (see
[01 Corpus](01-corpus.md)), so most facts live in exactly one file on purpose — which the
corroboration rule then structurally penalized. The rule was measuring topical adjacency, not
answerability.

**What replaced it.** Whether the retrieved passages actually answer the question is now judged
by the model itself, inside the same generation request that would otherwise produce the answer,
rather than by counting documents beforehand or running a second judge call afterward. A second
model round trip was considered and rejected: it roughly doubles cost for a question this project
already has real numbers on (a false-answer rate this design targets at zero; see
[11 Evaluation](11-evaluation.md)), for no accuracy gain the corroboration rule was not already
failing to buy.

**The mechanism.** `assemblePrompt()` (lib/ask/prompt.ts) generates a per-request, unforgeable
marker — `<unanswerable-TAG/>`, where `TAG` is the same `crypto.randomBytes`-derived tag that
scopes this request's `<ctx-TAG>`/`<q-TAG>` delimiters (see [06 Personality](06-personality.md))
— and instructs the model to reply with that marker alone, and nothing else, if the context does
not answer the question after actually reading it. `generate()` (lib/ask/generate.ts) parses the
raw response by exact string comparison against that marker, not a substring check and not an
inference over prose like "starts with 'I don't know'". A `null` answer from `generate()` means
the marker fired; `askOnce()` (lib/ask/ask.ts) turns that into the `refused_unanswerable` outcome.

**Why the marker can't be forged by retrieved content.** The corpus is authored, but not
permanently so in the sense that matters here: [09 Gap queue](09-gap-queue.md) publishes answered
gap questions back into the corpus at runtime, so a future published answer could legitimately
contain the word "unanswerable" in ordinary prose (for instance, an answer about how this very
agent handles unanswerable questions). A fixed-word marker would be forgeable by exactly that kind
of passage. Scoping the marker to a fresh random tag closes the hole: no content that existed
before the current request began, hand-authored or runtime-published, can contain this request's
tag. `assertNoForgedDelimiters()` additionally rejects any retrieved content already shaped like
`<unanswerable-...`, the same defense already applied to `<ctx-`/`<q-`, as a second layer against
a passage that merely mimics the marker's shape without knowing the live tag.

## Refusal taxonomy

| Outcome | Trigger | Capture offered? |
|---|---|---|
| `refused_no_grounding` | grounding `weak`: top score below `T_STRONG` | **Yes** |
| `refused_unanswerable` | grounding `strong`, but the model judges the context does not answer | **Yes** |
| `refused_off_task` | grounding `none` | No |
| `refused_injection` | pattern list, before retrieval | No, logged |
| `refused_private` | pattern list, before retrieval | No |
| `refused_budget` | spend cap reached | No |

`weak` means the corpus is nearby but does not answer, which is exactly a content gap worth
capturing. `refused_unanswerable` is the same kind of gap, diagnosed later and more precisely: the
corpus had something close enough to generate over, and the model, having actually read it, still
could not answer. Both are eligible for gap-queue capture and are kept as distinct outcomes rather
than merged, because they are found by different mechanisms (a score threshold vs. a model
judgment) and merging them would make the difference invisible if one path starts firing a lot
more than the other. `none` means nothing in the corpus is close, which is off-task.

The private and injection pattern lists are UX, not controls: base64, homoglyphs, and other
languages walk through them. The real defenses are the prompt delimiting in
[06 Personality](06-personality.md) and the fact that the model has no tools.

Refusal copy lives in `lib/ask/refusals.ts` and never enters a prompt. See
[06 Personality](06-personality.md).
