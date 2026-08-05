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
what the public repository and case study already cover: what the pipeline does, how the learning
loop works, how cost enforcement is ordered, how profile extraction works, and the results of
running it with real users. He has not decided to publish what is below that: how the audit log is
structured, how pipeline state is stored and resumed, or how the learned preference signals are
computed. That is his to revisit any time, but until he does, this is the full scope.

## What is already public

Noiseless is an AI curator that discovers high-signal X conversations matching a person's
expertise, delivers a curated digest to their Slack DMs with one-tap Like, Dislike, or Skip, and
learns from every decision. It is knowledge-optimized rather than engagement-optimized, and nothing
is posted or sent on anyone's behalf. Earlier versions drafted replies held for explicit approval
before publishing; that surface is retired.

A run moves through six stages orchestrated as a graph: search, fetch, deduplicate, rank, digest,
learn. The pipeline runs asynchronously, decisions can arrive hours later, and the database is the
only state shared between the pipeline and the Slack surface, so state survives process restarts by
construction.

Cold start is handled at onboarding: the system extracts an interest profile from a person's X,
GitHub, RSS, and web presence with per-field confidence scoring and model-merged results, which the
person reviews and confirms. Recommendation relevance rose from roughly 25% to over 75% within six
weeks of the feedback loop landing, self-tuned across five learned preference signals. A web
dashboard shows run history, decision breakdowns, category performance, and budget usage.

Cost enforcement runs before any work begins, not after. Budget caps are per-account, and every
external action gets a durable audit log entry before the call is made. Cost holds under $0.05 per
run.

The stack is Python, FastAPI, SQLAlchemy, Alembic, LangGraph, the Anthropic Claude API, OpenAI
embeddings, a Slack bot over Socket Mode, Supabase auth, PostgreSQL with pgvector, Tailwind CSS
with Vite, pytest, and Railway. Version 1.0 shipped twenty-three days after the first commit, with
over a hundred tests across the pipeline, cost enforcement, and feedback loop. It is currently in
private beta behind a waitlist.

## What is deliberately not covered here

This file does not describe the structure of the audit log, how pipeline state is persisted and
resumed, how the learned preference signals are computed, or the internals of ranking beyond what
is already public. It also does not cover credential handling or the accounts Noiseless connects
to. None of that is because it is alarming; Tanish would rather draw the line deliberately than let
a system speak for him about mechanisms he has not decided are worth describing yet.
