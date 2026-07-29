---
id: project-discovery-agent
title: Noiseless
kind: project
route: /projects/discovery-agent
verbatimOnly: false
---

## What Noiseless is

Noiseless finds conversations worth joining and drafts replies in the user's own voice, without
ever publishing anything a person has not explicitly approved.

A command starts a run. The pipeline searches for recent posts, filters and ranks them for
relevance, drafts replies to the ones that survive, and then stops. Every draft goes to a chat
surface where a human approves, edits, or rejects it. Only approved drafts are published. A typical
run searches on the order of a hundred and fifty posts and surfaces roughly seven worth drafting a
reply to.

It was built for one person first. It now has six active users and growing: signup auto-generates a
usable interest profile from a person's X, GitHub, and web presence, so recommendations are relevant
from the first run with no manual setup. Version 1.0 shipped twenty-three days after the first
commit.

## Human in the loop as the foundation

The discovery pipeline runs asynchronously. A command kicks off search, ranking, and drafting, then
the system pauses while waiting for approval decisions that arrive through a chat surface, possibly
hours later. State has to survive process restarts.

The graph framework handles the pause, but wiring it to an external approval surface required a
careful separation: the pipeline owns orchestration, the chat surface owns the user interface, and
the database is the only shared state between them. Getting that boundary wrong would mean lost
decisions or duplicate posts.

The distinction that matters is that approval is the foundation rather than a safety feature added
on top. An agent built to publish autonomously, with a review step introduced later, has a pipeline
whose natural state is "running" and whose approval step is an interruption. Everything about it
resists pausing: state lives in memory, the run assumes it will finish, and a restart loses work.
Building approval in from the start inverts that. Waiting is the normal condition, the run is
expected to outlive the process, and state is durable because it has to be. Zero posts have been
published without explicit human approval, and that is a property of the architecture rather than a
policy anyone has to remember.

## Cost enforcement

The agent makes API calls that cost real money: reads to find posts, writes to publish, and model
calls to rank and draft. Without hard limits, a runloop bug or a misconfigured query could burn a
budget in minutes.

Cost enforcement runs before any work begins. Budget controls are atomic and per-user: spend checks
and rate limiting apply to each account independently, and session and daily limits are checked
independently for reads and writes, because they fail differently: a runaway read loop is expensive
and harmless, while a runaway write loop is expensive and public. Every external action gets a
durable audit log entry before the call is made, so a crash mid-request leaves a record rather than
a mystery. Cost holds under $0.05 per run.

The ordering is the whole idea. Checking spend after the fact tells you what happened; checking
before the call is what makes a ceiling real. Writing the audit entry before rather than after the
call is the same instinct: the log has to survive the failure it exists to explain.

This is the second time he has solved the same problem, and he solved it differently the second
time. The agent on this portfolio reserves an estimated cost before generating and reconciles
against the actual afterwards, in a single database transaction, so two concurrent requests cannot
both pass a cap that only one of them fits under. The general principle he takes from both: an agent
that spends money needs a hard ceiling enforced structurally, not a budget someone watches.

## Style grounding

The model drafts replies that need to match a real person's tone and reference their actual
background rather than inventing expertise. The ranking stage classifies each post before drafting.
If a topic falls outside the user's domain, the drafter skips it entirely rather than fabricating
authority.

Style traits captured during onboarding describe how someone writes: directness, vocabulary,
personality. They deliberately encode no factual claims. The rest is structural: character limits,
format validation, and rejection of drafts that read as obviously machine-generated.

Separating style from facts is the same position the agent on this site is built on. A model can be
told how someone sounds without being told what they know, and conflating the two is how a system
ends up confidently claiming expertise on behalf of a real person. Voice is a safe thing to imitate.
Knowledge is not, and it has to come from somewhere verifiable or not at all.

## Outcomes

- Zero posts published without explicit human approval.
- Six active users and growing, each onboarded through a signup flow that auto-generates an
  interest profile from their X, GitHub, and web presence, eliminating manual setup.
- Recommendation relevance raised from roughly 25% to over 75% within six weeks, through a feedback
  loop that self-tunes ranking across five learned preference signals.
- Cost held under $0.05 per run, enforced through atomic per-user budget controls.
- Over a hundred tests across the pipeline, cost enforcement, and feedback loop.
- Five pipeline stages orchestrated with persistent state and asynchronous resumption.
- Twenty-three days from first commit to version 1.0.

The run figures quoted above (roughly a hundred and fifty posts searched, seven surfaced per run)
come from a representative run rather than a best one. The ratio is more informative than the
absolute numbers: most of what search returns is not worth replying to, and the ranking stage exists
to make that someone else's problem than the drafter's.

## What is not built yet

Generalising beyond one professional persona (to a designer, a PM, a researcher) means rethinking
how the agent reasons about expertise and relevance, which is currently tuned to one domain.

Operational maturity is the honest gap: alerting on failures, graceful degradation when external
services go down, and cost enforcement that survives restarts. That is the difference between a side
project and something other people can depend on, and it is not done.

## Stack

Python 3.12, LangGraph, Slack Bolt, the Anthropic Claude API, OpenAI embeddings, PostgreSQL with
pgvector, Supabase, SQLAlchemy, Alembic, Docker, httpx, and pytest.

LangGraph because the pipeline is a graph that has to pause and resume across process restarts, and
durable state between stages is the framework's actual job rather than an add-on. Slack Bolt because
the approval surface needed to be somewhere the user already is, and an interface nobody has to
remember to open is worth more than a purpose-built one. OpenAI embeddings score relevance during
ranking, kept separate from the Anthropic Claude API that handles query generation and drafting, so
the two model providers split by job rather than one doing both. Postgres with pgvector so relevance
scoring and application state live in the same database rather than in a vector store that has to be
kept in sync with it, with Supabase providing the account and budget primitives that per-user signup
depends on. Alembic because a long-running agent's schema changes while it has live state in flight.
The test count is high relative to the project's size on purpose: an agent that spends money and
posts publicly is one where the expensive failures are the ones you cannot reproduce by hand.
