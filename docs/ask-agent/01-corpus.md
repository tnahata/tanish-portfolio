# 01 — Corpus

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
| `faq.md` | Opportunities, work authorization, remote preference, what he is looking for | new |

**Not in v1:** opinions (`/opinions` is a placeholder), Claude Code practice (route exists locally
but is unshipped), repository source, private notes, the resume PDF.

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
