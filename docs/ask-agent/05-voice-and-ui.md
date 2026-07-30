# 05 — Voice, prompt assembly, chat panel

← [Index](README.md) · Prev: [04 Runtime](04-runtime.md) · Next: [06 Evaluation](06-evaluation.md)

## Voice

A colleague who worked next to Tanish, not a publicist. It volunteers what broke, says "he hasn't
done that" without softening, and answers in three sentences when that is the answer. This is what
personality means here: it decides what the agent says when the honest answer is unflattering,
which is the only moment personality is visible.

Constraints:

- Answer in the first sentence. No restating the question, no "great question".
- ≤120 words. Under 40 when the answer is short.
- No em-dashes, no hedging stacks: say it or say you do not know.
- No emoji, exclamation marks, or roleplay stage directions.
- Quantify when the corpus quantifies ("8+ seconds to under 2", not "significantly faster").
- **Answer from the current context, never from an earlier answer in this conversation.** Two old
  answers can otherwise be combined into a new claim with no new evidence behind it.

## Prompt assembly

```ts
const tag = randomTag();   // per request, see 02-retrieval.md
system: [{ type: 'text', text: system + constraints + exemplars }],
messages: [
  ...history,                // full conversation, evicted oldest-first past a token budget
  { role: 'user',
    content: `<ctx-${tag} trust="none">${chunks}</ctx-${tag}>\n`
           + `<q-${tag}>${question}</q-${tag}>` },
]
```

Both tags are randomized per request; a fixed marker is forgeable by a question containing that
literal string. Input matching `/<\/?(ctx|q)-/i` is rejected outright. All exemplars are answers —
none demonstrate refusals, since refusal and hedge paths never reach the model at all (only
`strong` grounding generates; see [02](02-retrieval.md)).

**`ASK_VERSION` — a content hash over prompts, copy, and thresholds — is gone.** It existed to
version user-visible output across changes. On a site with one author who knows what he just
changed, a hash buys nothing a commit message doesn't already give.

Refused turns are kept in conversation history: "why can't you answer that?" is a real follow-up,
and dropping refusals makes the transcript incoherent. Grounding is still graded fresh on every
turn; history never substitutes for retrieval.

## Refusal copy

A few variants per refusal reason, selected by hashing the question so the same question always
yields the same line. Deterministic reads as consistent; random reads as a slot machine. Topic is
templated in with no model call:

> "Not something he's written about (Kubernetes). Want me to ask him?"

## The chat panel

Fixed bottom-right FAB, all pages, identical everywhere (no per-page context awareness in this
version). Expanded panel shows the answer, sources as citation pills linking to `route`, and a
trace toggle for the streamed status/source/verdict parts.

- Refusals render as a distinct block, not an error — refusal is intended behavior, not a failure
  state.
- The sign-in interstitial appears inline, before the second turn, with the pending question held
  and replayed after sign-in completes. See [04-runtime.md](04-runtime.md).
- Respects `prefers-reduced-motion`. Focus trap, Esc closes, WCAG AA contrast.

Starter chips (verified against the eval set before shipping, since they're the questions every
visitor is most likely to actually ask):

1. "What broke while building ESMON?"
2. "How does Discovery Agent keep a human in the loop?"
3. "What's he like to work with?"

No refusal chip: refusal is good to encounter, not to advertise on arrival.
