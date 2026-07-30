# 06 — Evaluation and delivery

← [Index](README.md) · Prev: [05 Voice and UI](05-voice-and-ui.md)

## Eval set

**Questions are written before the corpus exists**, from the visitor's side; written afterwards,
they only ask what the corpus already answers. Labels are assigned in two passes: should-answer /
must-refuse plus off-task / private / injection up front; citation target, multi-hop, and
thin-coverage after the corpus exists and thresholds are set. No strata quotas up front either —
fixing "10% multi-hop" before the questions exist guarantees a reshuffle.

~50 questions, with absolute minimums per gated stratum rather than percentages (a 4% stratum of
50 is two items, not a gate):

| Stratum | Minimum | Expected |
|---|---|---|
| Unanswerable, fair | 12 | refuse `weak`, offer capture |
| Off-task | 6 | refuse `none`, no capture |
| Private | 5 | hard refuse |
| Injection | 8 | refuse, hold voice |
| Answerable | remainder | answer, cite correctly |

**No hidden holdout.** The contamination it guards against is human: the same operator authors the
harness and tunes the thresholds. One honest, visible set is worth more than a firewall that
doesn't hold.

| Dimension | Method | Gate |
|---|---|---|
| Refusal accuracy | deterministic, from `payload.reason` on the logged `refused` event ([03](03-data-model.md)) | false-answer rate = 0 |
| Model-never-called | mocked SDK, refusal strata | 0 invocations |
| Citation validity | deterministic route existence | 100% exist |
| Length and style | deterministic regex | 100% |
| Grounding fidelity | LLM judge, answer vs. retrieved | no unsupported assertions |
| Voice | LLM judge against exemplars, plus hand reading | scored |

## Harness

`npm run eval` calls `askOnce()` directly against a database branch, writes per-item results, and
prints a summary. Run the set against a bare model with no retrieval first, as a floor: every later
number is a delta against that, not a bare assertion. The eval set and harness already exist and
are implementation-independent, so this rewrite doesn't invalidate them — they're the one artifact
that survives a design change intact.

## Delivery phases

Ordered so nothing verifies code that doesn't exist yet, and so the one irreplaceable asset — the
corpus itself, ~12,000 words of authored prose — gets written as early as the eval set that grades
it.

0. **Eval set and harness.** Already built; stays first. Confirm they still run against the new
   four-table schema before anything else changes.
1. **Corpus.** The long pole. Everything else here is a rewrite of code around content that
   already has to exist; the corpus does not get faster to write by simplifying the schema.
2. **Data model and ingest.** Four tables, reconcile-not-rebuild, empty-corpus guard.
   → [01](01-corpus.md), [03](03-data-model.md)
3. **Retrieval and grounding.** `askOnce()`, the ladder, thresholds tuned against the eval set.
   → [02](02-retrieval.md)
4. **Route and auth.** Clerk, the route order, per-user rate limiting, streaming, audit log.
   → [04](04-runtime.md)
5. **Voice and panel.** Prompt assembly, refusal copy, the chat UI.
   → [05](05-voice-and-ui.md)
6. **Launch gate.** Full eval run. Ship only if the false-answer rate is 0 and
   model-never-called is 0 on every refusal stratum.
