# 13 — Risks

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
- **Six vendors.** Neon, Anthropic, Voyage, Resend, Google, Vercel. Upstash was cut by moving rate
  limits, nonces, and spend reservation into Postgres; see [08 Abuse controls](08-abuse-controls.md).
  The remaining five past Vercel are each load-bearing: no corpus without Neon, no answers without
  Anthropic, no retrieval without Voyage, no gap loop without Resend, no identity without Google.
- **Postgres is now a single point of failure for limits as well as data.** Stated for completeness
  rather than as an exposure: the corpus lives there, so an outage already means no answers. There
  is no state in which the agent generates while its limiter is unavailable, which is the property
  the old fail-closed override on Upstash had to be configured to achieve.

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
