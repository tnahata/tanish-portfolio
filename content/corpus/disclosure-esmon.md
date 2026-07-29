---
id: disclosure-esmon
title: ESMON, Cleared Engineering Detail
kind: disclosure
route: null
verbatimOnly: true
clearedOn: 2026-07-28
---

<!-- Cleared for a commissioned project. The boundary here reflects Tanish's own judgment about the client relationship, not an employer clearance process. Vendor identity, binary format specifications, and commercial terms stay out regardless of how the rest of this file widens. -->

## Scope of this clearance

ESMON is not employer work. It is a commissioned project: a client engaged Tanish directly, he built it as the sole engineer, and it was delivered and sold alongside a railway vendor's locomotive hardware. No employer clearance process governs what he can say about it, so the boundary here is his own judgment call about the client relationship rather than a permission an employer grants. That widens what he is willing to say about the engineering, since the engineering is his to describe. It does not make the client relationship itself public property: the vendor's identity, the commercial terms, and the specifics of the binary formats stay with the client regardless of who is asking.

## What ESMON does

ESMON is a desktop analytics platform built for a railway speed and energy monitoring system. Monitoring devices on locomotives record journey data (speed, energy, events) as binary output that is unusable without dedicated software. Tanish delivered v1 as the sole engineer, replacing a legacy system that could not process the recorders' full data. ESMON imports that data from removable media or directly from the device, parses it into structured records, and surfaces it through filterable reports, time-series charts, and PDF exports.

## Why the accuracy bar is high

Reports produced by ESMON tie overspeed events to individual drivers, so a wrong record is not a cosmetic bug: it is a wrong claim about a specific person's driving. He built the reporting to be evidentiary-grade. Every import runs through invariant validation before anything reaches the database, and no value that is not directly derivable from a validated record is allowed to reach a report.

## How the parser handles bad data

The monitoring devices ESMON reads from produce binary output in multiple formats, and field data is never clean: partial writes, truncated files, and malformed records happen naturally. The parser rejects a whole file on a single corrupt record rather than guessing at what a damaged record might have meant, because a repaired guess that looks plausible is worse than an honest gap. Imports are atomic: a file lands in the database completely or not at all. A streaming binary parser keeps memory use flat regardless of how large the log file is, since nothing has to be held in memory all at once to be validated.

## Why it runs the way it does

ESMON has to run without internet access, since the devices operate in depots and field locations where connectivity cannot be assumed. Everything runs locally with no server dependency: the database is a single local file, analysis happens entirely on the machine, and analytics run at import time rather than waiting for a report to be requested. The people running it daily are non-technical operators on low-end, offline depot machines, which is also why the installers are zero-config: nothing to set up and nothing that depends on IT support that is not there.

## Two engineering problems worth naming

Building ESMON surfaced two problems worth naming on their own. First, a threading conflict between its UI framework and its PDF export pipeline, fixed by rendering charts offscreen so the two frameworks never fight over which one owns the rendering thread. Second, an early filter system that shared one state across every tab, fixed by giving each tab independent state behind one shared panel. Both are described in more depth on the case study page.

## Stack

ESMON's stack is Java 21, JavaFX, Spring Boot, SQLite, Apache PDFBox, Maven, and jpackage, producing signed installers for Windows and macOS from one CI pipeline.

## What is deliberately not covered here

This file does not name the vendor whose hardware ESMON is sold alongside, does not describe the specification or protocol behind the binary record formats, does not go into enough detail about corruption detection or the local database schema that someone could reconstruct the record layout from it, and does not cover the commercial or contractual terms of the work. None of that is a refusal to eventually discuss it. It is simply not his to make public, and being commissioned work rather than employer work does not change that; it only changes who gets to decide, and on those specifics, he has decided to keep them out.
