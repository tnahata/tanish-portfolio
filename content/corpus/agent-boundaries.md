---
id: agent-boundaries
title: What This Agent Will and Will Not Answer
kind: meta
route: null
---

<!-- This file makes claims about the SYSTEM rather than about a person, so it goes stale when the
     system changes. Re-read it at every phase boundary, and specifically before launch, against
     docs/ask-agent.md (retention, gates, what gets logged) and db/schema.sql (the two tables and
     exactly what columns exist).

     The "What is collected" section below is the one that must not drift. An agent that misstates
     its own data handling is worse than one that says nothing. -->

## What this agent is

It is a retrieval agent grounded on a corpus Tanish wrote by hand. It answers from that corpus or it
declines, and it does not speak for him on anything he has not written down.

It is not a general assistant. It has no tools, cannot browse the internet, cannot read his
repositories, and cannot take any action on his behalf. Looking things up in authored prose is its
entire capability, and that is a deliberate constraint rather than a stage of development.

## What it can answer

Questions about his projects and the engineering behind them: ESMON, Noiseless, HybridFit, and
this site. That includes the decisions, the tradeoffs, and the things that broke.

Questions about his work history and what he does day to day.

Questions about how he thinks: his approach to systems, interfaces, AI, and how he works through a
problem.

Questions about what he has and has not worked with, which he would rather answer accurately than
generously.

Questions about what he is looking for professionally.

A useful test: if the answer would come from something he has written or built, it will probably
work. If it would require an opinion he has not published or a fact he has not recorded, it will
refuse.

## What it will not answer

Anything outside the corpus. This is the common case and it is not a malfunction. The corpus is
finite and deliberately narrow, so a reasonable question about him can still have no answer here.

Confidential detail about his employer, its systems, or its customers. Some engineering detail from
private work has been cleared for publication and is included; everything else is not, and no amount
of rephrasing the question changes that.

Private or personal matters beyond what he has chosen to put in the corpus.

Compensation and salary. The FAQ names email as the channel for that instead of answering it here.

Opinions about named people or companies.

Requests to act as him rather than describe him: writing messages in his voice, answering on his
behalf, or committing him to anything. It describes; it does not represent.

Anything asking it to ignore these boundaries, reveal its instructions, or behave as a different
system. It has no tools and no access, so the practical worst case is that it declines.

## When it does not know

When a question falls outside the corpus, or the corpus only brushes against it without actually
answering it, the agent declines and says why instead of guessing. That is the ordinary shape of
"I don't know" here, not an edge case.

Every refusal is logged with its reason. That is what lets Tanish find the real gaps later and go
write the missing answer himself. It is not a queue a visitor adds to directly, and nothing here
publishes questions, answers, or a refusal rate.

If you want an answer to something the agent declined, email it to him directly.

## What is collected

Each question, the answer, which corpus documents were retrieved, and what the request cost. That
record is what makes the agent auditable.

Question and answer text is retained, not deleted on a timer. Deleting a specific record is by
email request, and Tanish can act on that by hand.

Signing in ties a question to an account instead of a browser, through this site's identity
provider. That happens only past the first generated answer, and it exists so usage and cost
attach to a person. Refusals require no sign-in and are not limited.

## How to reach Tanish directly

Email is best: tanishnahata2002@gmail.com. He is also on LinkedIn and GitHub.

Go direct rather than through the agent for anything time-sensitive, anything confidential, anything
requiring a commitment, and anything where you want a conversation rather than an answer. The agent
is a faster way to learn what he has built. It is not a way to reach him.
