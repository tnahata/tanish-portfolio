# 01: Corpus

← [Index](README.md) · Prev: [00 Overview](00-overview.md) · Next: [02 Ingest](02-ingest.md)

**Decisions argued here**

| Decision | Rationale in one line |
|---|---|
| Authored prose only; repository source is never ingested | Extraction has no notion of what is disclosable |
| Fourteen files plus every blog post | Manifest below is the full allowed knowledge |
| `verbatimOnly` on `faq.md` and both disclosure files | Clearance was granted on authored sentences |
| `route: null` on files with no page | A citation to the case study page would look precise and be wrong |
| Citations link to a route, never a fragment | Case study pages carry no section `id` attributes |
| No automated drift check | Hashing source TSX fires on cosmetic SVG changes, so it gets bypassed |
| The current resume is the source of truth for facts | Facts change between drafts; one document has to win |
| ESMON's disclosure boundary is a client-relationship judgment, not an employer clearance | It is an independent commissioned project, not employer work |
| Resume content counts as already public | What let the disclosure files widen beyond the case study pages |
| Site says Discovery Agent, corpus says Noiseless; route and `id` unchanged | The live page is still at `/projects/discovery-agent`; citations must resolve |

---

**Authored prose only.** Repository source is never ingested: not the files, not a parsed
version, not a model-generated summary, not a snapshot searched at runtime.

Automated extraction has no notion of what is disclosable, so it re-exposes exactly what the case
studies deliberately abstract away ("binary format", not a spec name). Public is not the same as
disclosable-in-context either: a stale TODO or a test fixture with a real address is public and
still should not be quoted by an agent speaking for a named person.

`content/corpus/*.md` is what the agent is allowed to know. Facts may be richer than a page,
never leakier.

## Manifest

Fourteen authored files plus every blog post.

| File | Contents | Derived from |
|---|---|---|
| `identity.md` | Name, current role, what he builds, positioning, public contact channels | `Hero.tsx`, `About.tsx` |
| `philosophy.md` | Systems thinking, interfaces as contracts, clarity as a proxy for competence, AI as substrate not feature | `About.tsx` |
| `personal.md` | Hybrid athlete, logic puzzles, electronic music, and why those matter to how he works | `About.tsx` |
| `experience-fedex.md` | FedEx Corp. SWE (Jun 2024 to Dec 2025), SWE II (Dec 2025 to present). Metrics, tech, scope | `Experience.tsx` |
| `project-discovery-agent.md` | Pipeline stages, human-in-the-loop as foundation, cost enforcement, style grounding | case study |
| `project-esmon.md` | Offline-first constraint, binary parsing, designing without review, PDF threading deadlock | case study |
| `project-hybrid-fit.md` | Multi-discipline model, heterogeneous workout schema, N+1 and caching work | case study |
| `code-hybrid-fit.md` | **Quoted snippets** with SHA-pinned permalinks: workout schema, enrollment model, caching layer. Chosen, not searched | public repo |
| `project-portfolio.md` | This site: stack, design system, UTM tracking, why it exists | new |
| `stack.md` | Languages, frameworks, AI/ML, infra, tools. **Each group needs reasoning**; bare tag lists retrieve poorly | `app/stack/page.tsx` plus prose |
| `disclosure-esmon.md` | ESMON engineering detail cleared for public disclosure | private repo |
| `disclosure-discovery-agent.md` | Same, for Noiseless | private repo |
| `agent-boundaries.md` | What the agent will and will not answer, what is collected, how to reach Tanish | new |
| `faq.md` | What he is looking for, education, work authorisation, location and remote, availability, compensation, how to start a conversation | new |

**Not in v1:** opinions (`/opinions` is a placeholder), Claude Code practice (route exists locally
but is unshipped), repository source, private notes, the resume PDF.

## Facts and disclosure boundaries

**The current resume is the source of truth for facts.** Job titles are Full Stack Engineer,
Full Stack Engineer II, and Full Stack Engineer Intern; he is based in San Francisco. Where a
project file, `identity.md`, `experience-fedex.md`, or a live page disagreed with the resume, the
corpus was reconciled to match the resume rather than the page, on the reasoning that a document
someone submits under his name for a specific application is the most deliberate, most recently
reviewed statement of these facts. `components/Experience.tsx` on the live site still renders
"Software Engineer" / "Software Engineer II" rather than "Full Stack Engineer" / "Full Stack
Engineer II"; that gap is the corpus-drift risk this decision creates, tracked in
[13 Risks](13-risks.md), not something this ingest pipeline reconciles automatically.

**ESMON is an independent commissioned project, not employer work.** Its disclosure boundary
(`disclosure-esmon.md`) is therefore a judgment Tanish made himself about a client relationship,
not the output of an employer clearance process. Vendor identity, binary format specifications,
and commercial terms stay out regardless of how the rest of the file widens.

**Resume content counts as already public.** That is what allowed `disclosure-esmon.md` and
`disclosure-discovery-agent.md` to widen beyond what the case study pages themselves say: a fact
already sitting on a document handed out under his own name is not a new disclosure when it also
appears in a corpus file, even if the case study page abstracted it away.

