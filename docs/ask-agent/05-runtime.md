# 05 — Framework, streaming, and history

← [Index](README.md) · Prev: [04 Retrieval and grounding](04-retrieval-grounding.md) · Next: [06 Personality](06-personality.md)

**Decisions argued here**

| Decision | Rationale in one line |
|---|---|
| Vercel AI SDK only, no second library now or later | The tool loop is already built in; adding a tool is an argument, not a dependency |
| Typed data parts carry the glass box | Beats a hand-rolled SSE contract |
| Status part written on handler entry, before any await | Cold start plus Neon wake costs 0.5 to 5 seconds before the first byte |
| Node runtime, `maxDuration = 30` | The request is database-heavy, so the function belongs near Neon |
| Full history under a 15k token budget | A fixed three-pair window truncates ordinary conversations for no benefit |
| Refused turns included in history | "Why can't you answer that?" is a real follow-up |
| History persisted per `users.id`, not per cookie | Resume on any device |
| Summarization on eviction deferred | Nothing in this product's shape reaches the budget |
| Input cap of 1,000 characters | Rejected before embedding |

---

## Framework

**Vercel AI SDK (`ai` + `@ai-sdk/anthropic`). No second library, now or later.**

The AI SDK has a full tool loop built in. `streamText` accepts `tools` and
`stopWhen: stepCountIs(n)`, appends each response to the conversation, executes tool calls, feeds
results back, and repeats until a text response or the step limit. AI SDK 6 packages the same
behavior as `ToolLoopAgent`. So adding a tool later is a `tools: { ... }` argument on the call
that already exists, not a new dependency.

v1 declares no tools, so the loop degenerates to a single completion. That is a property of this
agent's shape, not a limitation of the SDK.

Standalone agent harnesses (deepagents, and similar) add planning steps, subagents, and virtual
filesystems on top of that loop. Nothing here needs them.

The AI SDK also earns its place on the chat side, which is where the work actually is:

- `useChat` owns the client state machine: message list, streaming, loading, errors, input.
- **Typed data parts** carry the glass box instead of a hand-rolled SSE contract.
- **Transient parts** (`onData`) carry progress without polluting message history.
- **Same-ID reconciliation** updates one status part in place rather than appending noise.

## Streaming shape

```ts
// server
const stream = createUIMessageStream({
  execute: async ({ writer }) => {
    writer.write({ type: 'data-status', id: 'status',
                   data: { label: 'searching corpus' }, transient: true });
    const { chunks, verdict } = await retrieveAndGrade(q, history);
    for (const c of chunks) writer.write({ type: 'data-source', data: c });
    writer.write({ type: 'data-verdict', data: { grounding: verdict } });
    if (verdict !== 'strong') {
      writer.write({ type: 'data-refusal', data: refusalFor(verdict, chunks) });
      return;
    }
    writer.merge(streamText({ model, system, messages }).toUIMessageStream());
  },
});
```

The grounding gate sits before `streamText` and decides whether there is a call at all. Refusals
never reach the model.

**Write a status part on handler entry, before any await.** Vercel cold start plus Neon
scale-to-zero wake means a sporadic-traffic site pays 0.5 to 5 seconds before the first byte, and
`X-Accel-Buffering` is nginx-specific and a no-op on Vercel. An immediate first part forces the
flush and gives the panel something to render.

Runtime is Node, the App Router default, with `export const maxDuration = 30`. The request is
database-heavy, so the function belongs near Neon.

**Disconnect safety.** A Node serverless function keeps running for as long as it has pending
I/O (the in-flight generation call, then the turn-log write) independent of whether the client's
socket is still open, up to `maxDuration`. That is what lets `runAskTurn()`
(`lib/ask/stream.ts`) always log a turn once `askOnce()` produces a result, with no explicit
`waitUntil()` call: a disconnect skips further stream writes, never the log. This is a real,
load-bearing reason this route runs on Node rather than Edge, alongside the database-heavy
reasoning above. Data-part ordering (sources, then verdict, before any answer or refusal text) is
deterministic and covered by a test, since that ordering is the product's central claim.

**Generation model and cost.** `claude-sonnet-5` (`lib/ask/generate.ts`): grounded QA over an
already-scored context, a 120-word cap, and no tool use is well within Sonnet-tier capability, at
roughly a fifth of Opus's per-token cost. `turns.cost_usd` is priced off Sonnet 5's list rate ($3
/ $15 per million input/output tokens) rather than Anthropic's lower introductory pricing, so the
spend-cap accounting in [08 Abuse controls](08-abuse-controls.md) doesn't under-count real spend
once introductory pricing ends. Revisit both the model and the pricing constants if eval results
call for a different tier, or if Anthropic's pricing page changes.

**Input cap:** questions over 1,000 characters are rejected before embedding.

## Conversation history

**The full conversation is sent**, capped by a token budget rather than a turn count.

A question is roughly 30 tokens and a 120-word answer roughly 160, so a turn costs about 190.
Sixty turns, which is the entire per-user daily limit, is ~11k tokens against a 200k window. A
fixed three-pair window would truncate ordinary conversations for no benefit.

- Budget: **15k tokens of history**. Beyond it, evict oldest pairs first.
- Summarization on eviction is deferred. Nothing in this product's shape reaches the budget.
- Refused turns are included as history. "Why can't you answer that?" is a real follow-up, and
  dropping refusals makes the transcript incoherent.

**History is persisted and resumable.** `turns.conversation_id` groups a thread. An identified
visitor returning on any device resumes their most recent conversation, because the thread belongs
to `users.id`, not to a cookie. Anonymous visitors resume within their session only.

Prior answers are already grounded output, so including them is safe. One constraint in
`constraints.md` guards the remaining risk: **answer the current question from the current
context, never from what you said earlier.** Otherwise the model can synthesize a new claim by
combining two old answers without new evidence.

Grounding is graded fresh on every turn. History never substitutes for retrieval.
