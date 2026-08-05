---
id: philosophy
title: How Tanish Thinks About Engineering
kind: page
route: /
---

## Systems thinking

His engineering philosophy borrows from systems thinking: every component has a purpose, every
interface a contract. Every system is a network of components, and most failures are failures of
the connections rather than of the parts.

The belief comes from a specific experience. The worst bug he has worked on was not inside any
single service. An API service at FedEx slept for eight seconds after creating a parent entity,
hoping a child entity's prerequisites had persisted somewhere downstream by the time it woke up.
Every component involved was individually correct. The system was wrong because two services had no
way to tell each other when they were done. The fix was not better code inside either service; it
was giving them a place to coordinate.

That pattern repeats often enough that he now looks for it first. When something is behaving badly
and every part looks fine, the problem is usually in the space between the parts.

## Interfaces as contracts

An interface is a promise about what a caller can rely on, which means the important part is what it
refuses to promise. He tries to make the boundaries of a system narrow and explicit, and to push
ambiguity to the edges where it can be resolved once instead of everywhere.

Noiseless is the clearest case. The pipeline owns orchestration, the chat surface owns the
user interface, and the database is the only state the two share. That boundary is the entire
design. Widen it, and decisions get lost or digests get duplicated, because two systems would
be making assumptions about state neither of them owns.

In ESMON it showed up smaller and more awkwardly. Several tabs needed independent filter state while
sharing one panel. The tempting version is one global filter object that every tab reads from, which
is convenient right up to the point where changing a filter in one tab silently changes what another
tab is showing. Separate contexts sharing a common shape cost more code and removed a class of bug
that would have been very hard to explain to a user.

## Clarity as a proxy for competence

Code that is hard to read is usually code whose author had not finished thinking. Clarity is not
politeness toward the next reader; it is evidence that the problem was actually understood.

The uncomfortable half of this belief is that it applies backwards. Most of the code he wrote a year
ago is harder to read than what he writes now, and not because his taste improved. It is because he
did not understand those problems as well as he thought he did at the time. He now treats "this is
difficult to explain" as a signal to go back rather than to add a comment.

It also means he is suspicious of cleverness in his own work before anyone else's. A clever solution
that needs a paragraph of justification is usually a sign that the model is wrong one level up.

## AI as substrate, not feature

He treats AI as a new substrate for building software rather than a feature to bolt onto something
that already exists. The distinction is about where the engineering happens. If a model call is a
feature, the work is prompt wording. If a model is a substrate, the work is everything around it:
what it is allowed to see, what it is allowed to do, what happens when it is confidently wrong, and
who is accountable for the output.

What this rules out, concretely:

Agents that act without a human in the loop on anything irreversible. When Noiseless still
drafted replies, zero were ever published without explicit approval; its current form removes the
publish surface entirely and optimises what a person sees instead of what they post.

Systems that spend money without a hard ceiling enforced before the work starts. A runloop bug
should cost a refusal, not a bill.

Retrieval systems that answer whenever they find something. Finding related text is not the same as
finding an answer, and a system that treats them as equivalent produces its most confident wrong
claims exactly where it is least equipped to notice.

The agent answering questions on this site is built on all three of those positions, which is the
most direct way he knows to argue them.

## How he works

He starts by trying to find the constraint that determines the design, because most other decisions
follow from it and arguing about them first wastes time. Offline-first on ESMON, decisions as
durable state on Noiseless, and one heterogeneous workout schema on HybridFit each fixed most of
the architecture the moment they were settled.

When he is stuck, he builds the smallest thing that will produce a real signal and uses it himself.
A lot of ESMON's interface came out of that loop: build it, use it, notice what feels wrong, change
it. He trusts what a working version tells him more than what a plan predicts, partly because he has
worked mostly without anyone senior to check the plan against.

He is deliberate about writing things down before building them when the cost of being wrong is
high, and impatient with documents when it is not.

## What he values

Asked directly, the list is short. Ownership: he would rather be responsible for a whole problem,
including the unglamorous load-bearing parts, than own a polished slice of someone else's answer.
Honesty about limits: he states what he has not done and what broke without softening either, and
he built this site's agent to refuse visibly rather than guess, because a system that admits what
it does not know is the only kind whose answers mean anything. Accountability for consequences:
nothing he builds publishes, spends, or acts irreversibly without a person approving it or a hard
ceiling enforced first.

Under those sits a temperament: consistency over intensity. He shows up on the bad weeks at reduced
intensity rather than abandoning the plan, finishes what he starts, and trusts what a working
version tells him over what a plan predicts. The failure mode he will name himself is persistence
past the point where a second opinion would have saved him time.

## What he has changed his mind about

He used to think caching was a performance tool. The Redis work at FedEx was not about speed at all.
The cache existed so two services could tell each other when something had finished, and the latency
improvement was a side effect of removing a hardcoded delay. Choosing it over a database table with
polling or a message broker came down to two features that happened to match the problem exactly:
expiring keys as a safety net, and notifications on key changes so nothing had to poll.

The general version, which he now believes more strongly: reach for infrastructure based on the
guarantees it gives you, not the category it belongs to. He has since argued the opposite direction
on his own project, cutting Redis out of this site's agent entirely and doing rate limiting and
spend control in Postgres, because there the guarantee he needed was transactional and the vendor
was not worth it.
