---
id: project-esmon
title: ESMON
kind: project
route: /projects/esmon
verbatimOnly: false
---

## What ESMON is

ESMON is a desktop analytics platform for the Indian Railway Speed and Energy Monitoring System. It
is commissioned work, sold alongside a railway vendor's locomotive hardware, and he built it as sole
engineer starting in January 2026, replacing a legacy system that could not process the recorders'
full data.

Monitoring devices on locomotives record detailed journey data: speed, energy, and events. Engineers
need to analyse and report on that data, but the raw output is binary and unusable without software
built specifically to decode it. ESMON is the application that bridges that gap. It imports
recordings from removable media or directly from the device over a serial connection, parses them
into structured data, and surfaces the result through filterable reports, time-series charts, and
composed PDF exports with an in-app preview before saving.

The people using it daily are operations engineers, not software engineers. That single fact decided
most of the interface. It had to be fast, reliable, and self-explanatory on both Windows and macOS,
with no tolerance for a workflow that requires someone to know how the internals work.

## The offline-first constraint

One constraint shaped the architecture from the start: the application has to work where internet
access cannot be assumed. The devices operate in remote areas, depots, and fieldwork settings where
connectivity is unreliable or simply absent. Running everything locally with no server dependency
was not a simplification, it was a requirement. Data stays on the machine, analysis happens offline,
and the tool works anywhere the device does.

Offline-first is easy to state and expensive to honour. Three things got harder.

Schema changes have to survive on a machine he will never see. There is no migration window and no
way to inspect the database before upgrading it, so the schema is versioned and created on first
run, and every change has to be applied blind on a file that may be several versions behind.

Nothing can be debugged remotely. There is no telemetry, no error reporting, and no logs he can pull
from a depot. Failures have to explain themselves in the interface at the moment they happen,
because the alternative is a phone call describing a dialog box.

Fixes ship as installers. There is no hotfix path. That pushes correctness work earlier than it
would otherwise land, and it is the main reason the parser is as defensive as it is.

## Binary parsing and data integrity

The devices produce binary output in multiple formats, each with its own structure, field layout,
and edge cases. Parsing it correctly means handling byte alignment, distinguishing valid records
from noise, and dealing with corruption that occurs naturally in field conditions: partial writes,
truncated files, malformed records. The parser had to be defensive enough to recover from bad data
without silently producing wrong results.

Those two goals pull against each other, and the resolution is the interesting part. Recovering
aggressively means guessing, and a guess that lands inside a plausible range becomes a wrong number
in a report that nobody can distinguish from a right one. Refusing anything imperfect means a single
bad byte in a long recording throws away a journey that is otherwise entirely readable.

The line he settled on: recover at the boundary between records, never inside one. A record that
fails its integrity check is dropped rather than repaired, and the import continues from the next
valid framing point. Imports are transactional, so a file either lands completely or not at all, and
what was skipped is surfaced rather than absorbed silently. The principle underneath is that the
application is allowed to say "this part was unreadable" and is never allowed to say a number that
it inferred.

## Designing without review

He had no designer, no senior engineer reviewing decisions, and no existing pattern to follow for
this kind of tool. Most of the design happened in cycles: build it, use it, notice what feels wrong,
change it.

The filter system is where that cost the most. The first version had one filter state shared across
every tab, which is the obvious design and reads as consistency. In use it was wrong. Someone would
narrow a date range to check one thing on the reports tab, move to graphs, and be looking at a
filtered subset without any signal that it had happened. The fix was four independent filter
contexts behind one shared panel, which is more code and more surface, and removed a class of
silently wrong output.

The general lesson he took from it was that consistency and correctness are not the same goal, and
that an interface which quietly changes what someone is looking at is a data integrity bug wearing a
UI costume. He would not have found it by reasoning about it. He found it by using the thing.

## The PDF threading deadlock

Embedding charts in PDFs meant rendering them as images during generation, but the UI framework and
the PDF pipeline have conflicting threading requirements. Rendering needs the UI thread; PDF
generation runs in the background. Getting the two to cooperate without deadlocking, particularly on
macOS, required finding where the conflict actually originated and then separating the rendering
step from the export pipeline entirely using offscreen rendering.

The diagnosis was slower than the fix. The failure was platform-specific and did not reproduce
reliably, which sent him down two wrong paths first: treating it as a race in his own export code,
then as a resource contention problem under large exports. Both theories explained some of the
evidence, which is what made them expensive. Neither explained why it was worse on macOS.

The actual answer was that the two frameworks each expect to own thread scheduling during rendering,
so the fix was not to coordinate them but to stop them from meeting. Charts render offscreen,
outside the export pipeline, and the export consumes images rather than triggering rendering itself.

## Outcomes

- Four independent filter contexts across tabs.
- Zero deadlocks in PDF generation after the offscreen fix.
- Two platform installers shipped from one CI pipeline, with no manual packaging steps.
- Record volume bounded by disk rather than by a server: local embedded database, no backend.

Imports, exports, and device downloads run on background workers so the interface stays responsive
throughout. Charts downsample large series automatically, which is what keeps a long journey from
becoming an unusable chart.

## Stack

Java 21, JavaFX with FXML, Spring Boot, Spring JDBC, SQLite, Apache PDFBox, Maven, jpackage, GitHub
Actions, and the BellSoft Liberica JDK.

JavaFX because the application has to be a real desktop program on two operating systems with no
runtime dependency on a browser or a server, and FXML keeps layout out of the logic. Spring Boot for
dependency wiring and lifecycle rather than for anything web-facing, with Spring JDBC instead of an
ORM because the queries are analytical and hand-written and an object mapper would be in the way.
SQLite because the entire premise is one local file that a user can copy, back up, and carry.
PDFBox because reports are composed rather than printed, so the export needs document-level control.
jpackage with the Liberica JDK to produce native installers that bundle a runtime, so no user is
ever asked to install Java. GitHub Actions builds all platform installers from one pipeline.

## Status

Finishing. He delivered v1 as sole engineer; it works end to end and is in use, but it has not been
through the volume of field conditions that would justify calling it done. The remaining work is
hardening rather than features: more real recordings through the parser, and more time on machines
he does not control.
