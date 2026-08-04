---
id: ask-agent
title: The Ask Agent
kind: meta
route: null
---

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

Questions it cannot answer are logged with the reason, not captured through anything a visitor
clicks. There is no ask-him button and no publish step. Tanish queries the log for the questions
that keep recurring and decides by hand what is worth writing into the corpus. The blind spots are
visible to him; they do not turn into content on their own.

What streams before the answer is a status update, not a trace: no panel showing what it searched,
what it found, or how strongly it scored the evidence. That data is not thrown away: every turn
logs which chunks were retrieved. It is just never shown to the person asking. The half of the
pitch that survived is the stronger half anyway: an agent that refuses out loud with a reason,
instead of guessing past a thin match, is more checkable than one that displays its retrieval and
answers regardless.
