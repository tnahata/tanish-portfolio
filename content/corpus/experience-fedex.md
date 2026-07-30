---
id: experience-fedex
title: FedEx Corp
kind: page
route: /
---

## Role and timeline

Full Stack Engineer Intern at FedEx Corp from June 2023 to August 2023, then Full Stack Engineer
from June 2024 to December 2025, then Full Stack Engineer II from December 2025 to the present.

## What he works on

He builds and ships core platform features for an internal operations management application used by
facility managers and district engineers across North America and Europe. The application manages
the lifecycle of hierarchical business entities, which is the detail that makes most of the work
harder than it sounds: entities have to be created and fully persisted in order, grandparents before
parents before children, and the platform layer rejects any request whose ancestors do not yet
exist.

The architecture has three layers. His team owns the outer edge, the user-facing applications, made
up of a frontend, an API service, and a messaging service. Beneath that sits the inner edge, shared
platform APIs owned by another team, and beneath that the persistent datastore that is the source of
truth. Communication downward is REST; communication back up is asynchronous JMS messaging. Most of
the interesting problems live in the gap between a request being accepted and the data actually
existing.

## Full Stack Engineer II, December 2025 to present

- Builds and ships core platform features for an operations management system used across more than
  5,000 facilities in North America and Europe.
- Led the European operations rollout, executing production data loads for more than 350 facilities
  and coordinating across three teams to reach launch with zero data gaps.
- Designed and shipped a scheduling management system that lets coordinators configure daily
  operational defaults, reducing manual setup across facilities.
- Led a cross-team release of four major features, aligning dependencies across three teams to
  deliver on schedule with zero regressions.
- Drove adoption of AI-assisted development, standardising GitHub Copilot practices across more than
  25 engineers on the team.

Java, Spring Boot, JUnit, Jenkins, GitHub Copilot.

The European rollout is the one worth explaining, because "zero data gaps" is a result rather than a
story. Production data loads for a new region are unforgiving in a system with strict entity
hierarchies: every parent has to land before its children, across datasets owned by different teams
on different schedules, with no partial state that leaves an operations team looking at a half-built
region. The coordination was most of the work. The engineering was ordering, verification at each
stage, and being able to prove the shape of the data before the next load ran rather than after.

## Full Stack Engineer, June 2024 to December 2025

- Introduced a Redis caching layer to surface real-time UI states, eliminating data inconsistencies
  and reducing operations support escalations by 90 percent.
- Built scalable Java and Spring Boot APIs for bulk CSV ingestion, letting operations teams across
  more than 25 European countries onboard facility data and eliminating more than 100 hours of
  manual data entry per batch.
- Developed an Angular scheduling calendar used by more than 500 facility managers for daily
  planning and operational monitoring.

Redis, Java, Spring Boot, Angular, TypeScript, Jenkins.

## Full Stack Engineer Intern, June 2023 to August 2023

- Optimised routing calculation workflows by consolidating multiple database queries, reducing
  response latency from ten seconds to three seconds and accelerating batch retrieval and
  processing.
- Built Angular features for real-time scheduling and monitoring, improving daily visibility for
  facility managers managing shift and route planning.

Java, JUnit, Oracle SQL, Angular, TypeScript.

## The eight second sleep

The Redis work is the piece of his professional experience he can explain in the most detail, and it
is worth being precise about what it actually was, because "caching eliminated data inconsistency"
sounds backwards. Caching normally makes staleness worse.

It was not a cache. Redis was used as a coordination layer.

The legacy API service created a parent entity, then called `Thread.sleep()` for eight seconds
before creating its children, hoping the parent had finished persisting somewhere downstream. If it
had, the thread had done nothing for the remainder of the delay. If it had not, the child request
fired against a parent that did not exist yet, the platform rejected it, and the hierarchy broke.
Users saw parents without children or stale screens, and engineers fixed data in production by hand.

The replacement made completion an event instead of a guess. The API service writes request state to
Redis on the way in. When the datastore finishes persisting, a notification travels back up through
the messaging service, which triggers the child creation and then deletes the parent's key. The API
service is subscribed to key expiry and deletion events, so the moment that key disappears it knows
the work is genuinely done and pushes a completion event to the browser over a server-sent events
channel.

Redis was chosen for two features rather than for speed: expiring keys, which give orphaned state a
safety net, and keyspace notifications, which allow reacting to a change without polling. A database
table with polling would have worked and added latency plus load; a message broker would have
brought durable replay and consumer groups that this problem does not need.

Results: the typical time from submission to a correct screen went from over eight seconds to under
two. The category of support tickets caused by premature child creation fell by 90 percent. Thread
utilisation improved for a reason that had nothing to do with throughput optimisation, which is that
threads stopped being held hostage doing nothing.

What is still imperfect, and he says so readily: keyspace notifications are fire-and-forget pub/sub,
so if the API service restarts mid-flow the completion event to the browser is lost. That is a UX
inconsistency rather than a data integrity one, since the entity creation completes regardless and a
refresh shows the correct state. The five minute expiry on orphaned keys is a blunt instrument, and
if he were iterating he would add a reconciliation job that notices stale keys and alerts instead of
letting them expire silently.

There is a longer written version of this on the blog.

## What he learned there

Working on an internal system with real operational consequence taught him something side projects
cannot: that the expensive failures are usually organisational. The eight second sleep survived for
years not because nobody noticed it but because fixing it required coordinating with a team that
owned the layer underneath, and the delay was papering over a genuine coordination problem rather
than laziness. Most of the work of removing it was understanding a system his team did not own well
enough to depend on it correctly.
