# Corpus Audit

> **2026-07-29 note:** this audit reasons throughout from the grounding ladder's original
> cross-document corroboration rule for `strong` (e.g. "strong grounding requires two distinct
> corroborating documents" below). That rule was removed and replaced with a model-judged
> answerability check; see [README.md](README.md)'s decision register and rejected-alternatives
> log for the reversal and the measurements behind it, and
> [04-retrieval-grounding.md](04-retrieval-grounding.md) for the mechanism that replaced it. This
> document is left as-is, a dated audit artifact, not rewritten to match.

Read: all 15 files in `content/corpus/`, `docs/ask-agent/01,04,07,09,10,11,12,13-*.md`,
`Tanish_Nahata-Resume.pdf`, `app/page.tsx`, `app/HomeClient.tsx`, `app/projects/*/page.tsx`,
`app/stack/page.tsx`, `app/opinions/page.tsx`, `components/About.tsx`, `components/Experience.tsx`,
`components/Footer.tsx`, `content/blog/thread-sleep-8000.mdx`.

`code-hybrid-fit.md` and `agent-boundaries.md` were mid-edit per the task brief. `code-hybrid-fit.md`
is genuinely unfinished (see 1.1). `agent-boundaries.md` and `faq.md` read as complete; findings
against them are reported as-is.

## Summary: blocking vs. worth improving

**Blocks shipping:**

- `code-hybrid-fit.md` has three unfilled `TODO` code blocks and three `Permalink: TODO` — the file
  cannot ship in this state (1.1).
- `faq.md` is single-document for every fact it carries (work authorization, remote preference,
  compensation redirect, availability). Per `04-retrieval-grounding.md`, strong grounding requires
  two distinct corroborating documents. As written, a recruiter asking "does he need sponsorship" or
  "is he open to remote" gets `weak` and a refusal, not the verbatim answer, because nothing else in
  the corpus states these facts (4.1–4.4).
- No corpus file covers education. "Where did he go to school" / "what's his degree" has zero
  coverage despite being one of the most likely recruiter questions (2.1, 4.5).
- Two contradictions beyond the two known ones: ESMON's live status badge says "Finishing" while the
  corpus twice says "Beta" (3.3); HybridFit's live case-study page states "20×" concurrency in one
  paragraph and "5×" three paragraphs later, and the corpus agrees with "5×" only (3.4).
- The resume (`Tanish_Nahata-Resume.pdf`, linked from `Footer.tsx`) disagrees with the corpus and
  live site on job title, a headline metric, and HybridFit's build status (3.5–3.8). It is public
  collateral pointing at the same person; a recruiter will open both.

**Worth improving, not blocking:**

- HybridFit's "5× more concurrent users" outcome — the flagship metric on its own case study page —
  is stated in exactly one corpus document (4.6).
- The disclosure files restate their paired project files closely enough that "two distinct
  documents" may sometimes mean "one fact, written twice by the same author" rather than independent
  corroboration (5.1–5.3).
- Several quantified claims live only on the site (`Experience.tsx`) with no corpus presence at all:
  "5,000+ facilities," "350+ facilities," "4 major releases," "25+ engineers," "500+ managers,"
  "90% fewer escalations" (4.7).
- AWS appears in the resume's skills list but nowhere in `stack.md`, including its explicit "What he
  has not used" section, which does not address cloud platforms at all (4.8).

---

## 1. Remaining placeholders and unfinished content

### 1.1 `content/corpus/code-hybrid-fit.md` — BLOCKING, `verbatimOnly` adjacent

This file's frontmatter is `verbatimOnly: false`, but its entire reason for existing is to carry
SHA-pinned code quotes, and those quotes are the unfinished part:

- Line 46: `// TODO: paste the session schema here, 15 to 30 lines`
- Line 49: `Permalink: TODO`
- Line 62: `// TODO: paste the enrollment model here`
- Line 65: `Permalink: TODO`
- Line 78: `// TODO: paste the caching layer here`
- Line 81: `Permalink: TODO`

The file's own HTML comment (lines 10–23) explicitly instructs the author to pin real commit SHAs
before shipping and to delete the comment when done. Neither has happened. If ingested as-is, any
question about HybridFit's schema, enrollment model, or caching code retrieves prose describing code
that isn't there.

### 1.2 `docs/ask-agent/12-delivery.md` — stale, not corpus-facing

Line 75 says both disclosure files "carry `clearedOn: TODO`" and ingest is blocked on that. This is
now false: `disclosure-esmon.md` and `disclosure-discovery-agent.md` both carry
`clearedOn: 2026-07-28` (checked directly). Not a corpus content issue and not user-facing, but the
delivery doc's build-status table is out of date and will mislead whoever reads it next.

### 1.3 No other placeholders found

Grepped `content/corpus/` and `docs/ask-agent/` for `TODO|TBD|FIXME|fill this in|placeholder|XXX`.
Nothing else in `content/corpus/` matched. The `TBD` hits in `docs/ask-agent/` are all the known,
already-tracked `T_STRONG`/`T_SUPPORT`/`T_FLOOR` threshold placeholders in
`04-retrieval-grounding.md` and `README.md`, which the docs themselves say are deferred to Phase 2.
Not a corpus-content gap.

---

## 2. Facts only the user can supply

Cross-referencing the resume against the corpus surfaced several facts the corpus needs but cannot
derive from the repo. Full question list at the end of this section.

- **Education.** The resume lists University of Wisconsin–Madison, BS Computer Science and Data
  Science, Sep 2020–May 2024, GPA 3.94, Dean's List, Undergraduate Scholar for Summer Study. None of
  it is in `identity.md` or anywhere else in the corpus. This is a fact, not a judgment call — it
  needs to go in or be deliberately excluded.
- **Prior roles.** The resume lists a FedEx "Full Stack Engineer Intern" (Jun–Aug 2023) and a
  "Student Developer" role at the Space Science and Engineering Center (Feb–Jul 2023, NOAA-funded
  wildfire visualization work, React + Leaflet + PHP). Neither appears anywhere in the corpus.
  `experience-fedex.md` starts the timeline at June 2024 with no acknowledgment of an earlier
  internship at the same employer.
- **HybridFit timeline and status.** The resume dates HybridFit "Aug 2025 – Present" and describes
  Pinecone-based semantic search and vector embeddings in the present tense, as already engineered.
  `project-hybrid-fit.md` explicitly says the recommendation engine "does not exist yet" and Pinecone
  is "a planned dependency rather than a used one." One of these is wrong, or the resume is stale.
- **AWS.** The resume's skills list includes AWS under DevOps & Tools. `stack.md`'s infrastructure
  section (Docker, Vercel, PostgreSQL, Redis, MongoDB) and its "What he has not used" section are
  both silent on cloud platforms — it neither confirms nor denies AWS experience.
- **Phone number.** The resume lists (608) 471-3774. `identity.md`'s "Where to find him" section
  lists only email, GitHub, LinkedIn, X. This may be deliberate (phone is not something an agent
  should hand out), but it's worth confirming rather than assuming.

### Questions for Tanish

1. Should his UW-Madison degree (BS, Computer Science and Data Science, 2020–2024, GPA 3.94) be added
   to the corpus, and if so, any honors or coursework worth including?
2. Should the FedEx internship (Jun–Aug 2023) and the Space Science and Engineering Center role
   (Feb–Jul 2023) be added to the corpus, given the public resume lists them?
3. Is his correct title "Software Engineer / Software Engineer II" (corpus and live site) or "Full
   Stack Engineer / Full Stack Engineer II" (resume)?
4. For the Redis story, which number is accurate: "eight seconds to under two" (corpus, ~75%
   reduction) or "cut backend response latency by 60%" (resume)?
5. Is HybridFit's semantic search / recommendation engine actually live now, or still planned as the
   corpus states?
6. Should ESMON's live status badge read "Beta" (matching the corpus) instead of "Finishing", or
   should the corpus's "Beta" language be updated to match "Finishing"?
7. For HybridFit's concurrency improvement, is it "5×" (corpus and the page's own Outcomes tile) or
   "20×" (the same page's Hard Parts paragraph)?
8. Has he used AWS in a way worth adding to `stack.md`, given the resume lists it but the corpus is
   silent?
9. Should a phone number appear anywhere in the corpus, or is email-only intentional?
10. Should the resume PDF be updated to match the corpus/site facts before this ships, since it's
    linked from the footer and a visitor may open both side by side?

---

## 3. Contradictions

### Known (being fixed elsewhere)

- (a) `project-esmon.md` stack section says "Java 17" (line 113); the live ESMON page
  (`app/projects/esmon/page.tsx` line 283) and `disclosure-esmon.md` (line 26) both say "Java 21."
- (b) `project-esmon.md` outcomes say "Three platform installers shipped from one CI pipeline" (line
  104); the live ESMON page's outcomes tile says "2" (`app/projects/esmon/page.tsx` line 261) and
  `disclosure-esmon.md` says "producing signed installers for Windows and macOS" (i.e. two).

### New

**3.1 ESMON status: "Finishing" vs. "Beta."**
`app/projects/esmon/page.tsx` line 159 renders a live status badge reading "Finishing." The corpus
frames the entire project around beta status: `project-esmon.md` line 12 ("It is in beta"), and its
dedicated "## Status" section, line 127: "Beta. It works end to end and is in use, but it has not
been through the volume of field conditions that would justify calling it finished."
`disclosure-esmon.md` line 18 also says "currently in beta." A badge reading "Finishing" reads as
materially closer to done than three separate corpus statements insisting it deliberately is not.

**3.2 HybridFit concurrency: "20×" vs. "5×," including a self-contradiction on the live page.**
`app/projects/hybrid-fit/page.tsx` line 218 (Hard Parts, "Performance at Scale"): "The result was a
projected 20× increase in concurrent user capacity." The same page's own Outcomes tile, line 254:
"5× — More concurrent users after connection pool tuning." `project-hybrid-fit.md` agrees with the
Outcomes tile: "Separately, tuning the connection pool let the application serve roughly five times
the concurrent users before degrading" (line 58) and "Roughly five times more concurrent users after
connection pool tuning" (line 86). The corpus is internally consistent; the live page is not, and the
corpus is only two-thirds correct against its own source of truth.

**3.3 Resume job title vs. corpus and live site.**
`Tanish_Nahata-Resume.pdf`: "Full Stack Engineer II" (Dec 2025–Present) and "Full Stack Engineer"
(Jun 2024–Present, itself wrong — see 3.5). `identity.md` line 11–12, `experience-fedex.md` lines
9–13, and `components/Experience.tsx` lines 8 and 31 all say "Software Engineer" / "Software Engineer
II." Three sources agree against one.

**3.4 Redis latency metric: "60%" vs. "eight seconds to under two."**
`Tanish_Nahata-Resume.pdf`: "cut backend response latency by 60%." `experience-fedex.md` line 86:
"the typical time from submission to a correct screen went from over eight seconds to under two,"
which is roughly a 75% reduction, and `content/blog/thread-sleep-8000.mdx` line 66 states the same
"8+ seconds ... to under 2 seconds." Two sources agree with each other and disagree with the resume's
number.

**3.5 Resume date error, internal to the resume.**
`Tanish_Nahata-Resume.pdf` lists "Full Stack Engineer II ... Dec 2025 - Present" directly above
"Full Stack Engineer ... Jun 2024 - Present" — both roles show "Present" as the end date, which is
internally inconsistent on its face and disagrees with the corpus's clean Jun 2024–Dec 2025 /
Dec 2025–present split (`identity.md` lines 11–12, `experience-fedex.md` lines 9–13).

**3.6 HybridFit build status: resume present-tense vs. corpus "not built yet."**
`Tanish_Nahata-Resume.pdf`: "Engineering the backend with REST APIs, MongoDB, semantic search
(Pinecone), and vector embeddings to personalize workouts based on user history" — present tense,
implies shipped. `project-hybrid-fit.md` line 95: "The recommendation engine the ingestion pipeline
was built to feed does not exist yet; Pinecone is in the stack as a planned dependency rather than a
used one." Direct contradiction on whether this feature exists.

**3.7 CSV ingestion metric present on resume and live site, absent from corpus.**
`Tanish_Nahata-Resume.pdf` and `components/Experience.tsx` line 40 both claim "100+ hrs saved" /
"save 100+ hours of manual input per batch" for the bulk CSV ingestion work. `experience-fedex.md`
describes the same work (line 53) with no hours-saved figure at all. Not a contradiction so much as
an unverified number that two public sources state and the corpus doesn't — worth deciding whether to
add it or leave it out deliberately.

**3.8 Live site quantified claims with zero corpus presence.**
`components/Experience.tsx` states "5,000+ facilities" (line 12), "350+ facilities" (line 16), "4
major releases" (line 20), "25+ engineers" (line 24), "500+ managers" (line 43), and "90% fewer
escalations" (line 35). None of these six numbers appear anywhere in `experience-fedex.md`. This
isn't strictly a contradiction (the corpus doesn't say anything different), but it means a visitor
who just read these numbers on the homepage and asks the agent about them will get no corroboration
or, depending on retrieval, a refusal on a fact the same site states elsewhere on the page.

