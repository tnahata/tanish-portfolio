---
id: disclosure-discovery-agent
title: Noiseless, Cleared Engineering Detail
kind: disclosure
route: null
---

<!-- Deliberately held to what is already public today. Widen only when a real decision is made to cover something beyond the case study. -->

## Scope of this clearance

Noiseless is Tanish's own project, not employer work, so the boundary here is a decision he made
rather than a permission someone else granted. He is choosing to keep the public-facing detail to
what the case study page already covers: what the pipeline does, why approval comes before
publishing, how cost enforcement is ordered, how style grounding works, and the results of running
it with real users. He has not decided to publish what is below that: how the audit log is
structured, how pipeline state is stored and resumed, or how style traits are extracted and stored.
That is his to revisit any time, but until he does, this is the full scope.

## What is already public

Noiseless finds conversations on Twitter worth joining and drafts replies in Tanish's own voice, and
it never publishes anything he has not explicitly approved. A command starts a run: the pipeline
searches for recent posts, filters and ranks them for relevance, and drafts replies to the ones that
survive. Every draft goes to a chat surface in Slack, where he approves, edits, or rejects it; only
approved drafts get published. A representative run searches on the order of a hundred and fifty
posts and surfaces roughly seven worth drafting a reply to. Zero posts have been published without
explicit approval.

Noiseless has six active users and growing. Cold start is handled at signup: the system
auto-generates a usable interest profile from a person's X, GitHub, and web presence, so
recommendations are relevant from the first run with no manual setup. Recommendation relevance rose
from roughly 25% to over 75% within six weeks, through a feedback loop that self-tunes ranking
across five learned preference signals.

Approval is the architectural foundation, not a feature added afterward. The pipeline pauses after
drafting and waits for a decision that can arrive hours later, so its state has to survive a process
restart, with the database as the only state shared between the pipeline and the chat surface.

Cost enforcement runs before any work begins, not after. Budget controls are atomic and per-user:
spend checks and rate limiting apply to each account independently, and session and daily limits are
checked independently for reads and writes, since a runaway read loop is expensive and harmless
while a runaway write loop is expensive and public. Every external action gets a durable audit log
entry before the call is made. Cost holds under $0.05 per run.

Style traits captured at onboarding describe how Tanish writes (directness, vocabulary, personality)
and deliberately encode no factual claims. If a topic falls outside his declared expertise, the
drafter skips it rather than fabricating authority.

The stack is Python 3.12, LangGraph, Slack Bolt, the Anthropic Claude API, OpenAI embeddings,
PostgreSQL with pgvector, Supabase, SQLAlchemy, Alembic, Docker, httpx, and pytest. Version 1.0
shipped twenty-three days after the first commit, with over a hundred tests across the pipeline,
cost enforcement, and feedback loop.

## What is deliberately not covered here

This file does not describe the structure of the audit log, how pipeline state is persisted and
resumed, how style traits are extracted or stored, how the five learned preference signals are
computed, or the internals of ranking and drafting beyond what is already public. It also does not
cover credential handling or the accounts Noiseless operates on. None of that is because it is
alarming; Tanish would rather draw the line deliberately than let a system speak for him about
mechanisms he has not decided are worth describing yet.
