# 11 — Evaluation

← [Index](README.md) · Prev: [10 UI](10-ui.md) · Next: [12 Delivery](12-delivery.md)

**Decisions argued here**

| Decision | Rationale in one line |
|---|---|
| Questions written before the corpus exists | Written afterwards, they only ask what the corpus already answers |
| Labels assigned in two passes | Most labels are properties of a corpus and thresholds that do not exist yet |
| No strata quotas in Phase 0 | Fixing "10% multi-hop" up front guarantees a reshuffle |
| ~50 questions with absolute minimums per stratum | A 4% stratum of 50 is two items, which is not a gate |
| A verbatim stratum on top of the unanswerable one | A grounded-looking wrong claim is a different failure than a false answer |
| No hidden holdout | The contamination it guards against is human |
| Harness calls `askOnce()` against a Neon branch | No HTTP server, no bot check, no production environment |
| Naive baseline run first | Every later number is a delta rather than an assertion |

---

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

## Dimensions

| Dimension | Method | Gate |
|---|---|---|
| Refusal accuracy | deterministic, from `outcome` | **false-answer rate = 0** |
| Verbatim fidelity | deterministic string containment | **100%** |
| Model-never-called | mocked SDK, refusal strata | **0 invocations** |
| Citation validity | deterministic route existence, judged containment | 100% exist |
| Length and style | deterministic regex | 100% |
| Grounding fidelity | LLM judge, answer vs retrieved | no unsupported assertions |
| Voice | LLM judge against `exemplars.md`, plus hand reading | scored |

## Harness

`npm run eval` calls `askOnce()` directly against a Neon branch database, writes per-item results
to `evals/results/<timestamp>-<ASK_VERSION>.json`, and prints the summary. Runs are keyed by
`ASK_VERSION` and `corpus_hash`.

Run the set against Sonnet with a bio and no retrieval first, as a floor. Every later number is a
delta rather than an assertion.

**A test runner must be added first.** `package.json` has none: no vitest, no Playwright.

Thresholds `T_STRONG`, `T_SUPPORT`, and `T_FLOOR` are tuned against this set in Phase 2. See
[04 Retrieval and grounding](04-retrieval-grounding.md).