**The site calls this project Discovery Agent; the corpus calls it Noiseless.**
`project-discovery-agent.md` and `disclosure-discovery-agent.md` both carry `title: Noiseless`,
while `route: /projects/discovery-agent` and the frontmatter `id: project-discovery-agent` are
deliberately left unchanged. The live page is still served at `/projects/discovery-agent`, and a
citation the agent emits has to resolve to a real route, so renaming the route or the slug to
match the corpus's name would break every existing and future citation to that project. Renaming
the site itself is explicitly out of scope for this work. This is a known, permanent naming
inconsistency between what a visitor reads on the page and what the agent calls the same project
in conversation, not an oversight to be cleaned up later. Tracked in [13 Risks](13-risks.md).

**`faq.md` and `identity.md` after the corpus audit.** `CORPUS-AUDIT.md` (in this directory) found
that work authorisation, location, availability, compensation, and education were each stated in
exactly one document, `faq.md`, which meant a recruiter question about any of them would score
`weak` and refuse despite the corpus holding the answer, since [04 Retrieval and
grounding](04-retrieval-grounding.md) requires two distinct corroborating documents for `strong`.
`identity.md` gained a brief "Current situation" section afterward, restating (not merely pointing
at) two of those facts, location and education, so those two now have real two-document
corroboration. Work authorisation, availability, and compensation still do not: `identity.md`'s
own "What he is looking for" section and its "Current situation" section both only point at the
FAQ for those three ("are covered in the FAQ", "are answered in the FAQ") rather than restating
the fact itself, and a pointer sentence is not a second statement of the answer even though it may
share enough vocabulary to pass a naive corroboration check. That gap is carried as an open risk
in [13 Risks](13-risks.md), including whether `agent-boundaries.md`'s mention of compensation as a
boundary happens to corroborate it for unrelated reasons.

## Frontmatter

```yaml
---
id: project-esmon           # stable key, the ingest primary key
title: ESMON
kind: project               # blog | project | code | disclosure | page | meta | asked
route: /projects/esmon      # citation link target; null when no page exists
externalUrl: https://...    # optional, e.g. a SHA-pinned GitHub permalink
verbatimOnly: false         # true = quote, never paraphrase
clearedOn: 2026-07-27       # disclosure files only
---
```

`route: null` on `faq.md`, `agent-boundaries.md`, `project-portfolio.md`, and both disclosure
files. Disclosure files deliberately hold detail their case-study page omits, so citing the page
would point somewhere precise-looking and wrong.

`verbatimOnly: true` on `faq.md` and both disclosure files. See
[04 Retrieval and grounding](04-retrieval-grounding.md).

**Blog files** carry `lib/blog.ts` frontmatter (`title`, `date`, `excerpt`, `featured`) and none of
the above. Ingest derives `id = 'blog-' + slug`, `kind = 'blog'`, `route = '/blog/' + slug`, and
strips `excerpt` before chunking since it duplicates the opening paragraph.

**Citations link to a route, not a fragment.** The case study pages carry no section `id`
attributes, so anchor links would land at the top of the page while appearing precise.

**No automated drift check.** Corpus files and pages can disagree. Hashing the source TSX to catch
it fires on cosmetic changes (those files are mostly SVG coordinates), so it would be routinely
bypassed. Case studies change a few times a year; keep drift manual. Tracked in
[13 Risks](13-risks.md).

## Chunking

Whether a document splits into more than one chunk is decided by its structure, not its size. A
document with zero or one heading section stays whole: there is nothing in it to separate. A
document with two or more `##`/`###` heading sections always splits on those headings, no matter how
short the whole document is.

- **This replaced a size-based shortcut.** `identity.md` and `faq.md` used to stay single chunks
  because they were short. That merged several unrelated facts into one embedding, which could bury
  a specific answer under everything else the document also says, and it over-returned on the
  verbatim path: the whole merged chunk got quoted, so asking about compensation in `faq.md` would
  drag work authorisation and availability into the answer alongside it.
- **Sections pack toward a token target, and the target changes for short documents.** The normal
  case packs sections toward roughly 800 tokens per chunk, closing a chunk once the next section
  would push it over. A document whose entire body is already under 800 tokens never trips that
  check, so packing toward 800 would just reassemble it back into a single chunk, the same outcome
  the old shortcut produced. For those documents (`faq.md` is the clear example, at six short
  sections) the packing target drops to roughly 200 tokens instead, which is what actually forces
  the split. That number was picked by hand against `faq.md`: tight enough to keep its sections
  topically separate, loose enough that its shortest section does not end up standing alone as an
  orphaned fragment.
- Adjacent chunks within one document still carry roughly 100 tokens of overlap across the
  boundary, so a cut does not strand a claim mid-sentence.
- A section that is already at or above the packing target on its own is never split mid-paragraph.
  Sections are the smallest authored unit, and a chunk that starts mid-argument retrieves worse than
  one that runs long.
- **HTML comments are stripped before chunking.** Authoring notes, scaffolding, and reminders
  live in `<!-- -->` and must never be embedded or quoted. Cheap to implement, and it makes
  comments safe to leave in permanently.

A chunk is the unit of retrieval, so every section has to stand alone. A section that only makes
sense after reading the one above it will be retrieved without it.

Splitting further does not weaken corroboration. The ~100 token overlap between adjacent chunks of
one document is exactly why corroboration requires two distinct documents rather than two chunks:
extra chunks inside a single document were never eligible to corroborate each other, so a document
splitting into more pieces changes nothing on that axis. See
[04 Retrieval and grounding](04-retrieval-grounding.md).
