---
id: stack
title: Tools and Technologies
kind: page
route: /stack
---

## Languages

TypeScript, Python, Java, SQL.

Java is the language he has written the most production code in, because it is the language of the
day job: two years of Spring Boot services in an internal operations platform at FedEx, plus ESMON,
which is Java 17 on JavaFX. It is the language he is most confident debugging under pressure.

TypeScript is where most of his own work happens. HybridFit and this site are both Next.js and
TypeScript end to end. He uses the type system as a design tool rather than as documentation, which
is the same instinct behind the branded value that makes an ungrounded answer unrepresentable in
this site's agent.

Python is the AI work. Noiseless is Python 3.12 on LangGraph, and it is the language he
reaches for when the interesting part is orchestration rather than the application.

SQL he writes by hand and prefers to. ESMON uses Spring JDBC rather than an ORM specifically because
the queries are analytical and an object mapper would obscure them.

## Frameworks

Next.js, React, Spring Boot, FastAPI.

Next.js on the App Router for anything he starts himself, and the reason is deployment as much as
the framework: server components and route handlers in one codebase deployed to Vercel removes an
entire category of work he would rather not do again.

Spring Boot at work and, less obviously, in ESMON, where it does dependency wiring and lifecycle for
a desktop application with nothing web-facing about it. It is a good example of taking a framework
for one guarantee rather than for its category.

FastAPI is the one he has used least of the four. He is comfortable in it and would not claim depth.

## AI and ML

LangGraph, the Claude API, pgvector, LangChain.

This is the group that matters most to how he positions himself, so it is worth being exact about
what has been built rather than read about.

LangGraph is the framework behind Noiseless, chosen because the pipeline pauses for human
approval that may arrive hours later and has to survive a process restart. Durable state across
graph nodes is the thing it is actually for, and that is the reason it is in the stack rather than
general enthusiasm for agent frameworks.

The Claude API is the model layer in both Noiseless and the agent on this site.

pgvector is in both as well: Postgres holding embeddings alongside application state rather than a
separate vector store that has to be kept in sync. On this site's agent that is a deliberate
decision, since the corpus is small enough that an exact scan beats an approximate index and there
is no second system to drift.

On LangChain versus LangGraph he has a position: LangChain is a reasonable way to get started and a
poor place to stay, because the abstraction stack is deep relative to what most applications need.
LangGraph earns its place by solving state and control flow, which are real problems. He is generally
sceptical of agent frameworks that add planning layers, subagents, and virtual filesystems on top of
a loop the model provider already gives you. On this site's agent he uses the Vercel AI SDK and
nothing else on top of it, for exactly that reason.

## Infrastructure

Docker, Vercel, PostgreSQL, Redis, MongoDB, AWS.

Postgres is the default. Both agent projects use it, and on this site it holds the corpus, the
embeddings, and the per-turn log that rate limiting counts against, in one database.

MongoDB is in HybridFit because the workout schema is genuinely heterogeneous and a document model
fits that better than a relational one. It is a considered choice for that problem, not a general
preference.

Redis is the interesting entry, because he has argued both directions on it. At FedEx he introduced
it as a coordination layer, chosen for expiring keys and keyspace notifications rather than for
speed, and it removed an eight second hardcoded delay. On this site's agent he removed Redis from
the design entirely and does rate limiting as a turn count plus a claim row in Postgres, because
what he needed there was transactional guarantees across counters and a second vendor was not worth
it. Sign-in never needed a home-grown nonce system in the first place: that is Clerk's job, not the
database's. The general rule he takes from both: choose infrastructure for the guarantee it gives
you, and be willing to reach the opposite conclusion when the guarantee you need changes.

AWS is the newest entry, backed by a Certified Cloud Practitioner certification rather than by
production infrastructure he has run there himself. Worth stating plainly rather than letting the
tag imply more than it does: the certification covers the platform's shape and core services, not
hands-on operational depth. The infrastructure he has actually run in production is Vercel and
Docker, not AWS services under load.

Vercel for anything Next.js. Docker for the Python services.

## Tools

Git, VS Code, Cursor, Figma.

AI-assisted development is a workflow he has actually pushed on rather than a line on a page: he
drove Copilot adoption and workflow standardisation across his team at FedEx. His own use is
heaviest on the parts of the job with a known shape, and lightest on design decisions, which is the
same split he would defend in a conversation about it.

Figma he uses to think, not to hand off. There is no designer on any project here.

## What he has not used

Worth stating plainly, because an agent that says "he hasn't done that" without hedging is only
useful if this section is accurate.

He has not run Kubernetes, or worked on infrastructure at a scale where orchestration is the
problem. He has not written Go or Rust. He has not built mobile applications, native or
cross-platform. He has not worked on distributed systems where consensus, sharding, or partition
tolerance is the central difficulty; the asynchronous coordination work he has done sits above that
layer. He has not managed engineers.

He has also not shipped a product to a large public user base. ESMON is in beta with a specific
operational audience, HybridFit is public and used mainly by him, and Noiseless is
single-tenant so far.
