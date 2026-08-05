---
id: project-discovery-agent
title: Noiseless
kind: project
route: /projects/discovery-agent
---

## What Noiseless is

Noiseless is an AI curator for X. It discovers the conversations, builders, and opportunities that
match a person's expertise, delivers a short curated digest to their Slack DMs, and learns from
every one-tap decision they make on it. The goal is knowledge-optimized rather than
engagement-optimized: less time on the feed, not more.

Earlier versions also drafted replies and held them for explicit approval before anything was
published. That surface is retired. The product now optimises entirely for what it shows a person,
not for what they post, and nothing is posted or sent on anyone's behalf.

Setup is a guided web onboarding: point it at a few links, connect X and GitHub, and it extracts a
usable interest profile automatically, which the person reviews and confirms. Recommendations are
relevant from the first run with no manual form-filling. It is currently in private beta.

## The pipeline

A run moves through six stages orchestrated as a graph: search, fetch, deduplicate, rank, digest,
learn. Query generation is tailored to the person's profile, ranking is model-scored relevance,
and what survives lands in Slack as a digest with one-tap Like, Dislike, or Skip.

The pipeline runs asynchronously and its state outlives the process. Decisions on a digest can
arrive hours after the run that produced it, so waiting is the normal condition rather than an
interruption, and the database is the only state shared between the pipeline and the Slack surface.
Getting that boundary wrong would mean lost decisions or duplicated digests, which is why the
boundary is the design.

## The learning loop

Most personalisation tools profile a person once and freeze. Noiseless closes the loop: every like,
pass, and edit feeds back into ranking, and the system learns which topics matter, which voices the
person trusts, and what actually resonates, across categories, authors, and semantic similarity.
Run fifty is measurably better than run one.

Measured on real usage, recommendation relevance rose from roughly 25% to over 75% within six weeks
of the feedback loop landing, self-tuned across five learned preference signals. A web dashboard
exposes the loop rather than hiding it: run history, decision breakdowns, category performance, and
budget usage are all visible to the person being learned about.

## Profile extraction

Cold start is handled by extraction rather than forms. The onboarding pulls signal from multiple
sources (X, GitHub, RSS, arbitrary web URLs), scores each extracted field with a confidence value,
and merges the sources with a model rather than a fixed precedence rule. The person reviews the
result and confirms it, which keeps the profile theirs rather than the extractor's.

The style-versus-facts separation from the earlier drafting era survives in the profile design:
what the system captures about how someone writes and what they care about deliberately encodes no
factual claims of expertise it could later assert on their behalf.

## Cost enforcement

The agent makes API calls that cost real money: reads against the X API and model calls to rank and
extract. Without hard limits, a runloop bug or a misconfigured query could burn a budget in
minutes.

Cost enforcement runs before any work begins. Budget caps are per-account, spend checks and rate
limits apply to each account independently, and every external action gets a durable audit log
entry before the call is made, so a crash mid-request leaves a record rather than a mystery. Cost
holds under $0.05 per run, and the person's own dashboard shows their budget usage.

The ordering is the whole idea. Checking spend after the fact tells you what happened; checking
before the call is what makes a ceiling real. Writing the audit entry before rather than after the
call is the same instinct: the log has to survive the failure it exists to explain.

This is the second time he has solved the same problem, and he solved it differently the second
time. The agent on this portfolio counts a person's paid turns for the day and inserts a claim row
before generation starts, so a request past the daily limit is stopped before it costs anything.
It is not fully atomic: a burst of concurrent requests can still slip one past the count, and the
model vendor's own spend cap is the real ceiling underneath. The general principle he takes from
both: an agent that spends money needs a hard ceiling enforced structurally, not a budget someone
watches.

## Outcomes

- Recommendation relevance raised from roughly 25% to over 75% within six weeks, through a feedback
  loop that self-tunes ranking across five learned preference signals.
- Cost held under $0.05 per run, enforced through per-account budget caps checked before work
  begins.
- Multi-signal profile extraction from X, GitHub, RSS, and web URLs, with per-field confidence
  scoring and model-merged results.
- Six pipeline stages orchestrated with persistent state and asynchronous resumption.
- Over a hundred tests across the pipeline, cost enforcement, and feedback loop.
- Twenty-three days from first commit to version 1.0.

## What is not built yet

Operational maturity is the honest gap: alerting on failures, graceful degradation when external
services go down, and cost enforcement that survives restarts. That is the difference between a
side project and something other people can depend on, and it is not done. The private beta is
gated by a waitlist rather than open signup for the same reason.

## Stack

Python, FastAPI, SQLAlchemy (async), Alembic, LangGraph, the Anthropic Claude API for ranking and
extraction, OpenAI embeddings, a Slack bot over Socket Mode, Supabase auth with Google OAuth,
PostgreSQL with pgvector, Tailwind CSS with Vite for the web app, pytest, and Railway.

LangGraph because the pipeline is a graph that has to pause and resume across process restarts, and
durable state between stages is the framework's actual job rather than an add-on. Slack because the
digest needed to land somewhere the person already is, and an interface nobody has to remember to
open is worth more than a purpose-built one. OpenAI embeddings score semantic similarity, kept
separate from the Claude calls that handle query generation, ranking, and profile extraction, so
the two model providers split by job rather than one doing both. Postgres with pgvector so
relevance scoring and application state live in the same database rather than in a vector store
that has to be kept in sync with it. Alembic because a long-running agent's schema changes while it
has live state in flight. The test count is high relative to the project's size on purpose: an
agent that spends money is one where the expensive failures are the ones you cannot reproduce by
hand.
