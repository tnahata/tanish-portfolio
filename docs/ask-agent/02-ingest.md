# 02 — Ingest and embedding lifecycle

← [Index](README.md) · Prev: [01 Corpus](01-corpus.md) · Next: [03 Data model](03-data-model.md)

**Decisions argued here**

| Decision | Rationale in one line |
|---|---|
| Reconcile to a declared desired state, not rebuild | A per-file loop never visits a deleted file, so its rows retrieve forever |
| Embeddings inline on the chunk row | No separate vector store to keep in sync |
| Deletion sweep scoped to `source = 'file'` | Published gap answers are runtime rows and must survive ingest |
| Model change forces `--force` re-embed and a threshold re-tune | Thresholds are calibrated to one embedding space |
| Ingest runs manually and in CI, not in `next build` | Content changes are not deploy-shaped |

---

**Ingest is a reconciliation to a declared desired state, not a rebuild.** Read the files, compute
what the index *should* contain, diff against what it *does* contain, apply the difference.

Embeddings are stored inline on the chunk row: one chunk, one `vector(1024)` (voyage-3.5-lite's
default dimensionality). There is no separate vector store to keep in sync, which removes an
entire class of drift.

**Four things make an embedding stale**, and each is detected differently:

| Cause | Detected by | Action |
|---|---|---|
| Chunk text edited | `content_hash` differs | re-embed that chunk |
| Chunk removed (file shortened) | `ordinal` beyond the new chunk count | delete those rows |
| Whole document deleted from disk | **set difference** against the manifest | delete the document, cascade |
| Embedding model or dims changed | `corpus_meta` mismatch | forced full re-embed, re-tune thresholds |

The third row is the one an earlier draft got wrong. Iterating files on disk never visits a
deleted file, so its rows survive and keep being retrieved forever. **Deletion has to be driven by
the desired-state set, not by a per-file loop:**

```sql
begin;
-- 1. upsert documents present on disk, by slug
-- 2. per document: re-embed only chunks whose content_hash changed,
--    upsert on (document_id, ordinal)
-- 3. drop chunks whose ordinal exceeds the new chunk count
-- 4. the sweep: anything file-sourced that disk no longer declares
delete from documents
 where source = 'file'
   and slug <> all($1::text[]);   -- $1 = every slug found on disk
-- 5. update corpus_meta
commit;
```

One transaction, so MVCC keeps concurrent readers on the previous snapshot until commit. No
window where the index is empty.

Unchanged chunks are not re-embedded. At 150 chunks that is a rounding error either way, but the
reconcile shape is what makes step 4 correct, and correctness is the reason to prefer it over
delete-everything.

**`source` is why reconcile matters here.** Documents come from two places: corpus files, and
published gap answers written at runtime. Scoping the sweep to `source = 'file'` leaves runtime
rows alone automatically. A delete-everything rebuild would wipe published answers and require
reading them back out of `gap_questions` to restore them.

**Model change is the one case that needs a forced full re-embed.** `npm run ingest --force`
re-embeds every chunk and rewrites `corpus_meta`. Until it runs, the query path 503s on the
mismatch rather than scoring new query vectors against an index built in a different space.
Thresholds are calibrated to that space, so a model change also invalidates `T_STRONG`,
`T_SUPPORT`, and `T_FLOOR`: treat it as a re-tune, not a swap. See
[04 Retrieval and grounding](04-retrieval-grounding.md).

**Historical tracking is unaffected by any of this**, because `turns.retrieved` stores a snapshot
of what was read rather than pointers into an index that keeps changing. See
[03 Data model](03-data-model.md).

`npm run ingest` runs manually while authoring, and in CI on push to `main` when `content/`
changes. Not part of `next build`.

**Published gap answers reach the corpus without a deploy.** Publishing writes a `documents` row
with `source = 'asked'`, `kind = 'asked'`, `route = '/asked'` and embeds it inline with one Voyage
call, so the next visitor gets the answer immediately. See [09 Gap queue](09-gap-queue.md).
