---
id: project-portfolio
title: This Site
kind: project
route: null
verbatimOnly: false
---

## What this site is

Tanish's portfolio, and the primary landing page linked from LinkedIn, GitHub, his resume, and
email. Built with Next.js on the App Router, TypeScript, and Tailwind, deployed on Vercel with
preview deployments on every branch push and production on the main branch.

A portfolio is a default artifact, so the only interesting thing about one is what it refuses to be.
This one is not a gallery of screenshots, not a list of technologies, and not a contact form. It is
a small number of case studies that argue for decisions, plus an agent that will tell you what it
does not know.

## Case studies over screenshots

Every project page follows the same structure: overview, the hard parts, outcomes, stack. The hard
parts section is the point, and it is deliberately the longest.

A screenshot shows that something exists. It cannot show why a filter system has four independent
contexts instead of one, or why a pipeline pauses for approval instead of publishing, and those
decisions are the actual work. So the project pages carry hand-drawn schematics rather than product
shots: an architecture diagram for ESMON, a pipeline for Noiseless. A diagram of a system is a
claim about how it is organised, which can be argued with. A screenshot is a claim that it renders.

The writing rules follow from the same position. No feature lists, no filler adjectives, and a
tradeoff named for every outcome claimed. Where a project is private, detail is abstracted to the
category rather than removed: "binary format" rather than a specification name.

## Design system

Deep navy background, electric cyan accent, indigo secondary, off-white text. Playfair Display for
display type, Space Grotesk for body, JetBrains Mono for code. Generous whitespace, three or four
colours maximum, mobile first, WCAG AA as the accessibility floor.

Playfair is used sparingly and that restraint is the whole reason it works: a display serif on a
dark technical page is striking exactly once per screen and becomes noise at the third use. The
colour ceiling exists for the same reason. With two accents, cyan reliably means "this is the thing
to look at". With five, nothing does.

## UTM tracking

Tagged links for every sharing destination live in one module and are used wherever the portfolio
URL is posted: LinkedIn bio, resume, GitHub profile, email signature. Analytics captures the
parameters from the landing URL, and a small client component persists them to session storage so
later events can be attributed to the source that brought someone in.

The honest assessment is that this is more infrastructure than the traffic currently justifies. It
was built because attribution is impossible to add retroactively: a link posted untagged is a
measurement that can never be recovered.

## The Ask Agent

The agent on this site answers questions about Tanish from a corpus he wrote by hand.

It cannot read the repository, cannot browse, and has no tools. Its only capability is retrieval
over authored prose. Source code reaches it only as excerpts quoted deliberately into a corpus file
with a permalink, because automated extraction has no notion of what is disclosable and would
re-expose exactly what the case studies abstract away.

It answers only when retrieval clears a similarity floor and the model, reading the passages it
retrieved, judges that those passages actually answer the question. Anything weaker is refused, with
the reason shown. Both checks exist because every document in the corpus is about the same person,
so a question it cannot answer still looks topically related, and a system that answers whenever
retrieval returns something would produce its most confident wrong claims exactly there. Refusing is
enforced structurally rather than by instruction: the generation step cannot be reached without a
value that only the grounding check can produce.

An earlier version required corroborating evidence from two separate documents. That rule was
removed after it was measured against real questions. The corpus is deliberately non-redundant, so
most facts live in exactly one file, and the rule refused questions the corpus answered in a single
sentence while passing questions it did not answer at all. Agreement between two documents was never
independent evidence in the first place, since the same person wrote both.

Questions it cannot answer are captured. He answers them, and published answers become part of the
corpus, so the blind spots turn into content rather than disappearing.

Three details are visible while it works: what it searched, what it found, and how strongly it
judged the evidence, streamed before the answer begins. That is the part he would defend hardest.
An assistant that shows its retrieval can be checked; one that only shows prose has to be trusted.

## Stack

Next.js on the App Router with TypeScript, Tailwind alongside hand-written CSS for the design
system, Vercel Analytics, and Vercel for deployment.

The agent adds Postgres on Neon with pgvector for the corpus and its embeddings, OpenAI for
embeddings, Claude for generation, Resend for the question queue, and Google sign-in for attribution
past the first generated answer. Deliberately no Redis: rate limits, login nonces, and spend
reservation live in Postgres, because what those need is transactional guarantees and adding a
second datastore to get them would have been a vendor for no gain.
