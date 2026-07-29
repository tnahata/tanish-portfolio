# 13: Risks

← [Index](README.md) · Prev: [12 Delivery](12-delivery.md) · Next: [14 Architecture](14-architecture.md)

| Risk | Mitigation | Detail |
|---|---|---|
| Hallucination about a real person | `generate()` unreachable without `StrongGrounding`; launch gate on false-answer rate 0 | [04](04-retrieval-grounding.md), [11](11-evaluation.md) |
| Paraphrased disclosure | `verbatim_only`, gated at 100% fidelity | [04](04-retrieval-grounding.md) |
| The gate costs funnel | Refusals stay ungated, so the differentiated behavior is visible anonymously | [07](07-identity-gate.md) |
| Google is a hard dependency past the first generated answer | None; accepted | [07](07-identity-gate.md) |
| Cold start | Immediate status part; mitigated, not eliminated | [05](05-runtime.md) |
| Thin corpus at launch | The gap queue is the mechanism that fixes it | [09](09-gap-queue.md) |
| Corpus drift | None automated; manual review | [01](01-corpus.md) |
| Gap queue depends on a human | None; accepted | [09](09-gap-queue.md) |
| Spend cap as DoS | Per-user caps limit blast radius but do not remove it | [08](08-abuse-controls.md) |
| Five vendors plus Vercel | None; accepted | [12](12-delivery.md) |
| Role split is unexecuted against a real database | Reasoned against documented Postgres semantics; a dry run on a disposable branch is still owed | [03](03-data-model.md), [12](12-delivery.md) |
| Work authorisation, availability, and compensation remain effectively single-sourced | `identity.md`'s "Current situation" fix restated location and education but only points at the FAQ for these three | [01](01-corpus.md), [11](11-evaluation.md) |
| Site says Discovery Agent, corpus says Noiseless | Deliberate, permanent; citations resolve to the unchanged route | [01](01-corpus.md) |
| Starter chip one ("What broke while building ESMON?") is thinly grounded | Corroborated mainly by one document; a launch-gate risk | [10](10-ui.md) |

---

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
- **Six vendors.** Neon, Anthropic, OpenAI, Resend, Google, Vercel. Upstash was cut by moving rate
  limits, nonces, and spend reservation into Postgres; see [08 Abuse controls](08-abuse-controls.md).
  The remaining five past Vercel are each load-bearing: no corpus without Neon, no answers without
  Anthropic, no retrieval without OpenAI, no gap loop without Resend, no identity without Google.
  OpenAI replaces what was originally Voyage; this consolidates the vendor list rather than
  expanding it, since Noiseless already uses OpenAI embeddings. See
  [03 Data model](03-data-model.md).
- **Postgres is now a single point of failure for limits as well as data.** Stated for completeness
  rather than as an exposure: the corpus lives there, so an outage already means no answers. There
  is no state in which the agent generates while its limiter is unavailable, which is the property
  the old fail-closed override on Upstash had to be configured to achieve.
- **The role split (`db/roles.sql`, three roles, the exact per-table grant matrix) has not been run
  against a real database.** It is reasoned carefully against documented Postgres semantics and
  covered by unit tests, but every one of those tests runs against a fake `pg.Client`, never a live
  Neon connection. The apply-order logic in particular (schema-first vs. roles-first, the
  `alter default privileges` baseline, the per-table convergence loop) has real branches that only
  a live run exercises. One dry run against a disposable Neon branch, checked with `\dp` or
  `information_schema.role_table_grants`, is still owed before this is trusted in production. See
  [03 Data model](03-data-model.md), [12 Delivery](12-delivery.md).
- **Work authorisation, availability, and compensation are effectively still single-sourced**, even
  after `identity.md` gained a "Current situation" section to address `CORPUS-AUDIT.md`'s finding
  that all five facts (work authorisation, location, availability, compensation, education) lived
  in `faq.md` alone. That fix restated two of the five, location and education, as real second
  statements in `identity.md`. For the other three, `identity.md` only points at the FAQ ("are
  covered in the FAQ", "are answered in the FAQ") rather than restating the answer, and a pointer
  sentence is not a second, independent statement of the fact even if it shares enough vocabulary
  to pass a naive two-chunk check. A recruiter asking "does he need sponsorship", "what's his
  availability", or "what does he charge" may still score `weak` and refuse. `agent-boundaries.md`
  separately mentions compensation as a boundary the agent will not cross, which may or may not
  count as genuine corroboration for that one fact; this is unresolved and worth an explicit
  eval-set check before Phase 2 threshold tuning, not an assumption in either direction. See
  [01 Corpus](01-corpus.md), [11 Evaluation](11-evaluation.md).
- **The site names this project Discovery Agent; the corpus names it Noiseless.** `route:
  /projects/discovery-agent` and `id: project-discovery-agent` are deliberately unchanged in both
  `project-discovery-agent.md` and `disclosure-discovery-agent.md`, since the live page still lives
  at that route and every citation the agent emits has to resolve. Renaming the live site is
  explicitly out of scope for this work. A visitor who reads the page and then asks the agent about
  "Discovery Agent" will get an answer that calls the same project "Noiseless," which is correct but
  reads as a mismatch on first encounter. See [01 Corpus](01-corpus.md).
- **Starter chip one is the thinnest-grounded of the three.** "What broke while building ESMON?" is
  corroborated mainly by `project-esmon.md` alone; `philosophy.md` corroborates with one paragraph
  retelling the same filter-context bug, against a whole document's worth of weight sitting on
  `project-esmon.md`. It clears the two-distinct-document bar, but by less margin than either of
  the other two chips. Flagged in [10 UI](10-ui.md) as worth a specific eval-set check before
  shipping, since a starter chip regression is the most visible possible failure: it is the
  question a visitor is most likely to actually ask.

## Open contradictions found while splitting

Not risks in the original draft. Places where two sections disagree and one has to win.

1. **History window.** [05 Runtime](05-runtime.md) specifies the full conversation under a 15k
   token budget. The assembly snippet in [06 Personality](06-personality.md) sends `...last3Pairs`.
   Phase 3 in [12 Delivery](12-delivery.md) says "last-3 history". Resolve before Phase 3.
2. ~~**Free-generation counter store.**~~ Resolved by dropping Upstash. The counter is the
   `ip:<prefix_hash>:gen` bucket in `rate_counters`, and the daily salt rotation means it grants one
   free generation per IP prefix **per day**, not one ever. See
   [07 Identity and the gate](07-identity-gate.md).
3. **Table count.** The original draft said "six tables" while listing seven. Now ten, stated in
   [03 Data model](03-data-model.md). Noted only because the number appeared in three places.
