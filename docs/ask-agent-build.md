# Ask agent — build plan

Design is in [ask-agent.md](ask-agent.md). This is the order it gets built, who writes what, and
what counts as proof.

Branch: `ask-agent-v2`. One PR to `main` at the end.

Settled before the first commit: the old four tables are dropped and the new two created in the
same database; an Anthropic key is available, so every tier is verified in one pass; CI runs an
ephemeral Postgres with pgvector so the reconcile transaction and the advisory lock are exercised
on every PR.

## Principle

Build from the most deterministic piece outward. Tier 1 is pure functions over strings with no
network and no database, so its tests are exact. Every tier after adds one dependency and nothing
else. By the time anything touches Anthropic, everything under it is already proven.

## Commit 01 — skeleton (orchestrator)

Every file created at once with real exported TypeScript signatures, a one or two line comment per
export stating its contract, and `throw new Error('not implemented')` bodies. `tsc --noEmit` and
`npm run lint` pass on it.

This commit is the contract. Test agents write against these signatures without ever seeing an
implementation, so the tests cannot be shaped to fit the code that has to pass them.

```
lib/ask/
  types.ts      LockedReason, Verdict, RetrievedChunk, StrongGrounding brand
  config.ts     models, dims, TOP_K, thresholds, limits, history caps
  db.ts         pg pool, drizzle client
  schema.ts     chunks, user_interactions
  corpus.ts     read files, parse frontmatter, split on ##, deterministic ids
  embed.ts      embedOne, embedMany
  ingest.ts     desired-vs-live diff, one transaction
  retrieve.ts   embed question, top-k, threshold verdict
  filter.ts     injection and private pre-filter
  refusals.ts   copy table keyed by reason
  prompt.ts     system prompt, context assembly, per-request marker
  generate.ts   streamText, marker detection, withhold transform
  log.ts        gates, claim row, turn update, history
  ask.ts        prepareTurn, runTurn
db/schema.sql
scripts/        db-setup.ts, ingest.ts, ask.ts
app/api/ask/route.ts
components/ask/ AskFab.tsx, AskPanel.tsx
```

## Tiers

Tests land before the code they cover, and never from the agent that writes that code.

| # | Commit | Agent | Needs |
|---|---|---|---|
| 02 | tests: pure logic | test A | nothing |
| 03 | corpus: read, frontmatter, chunk on `##` | impl | nothing |
| 04 | filter + refusals | impl | nothing |
| 05 | prompt assembly + marker | impl | nothing |
| 06 | tests: data layer | test B | Postgres |
| 07 | db.ts, `scripts/db-setup.ts`, schema verified live | impl | Postgres |
| 08 | log.ts: gates, claim row, history | impl | Postgres |
| 09 | tests: retrieval | test C | Postgres |
| 10 | embed.ts | impl | OpenAI |
| 11 | ingest.ts reconcile + `scripts/ingest.ts` | impl | Postgres, OpenAI |
| 12 | retrieve.ts + grade | impl | Postgres, OpenAI |
| 13 | tests: generation | test D | nothing (model mocked) |
| 14 | generate.ts + withhold transform | impl | Anthropic |
| 15 | ask.ts prepareTurn/runTurn + `scripts/ask.ts` | impl | all |
| 16 | tests: route | test E | nothing (deps mocked) |
| 17 | `app/api/ask/route.ts` | impl | all, Clerk, BotID |
| 18 | Signal FAB + panel | impl | route |
| 19 | CI: `npm test` with an ephemeral pgvector service | impl | nothing |
| 20 | eval harness vs `evals/questions.yaml` | impl | all |

Serial, one agent per commit, so history stays linear and every commit is reviewable on its own.

Tier 1 (02–05) is parallelizable across git worktrees if wall-clock matters more than a clean
history. Not the default.

`types.ts`, `config.ts`, `schema.ts` and `db/schema.sql` are complete in commit 01 rather than
stubbed. They are declarations, not implementations, and everything else types against them.

## Edge cases tests must cover

Not exhaustive, but none of these may be missing:

- **corpus**: file with no `##` sections; heading appearing twice in one file (id collision);
  frontmatter missing a required field; empty file; unicode in a heading slug
- **chunking**: content before the first `##`; nested `###` staying with its parent section
- **filter**: injection phrasing inside an otherwise valid question; a private keyword appearing
  innocently ("what address does he give for the repo"); case and spacing variants
- **ingest**: empty desired corpus (must refuse); a chunk whose content changed but id did not;
  a chunk deleted from disk; embed model mismatch against `chunks.metadata`
- **retrieval**: scores straddling each threshold exactly; every chunk below floor; ties
- **gates**: anonymous second turn; a signed-in user at exactly the limit; concurrent requests
  under the advisory lock; a refusal that cost nothing not counting; `unanswerable` counting
- **generate**: marker emitted alone; marker split across stream chunks; marker as a prefix that
  turns out not to be the marker; stream error mid-answer; `finishReason` other than stop
- **log**: claim row written before generation; turn updated on success and on each lock reason

## Verification

Once every commit is in and green, implementation stops and testing starts. I do not fix what I
find.

For each bug: I write a reproduction, dispatch it with the repro to a fix agent, the agent commits
the fix plus a regression test that fails without it, and then I run the repro myself and capture
the before and after. One report per bug. After the last fix, the whole system is retested from a
clean database, not just the broken paths.

## Proof artifact

One artifact, linked in the PR, with a section per feature. Real captures only, no reconstructions.

| Feature | Proof |
|---|---|
| Ingest | terminal capture of `npm run ingest`; `psql` row counts and a sample `metadata` |
| Reconcile | edit a corpus file, re-run, capture the diff applied and unchanged rows untouched |
| Empty-corpus guard | capture of the refusal |
| Retrieval thresholds | table of eval questions with measured top scores and the verdict each got |
| Refusal paths | one CLI transcript per `locked_reason`, plus the row each wrote |
| Marker withholding | capture proving the marker never appears in streamed output |
| Gates | transcript of the second anonymous turn; the row counts behind it |
| Rate limit | concurrent-request test output showing the limit held exactly |
| Streaming | GIF of the panel from submit to first token to completion |
| Signal FAB | screenshots at 390 and 1440, idle and thinking states |
| Eval harness | run output with per-stratum pass rates |

Follows `.claude/skills/pr-visual-verification`: captures come from the deployed Vercel preview
for anything user-visible, measured numbers in captions, and the completion gate runs before the
PR is called ready.
