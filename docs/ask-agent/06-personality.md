# 06 — Personality and prompts

← [Index](README.md) · Prev: [05 Runtime](05-runtime.md) · Next: [07 Identity and the gate](07-identity-gate.md)

**Decisions argued here**

| Decision | Rationale in one line |
|---|---|
| Voice is a colleague, not a publicist | Only visible when the honest answer is unflattering |
| `ASK_VERSION` hashes prompts, refusal copy, and thresholds | Refusal copy is user-visible output and needs the same version hygiene |
| Randomized per-request delimiter tags | A fixed `</question>` marker is forgeable by the question text |
| No `cache_control` | The 5 minute ephemeral cache expires between sporadic visits, so only the write premium is paid |
| All twelve exemplars are answers | Refusal and hedge paths never reach the model |
| Refusal copy is deterministic by question hash | Deterministic reads as consistent; random reads as a slot machine |
| Voice verified by hand reading, keyed by `ASK_VERSION` | Nothing else detects it |

> **Open contradiction to resolve:** the assembly snippet below sends `...last3Pairs`, while
> [05 Runtime](05-runtime.md) specifies the full conversation under a 15k token budget and
> [12 Delivery](12-delivery.md) Phase 3 says "last-3 history". Pick one before Phase 3.

---

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

## Assembly

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
those paths never reach the model. See [04 Retrieval and grounding](04-retrieval-grounding.md).

## Constraints

- Answer in the first sentence. No restating the question, no "great question".
- ≤120 words. Under 40 when the answer is short.
- No em-dashes.
- No hedging stacks. Say it or say you do not know.
- No emoji, exclamation marks, or roleplay stage directions.
- Quantify when the corpus quantifies: "8+ seconds to under 2", not "significantly faster".
- Name the tradeoff, do not sell the outcome.
- **Answer from the current context, never from an earlier answer in this conversation.**

## Refusal copy

In `lib/ask/refusals.ts`, three or four variants per bucket, selected by hashing the question so
the same question always yields the same line. Deterministic reads as consistent; random reads as
a slot machine. Topic is templated in deterministically, with no model call:

> "Not something he's written about (Kubernetes). Want me to ask him?"

## Verifying voice

Only detectable by reading. Every eval answer is read by hand before launch and after any prompt
edit, keyed by `ASK_VERSION`. See [11 Evaluation](11-evaluation.md).
