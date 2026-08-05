---
id: project-hybrid-fit
title: HybridFit
kind: project
route: /projects/hybrid-fit
externalUrl: https://github.com/tnahata/hybrid-fit
---

## What HybridFit is

HybridFit is a training platform for hybrid athletes: people who lift and run and play a sport in
the same week, rather than training for one thing.

Existing tools assume a single discipline. A running app models sessions as distance and pace. A
lifting app models them as sets, reps, and weight. Someone doing both ends up with two apps that
each believe they own the week, and no view of the actual load. HybridFit handles multi-plan
enrollment, flexible scheduling, and granular logging across workout types in one place, so a
strength block and a half-marathon build can run concurrently and be seen together.

He built it because he is that athlete. It is the project on this site with the most direct personal
motivation. Its source is public.

## Modelling heterogeneous workouts

A strength session and a 5K run are structurally nothing alike. One tracks sets, reps, and weight
per exercise; the other tracks distance, pace, and heart rate for the whole session. Drills add
another dimension. Designing a data model flexible enough to represent all of them consistently,
while staying efficiently queryable and renderable by a single logging UI, was a genuine schema
design problem. Getting the abstraction right early saved significant pain when mixed workout types
arrived later.

Three approaches were on the table. Separate collections per discipline is the most honest
representation and makes any cross-discipline view a join-and-merge problem, which is most of what
the app does. One wide structure covering every field is queryable and mostly empty, and every new
workout type widens it further. An unstructured blob per session is flexible and gives up the
ability to query on anything inside it, which kills progression tracking.

What it settled on is a common session envelope, carrying the fields every workout genuinely shares
(type, date, plan, duration, effort), with a typed payload underneath that differs by discipline.
Four workout types are supported: distance, strength, drill, and mixed. Queries that span
disciplines read the envelope and never need to understand the payload. The logging UI switches on
type at one boundary rather than throughout.

The tradeoff is that adding a workout type means writing a payload shape and a UI branch, and there
is no way to add one purely through configuration. That has been the right trade so far, because
the number of disciplines grows slowly and the cost of a schema that lies about its contents does
not.

## The enrollment model

Multi-plan enrollment rests on one design decision: a plan does not own dates. Enrollment is the
join between a plan and a user's calendar, carrying its own start date, current position, and
per-workout overrides and logs. Because the plan itself stays date-free, a strength block and a
half-marathon build can overlap in the same weeks without either assuming it owns the calendar,
and a plan can be paused or shifted without rewriting the sessions inside it.

## The N+1 problem and caching

Early on, core data fetches issued a database query for every enrolled plan a user had: the classic
N+1. Static content like the exercise library hit the database on every request with no caching.

He rearchitected the query patterns to batch related data into single calls, added field projections
to strip unnecessary payload, and introduced response caching on content that does not change per
request. Database queries on static routes dropped by 99.76 percent. Separately, tuning the
connection pool let the application serve roughly five times the concurrent users before degrading.

The connection pool detail is the one worth keeping, because it was not the fix he expected. The
N+1 was the obvious problem and fixing it was mechanical. The concurrency ceiling turned out to be a
pool sized for the query pattern he had before, and the two problems looked identical from the
outside: the app got slow under load. One was doing too much work, the other was refusing to do work
it had capacity for.

## The data ingestion pipeline

The exercise library did not exist until it was built. He wrote an ingestion pipeline pulling
exercises from multiple external sources, each with its own structure and format, normalising them
into one schema the frontend and a future recommendation engine could work against. It had to handle
inconsistent naming, missing fields, duplicate entries across sources, and sport-specific
conventions, since running drills and strength exercises do not describe themselves the same way.
The result is over a thousand curated exercises spanning running, strength, and soccer.

Deduplication was the hard part, and it is not fully solved. Exact name matching finds almost
nothing, because the same movement appears as several near-identical strings across sources.
Normalising aggressively merges things that are genuinely different. The pipeline normalises names
to a canonical form and matches on that plus the primary muscle group or discipline, which catches
most true duplicates. What survives is a curation pass by hand, which is why the library is
described as curated rather than scraped.

## Outcomes

- 99.76 percent reduction in database queries on static routes.
- Over a thousand curated exercises across running, strength, and soccer.
- Roughly five times more concurrent users after connection pool tuning.
- Four workout types modelled: distance, strength, drill, and mixed.

It is deployed and he uses it for his own training. It is not a product with a user base, and the
performance work was done because the problems were interesting and real rather than because scale
demanded it.

## What is not built yet

The recommendation engine the ingestion pipeline was built to feed does not exist yet; Pinecone is
in the stack as a planned dependency rather than a used one. There is no social or coaching layer.
Analytics across plans are thinner than he wants: the data model supports asking how a strength
block affected running performance, and nothing in the interface asks it.

## Stack

Next.js 15 with TypeScript, NextAuth using credentials, MongoDB with Mongoose, Zod, Shadcn/UI on
TailwindCSS, Puppeteer, Vercel, and Pinecone planned.

MongoDB is the choice that follows directly from the schema problem above. A typed payload that
differs by workout type is awkward in a relational schema and natural in a document model, and the
envelope-plus-payload shape maps onto documents without an abstraction layer in between. Zod does
the validation the database will not, which is the tradeoff a document store asks you to accept: the
flexibility is real and the guarantees have to be recovered somewhere. Mongoose supplies the
projections that took most of the payload out of the N+1 fix. Puppeteer drives the ingestion
pipeline against sources with no usable API. NextAuth with credentials rather than a provider
because the app has no reason to require an external account for a personal training log.
