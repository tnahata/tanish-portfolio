# 00 — Overview

← [Index](README.md) · Next: [01 Corpus](01-corpus.md)

A grounded chat agent for tanishnahata.com. Answers only from a curated corpus, shows its
retrieval work live, refuses out-of-scope questions with a visible reason, and turns the
questions it cannot answer into a public backlog.

## Why this instead of a generic portfolio bot

The core loop is deliberately boring: retrieve, grade, generate or refuse. Differentiation lives
in three places, none of them in the loop.

1. **Personality.** A colleague who worked next to Tanish, not a publicist. It volunteers what
   broke. See [06 Personality](06-personality.md).
2. **Glass box.** Retrieval steps, sources, and grounding verdict stream to the UI before the
   answer does. See [05 Runtime](05-runtime.md) and [10 UI](10-ui.md).
3. **Gap loop.** Questions it cannot answer reach Tanish by email, get answered, and are published
   at `/asked`. Blind spots become content. See [09 Gap queue](09-gap-queue.md).

## Goals

- Answer only from the approved corpus.
- Real multi-turn chat with history.
- Stream tokens. Perceived latency matters more than total latency.
- Refuse cleanly and visibly, with the reason exposed.
- Attribute every generated answer, gap, and dollar to a verified person.
- Publish counters, including the refusal rate.

## Non-goals (v1)

- Per-page context awareness. The FAB behaves identically everywhere. (v2)
- First-person voice. v1 speaks about Tanish in third person. (v2)
- Reading repository source at runtime. Code reaches the agent only as quoted snippets inside
  authored corpus files.
- Tool use of any kind. Retrieval is the only capability.
