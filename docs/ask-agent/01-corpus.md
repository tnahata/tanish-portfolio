# 01 — Corpus, chunking, ingest

← [Index](README.md) · Next: [02 Retrieval](02-retrieval.md)

**Authored prose only.** Repository source is never ingested: not the files, not a parsed version,
not a model summary. Automated extraction has no notion of what is disclosable, so it would
re-expose exactly what pages deliberately abstract away. `content/corpus/*.md` is what the agent
is allowed to know. Facts may be richer than a page, never leakier.

## Frontmatter

```yaml
---
id: project-esmon           # stable key, the ingest primary key (documents.slug)
title: ESMON
kind: project                # blog | project | code | disclosure | page | meta
route: /projects/esmon       # citation link target; null when no page exists
externalUrl: https://...     # optional, e.g. a SHA-pinned GitHub permalink
---
```

`route: null` on files with no page (an FAQ, a boundaries doc, a disclosure file that deliberately
holds detail its case-study page omits). Citing the page for those would point somewhere
precise-looking and wrong.

**`verbatimOnly` is gone.** Everything it protected (vendor identity, binary format specs,
commercial terms) is simply not in the corpus, so a paraphrase cannot leak it, and it over-returned:
asking about one fact in a multi-fact document quoted the whole chunk, dragging unrelated facts
along. Where "quote exactly" is still wanted, it's a prompt instruction, not a frontmatter flag.

**`clearedOn` is gone.** It modeled an employer clearance process for disclosure files that does
not exist for an independently commissioned project. Disclosure judgments are the author's own
call, not a dated artifact ingest enforces.

**Citations link to a route, never a fragment**: case study pages carry no section `id`
attributes, so an anchor link would land at the top of the page while looking precise.
**No automated drift check** either: hashing source TSX to catch corpus/page disagreement fires on
cosmetic changes (mostly SVG coordinates) and would be routinely bypassed, so it stays manual.

## Chunking

**One chunk per `##` section.** No packing, no overlap, no token targets. A heading section is an
authored unit: a long one stays whole, a short one stands alone. A document with zero or one
heading section stays whole too.

This deletes `TARGET_TOKENS`, `OVERLAP_TOKENS`, `SHORT_DOC_TARGET_TOKENS`, the packing loop, and the
overlap-tail function, along with the latent bug the single-target version admitted to: a short
document that needed to split and didn't was a chunking bug, previously tracked against a second
global instead of fixed. The corpus has 86 `##` headings, so roughly 86 chunks rather than 47, each
topically tighter, which suits specific questions better. Embedding cost at that size is pennies.

Headings are still detected structurally (a real markdown parser, not a line-by-line regex), so a
`## comment` inside a fenced code block is never mistaken for a heading — load-bearing specifically
because corpus files quote real code.

HTML comments are stripped before chunking: authoring notes must never be embedded or quoted.

A chunk is the unit of retrieval, so every section has to stand alone. A section that only makes
sense after the one above it will be retrieved without it.

## Ingest

Ingest is a reconciliation to a declared desired state, not a rebuild: read the files, compute what
the index *should* contain, diff against what it *does* contain, apply the difference, in one
transaction.

| Cause | Detected by | Action |
|---|---|---|
| Chunk text edited | `content_hash` differs | re-embed that chunk |
| Chunk removed (file shortened) | ordinal beyond the new chunk count | delete those rows |
| Whole document deleted from disk | set difference against the manifest | delete the document, cascade |
| Embedding model or dims changed | latest `ingest_completed` payload mismatch | forced full re-embed, re-tune thresholds |

**Deletion is driven by the desired-state set, not a per-file loop.** Iterating files on disk never
visits a deleted file, so a per-file loop leaves its rows retrievable forever:

```sql
delete from documents
 where slug <> all($1::text[]);   -- $1 = every slug found on disk
```

The sweep is unscoped: only ingest ever writes to `documents`/`chunks`, so there is no second
source of rows to protect. A gap answer is authored as a markdown file and committed like the rest
of the corpus, not written by the app at runtime.

**Ingest refuses to run against an empty desired corpus.** `slug <> all($1::text[])` with an empty
`$1` is vacuously true for every row, so an empty desired set (a bad working directory, a renamed
corpus folder) would delete every document and cascade to every chunk in one commit. Ingest checks
the corpus is non-empty before reading existing state, before any embedding call.

**A model change forces `--force`**: re-embed every chunk, re-tune `T_STRONG` / `T_FLOOR` against
the new space. Ingest runs manually while authoring and in CI when `content/` changes; not part of
the production build.