---

## 4. Retrieval gaps at `strong` grounding

Grounding requires a top match plus at least two supporting chunks from at least two distinct
documents (`04-retrieval-grounding.md` line 34). Worked through roughly twenty realistic visitor
questions below; only the failures and near-failures are listed.

**4.1 "Does he need visa sponsorship?" / "Is he on a visa?" — FAILS.**
Only `faq.md` states this (lines 20–22): H-1B, transferable. No other corpus file mentions H-1B,
visa, or sponsorship at all (checked via grep across all of `content/corpus/`). `identity.md` line 67
only points at the FAQ ("Specific questions about ... work authorisation ... are answered in the
FAQ") without restating the fact — that sentence might accidentally supply enough keyword overlap to
pass as a second "supporting chunk" without actually containing the answer, which would be a false
pass, not real corroboration. Either way this is one of the single highest-value recruiter questions
on the whole site and it is single-sourced.

**4.2 "Is he open to remote work?" — FAILS.**
Only `faq.md` lines 26–27. Same single-document problem as 4.1, same weak pointer sentence in
`identity.md` as the only other candidate.

**4.3 "When can he start?" / "What's his availability?" — FAILS.**
Only `faq.md` lines 31–34.

**4.4 "What does he charge / what's his comp expectation?" — FAILS, arguably by design.**
`faq.md` lines 36–39 redirects to email. `agent-boundaries.md` line 56 also mentions compensation,
but only to say the agent won't answer it — that's a second document, but it states a boundary, not
an answer, so it's unclear whether it would actually satisfy the grounding check as genuine
corroboration or just add topical noise. Worth an explicit eval-set check rather than an assumption.

**4.5 "Where did he go to school?" — FAILS, zero coverage.**
No corpus file mentions university, degree, GPA, or coursework at all (grep confirmed empty). This
is not a weak-grounding case, it's a "none" case: nothing in the corpus is even topically close. See
category 2, question 1.

**4.6 "How much did the connection pool tuning help HybridFit?" — LIKELY FAILS.**
The "5×" figure lives only in `project-hybrid-fit.md` (lines 58 and 86, same document, two
mentions). No other corpus file states this number or restates the connection-pool story. This is
the third bullet of HybridFit's own Outcomes section — a fact a reader of the case study would
directly ask about — and it has no second source.

**4.7 "How big is the system he works on at FedEx?" — FAILS.**
No corpus file gives facility count, engineer count, or manager count for the FedEx platform, despite
these being prominently displayed on the homepage (`components/Experience.tsx`, see 3.8). A visitor
reading the homepage and then asking the agent to elaborate gets nothing.

**4.8 Questions that pass, checked for completeness:**
- "What broke while building ESMON?" — covered by `project-esmon.md` primarily, `philosophy.md`
  corroborates via the filter-context retelling and `disclosure-esmon.md` also restates it (see 5.1
  on whether that restatement counts as independent). Already flagged as thin in `10-ui.md` line 36;
  this audit agrees it's the weakest of the three starter chips but does clear two distinct files.
- "How does Discovery Agent keep a human in the loop?" — three distinct documents
  (`project-discovery-agent.md`, `philosophy.md`, `identity.md`) converge; solid.
- "What's he like to work with?" — three distinct documents (`personal.md`, `identity.md`,
  `philosophy.md`) converge; solid.
- "What is he not good at / what hasn't he done?" — `stack.md`'s "What he has not used" section plus
  `identity.md`'s "What he is not" paragraph (line 47–51) are two distinct documents on the same
  claim; passes.
- "Why Postgres over Redis for this site's agent?" — `stack.md` and `philosophy.md` both cover it
  independently with different framing; passes, though see 5.3 on how independent the framing really
  is.
- "What's the eight-second sleep bug?" — `experience-fedex.md`, `philosophy.md`, and the blog post
  (`thread-sleep-8000.mdx`) all cover it; three distinct sources, solidly passes.

---

## 5. Near-duplicate text across documents

The concern here is specific: two documents that count as "distinct" for the corroboration rule but
that carry the same authored sentence restated, which is one claim counted twice rather than two
independent statements of it.

**5.1 Discovery Agent cost enforcement — near-verbatim across two files.**

`project-discovery-agent.md` lines 49–52:
> "Cost enforcement runs before any work begins. Session and daily limits are checked independently
> for reads and writes, because they fail differently: a runaway read loop is expensive and harmless,
> while a runaway write loop is expensive and public. Every external action gets a durable audit log
> entry before the call is made, so a crash mid-request leaves a record rather than a mystery."

`disclosure-discovery-agent.md` lines 21–22:
> "Cost enforcement runs before any work begins, not after. Session and daily limits are checked
> independently for reads and writes, since a runaway read loop is expensive and harmless while a
> runaway write loop is expensive and public, and every external action gets a durable audit log
> entry before the call is made."

Same sentence structure, same specific phrases ("runaway read loop is expensive and harmless,"
"runaway write loop is expensive and public," "audit log entry before the call is made"). A question
about cost-enforcement ordering would retrieve both, technically satisfying "two distinct documents,"
while actually resting on one authored claim.

**5.2 Discovery Agent approval-as-foundation — same pattern.**

`project-discovery-agent.md` lines 34–39 ("The distinction that matters is that approval is the
foundation rather than a safety feature added on top... Zero posts have been published without
explicit human approval, and that is a property of the architecture rather than a policy anyone has
to remember") vs. `disclosure-discovery-agent.md` line 20 ("Approval is the architectural foundation,
not a feature added afterward... Zero posts have been published without explicit approval"). Same
underlying sentence, restated.

**5.3 ESMON offline-first constraint and defensive parsing — same pattern, and structural.**

`project-esmon.md` lines 27–31 vs. `disclosure-esmon.md` lines 18–20 restate the offline-first
requirement in near-identical terms ("connectivity cannot be assumed," "runs locally with no server
dependency," "data stays on the machine" / "analysis happens entirely on the machine"). Same for the
defensive-parsing description at `project-esmon.md` lines 47–52 vs. `disclosure-esmon.md` line 22.

This is not an accident in either ESMON or Discovery Agent's case: `disclosure-esmon.md` line 14
states its own design intent directly — "everything below restates what the public case study page
already says, in the same terms and no further." That's a deliberate, documented choice
(`01-corpus.md` explains why: clearance was granted on authored sentences, not paraphrases, so
disclosure files can't freely reword). The tradeoff is structural: every fact that lives in both a
project file and its paired disclosure file gets "two distinct documents" almost for free, without
genuine independent corroboration. This is worth being aware of rather than fixing — the mechanism
exists for a real reason — but it means the corroboration bar is measurably softer for ESMON and
Discovery Agent facts than for facts that only live in one place (like everything in section 4).
