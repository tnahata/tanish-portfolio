---
id: code-hybrid-fit
title: HybridFit, Selected Code
kind: code
route: /projects/hybrid-fit
externalUrl: https://github.com/tnahata/hybrid-fit
---

## Why there is code here at all

Repository source is never ingested, searched, or summarised. The agent cannot read a codebase, and
nothing here was extracted automatically. These are three excerpts chosen by hand, quoted, and
pinned to a commit so the link keeps pointing at the code that was actually being described.

HybridFit is the only open source project on this site, so it is the only one where the reasoning
can be checked against the implementation rather than taken on trust.

## The workout schema

The schema is the design decision the rest of HybridFit follows from. A strength session and a 5K
run share almost no fields, and both have to be logged by one interface and queried together across
a training week.

The shape below is a common session envelope carrying what every workout genuinely shares (type,
date, plan, duration, effort) with a typed payload underneath that differs by discipline. Queries
that span disciplines read only the envelope. The logging UI switches on type at exactly one
boundary rather than throughout the component tree.

```ts
	date: Date;
	workoutTemplateId: string;
	status: "completed" | "skipped" | "missed";
	notes?: string;

	durationMinutes?: number;
	perceivedEffort?: number;
	activityType?: string;
	sport?: string;

	distance?: {
		value: number;
		unit: "miles" | "kilometers";
	};
	pace?: {
		average: number;
		unit: "min/mile" | "min/km";
	};

	strengthSession?: {
		exercises: Array<{
			exerciseId: string;
			exerciseName: string;
			sets: Array<{
				setNumber: number;
				reps: number;
				weight: number;
				completed: boolean;
			}>;
		}>;
		totalVolume: number;
		volumeUnit: "kgs" | "lbs";
	};
```

Permalink: https://github.com/tnahata/hybrid-fit/blob/4ed16d3f873bfcb5c10ef919315a4fd70fe60b97/src/models/User.ts#L5-L37

The cost of this shape is that a new workout type needs a payload definition and a UI branch. It
cannot be added through configuration alone. That has been worth it, because disciplines arrive
rarely and a schema that quietly permits meaningless combinations is expensive forever.

## The enrollment model

Multi-plan enrollment is what makes HybridFit different from a single-discipline tracker. A user can
be six weeks into a strength block and simultaneously three weeks into a half-marathon build, and
the calendar has to render both without either plan assuming it owns the week.

```ts
export interface UserPlanProgress {
	planId: string;

	startedAt: Date;
	completedAt?: Date;
	currentWeek: number;
	currentDayIndex: number;
	isActive: boolean;

	overrides: WorkoutOverride[];
	progressLog: WorkoutLog[];
}

export interface UserDoc extends Document {
	email: string;
	name: string;
	passwordHash?: string;

	trainingPlans: UserPlanProgress[];
```

Permalink: https://github.com/tnahata/hybrid-fit/blob/4ed16d3f873bfcb5c10ef919315a4fd70fe60b97/src/models/User.ts#L74-L92

The thing to notice is that a plan does not own dates. Enrollment is the join between a plan and a
user's calendar, which is what allows two plans to overlap, and what allows a plan to be paused or
shifted without rewriting the sessions inside it.

## The caching layer

This is the code behind the 99.76 percent reduction in database queries on static routes. The
exercise library is the clearest case: over a thousand entries that are identical for every user and
were being read from the database on every request.

```ts
export const revalidate = 3600; // Revalidate every 1 hour
export const dynamic = 'force-static'; // Force static rendering for caching

export async function GET() {
	try {
		await connectToDatabase();

		const [total, exercises] = await Promise.all([
			Exercise.countDocuments({}),
			Exercise.find({}).lean() // Use .lean() for plain objects (better caching)
		]);

		return NextResponse.json({
			data: exercises,
			meta: {
				total
			},
		});
```

Permalink: https://github.com/tnahata/hybrid-fit/blob/4ed16d3f873bfcb5c10ef919315a4fd70fe60b97/src/app/api/exercises/route.ts#L5-L22

Two things are doing the work, and only one of them is the cache. Responses for content that does
not vary per request are cached outright. Everything else got field projections, so the queries that
remain return the fields the route actually renders rather than whole documents. The projections
mattered more than the cache did on the routes that could not be cached at all.

## What these snippets are not

They are three excerpts, chosen because they explain decisions described elsewhere in this corpus.
They are not a tour of the codebase, not the most interesting code in it, and not enough to review
the project from.

The agent quoting them cannot open the repository, cannot search it, and cannot tell you what any
other file contains. If a question needs code that is not one of these three, the honest answer is
that it is not available here, and the repository is public for anyone who wants to look.
