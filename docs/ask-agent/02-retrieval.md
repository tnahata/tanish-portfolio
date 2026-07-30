# 02 — Embedding, retrieval, grounding

← [Index](README.md) · Prev: [01 Corpus](01-corpus.md) · Next: [03 Data model](03-data-model.md)

`askOnce(question, history)` is a pure function: retrieve, grade, generate or refuse. The route is
a thin streaming wrapper over it, so evals call it directly with no HTTP server and no bot check.

## Embedding and retrieval

Embed with OpenAI `text-embedding-3-large` at `dimensions: 1024`. When the previous turn was
answered, embed `previousQuestion + ' ' + currentQuestion`: a follow-up like "what about the
caching part?" embeds to noise on its own, and this needs no extra model call.

Cosine distance via pgvector `<=>`, exact scan (no HNSW index — faster and more accurate than an
approximate index over ~50 vectors), top 8, joined to `documents`.

## The grounding ladder

| Verdict | Condition | Behavior |
|---|---|---|
| `strong` | top ≥ `T_STRONG` | generate, model judges answerability |
| `weak` | top ≥ `T_FLOOR` | refuse, name the closest source, offer capture |
| `none` | below `T_FLOOR` | refuse as off-task, no capture |

`T_STRONG = 0.40`, `T_FLOOR = 0.25`. Both measured against the live index and both still
provisional until the eval set is filled in. Off-task questions top out at 0.0960; the tightest
genuine on-task question ("When can he start?") peaks at 0.4171.

**Only `strong` generates.** Every corpus document is about the same person, so a question the
corpus cannot answer still scores in the middle band — ordinary embedding behavior for
topically-related-but-non-answering text. Letting that band answer with a hedge would make it the
single most likely source of a confident wrong claim.

**Answerability is judged by the model, at generation time**, not by counting corroborating
documents beforehand. `strong` means "worth generating over," not "answerable." The prompt
instructs the model to emit an unanswerable marker alone, and nothing else, if the retrieved
passages do not answer the question after actually reading them. Parsing is exact string equality
on the trimmed response, not a substring check and not an inference over prose.

The marker is built from a per-request random tag, the same one that scopes this request's context
and question delimiters, so content authored before the request — including a published gap
answer that happens to discuss how this agent handles unanswerable questions — cannot forge it.
Any retrieved content already shaped like the marker is also rejected as a forgery attempt.

**`generate()` is unreachable without evidence.** Structural, not conventional: it takes a branded
`StrongGrounding` value that only the scorer can construct — a non-exported `unique symbol`, about
ten lines, and refusal becomes structural rather than instructed.

## Reversal: cross-document corroboration, removed

The original design required `strong` to also clear a second bar: at least two chunks from at
least two distinct documents. Adopted because a pure top-score threshold couldn't tell "a specific
match" from "a generic match to a person-shaped corpus." Reversed after running retrieval and
grading against the live index on real questions:

- Both off-task probes were already refused by `T_FLOOR` alone, zero supporting chunks. The
  diversity check never even evaluated for either — it wasn't doing the work it was adopted for.
- The only verdict it changed was a false refusal: "When can he start?" cleared `T_STRONG` at
  0.4171, but both supporting chunks came from the same document, so the rule downgraded it to
  `weak` and refused a question the corpus answers in one sentence.
- It failed to block what it exists to catch: a sponsorship question graded `strong` across two
  documents whose top two chunks answered nothing.

`identity.md`, 644 words of person-dense prose, acted as a universal corroborator for almost any
personal question. Corroboration across documents is only evidence when the sources are
independent, and one person wrote every document in this corpus.

## The pattern pre-filter moved earlier

Injection and private-pattern checks now run at the top of the request, before retrieval — refuse,
still no embedding call. They were previously downstream of scoring. A real eval run found the
consequence: an off-task question at 0.4048 and an injection at 0.4640 both cleared `T_STRONG` on
similarity alone and reached generation. Two refusal outcomes existed with nothing ever emitting
them. Found-and-fixed design defect, not a hypothetical.

The pattern lists are still UX, not a control: base64, homoglyphs, and other languages walk
through them. The real defenses are prompt delimiting (see [05](05-voice-and-ui.md)) and the fact
that the model has no tools.
