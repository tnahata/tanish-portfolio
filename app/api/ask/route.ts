import { randomUUID } from 'node:crypto';

import { auth } from '@clerk/nextjs/server';
import { checkBotId } from 'botid/server';
import { createUIMessageStream, createUIMessageStreamResponse, type UIMessageStreamWriter } from 'ai';
import { after, NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

import type { ReadyTurn } from '@/lib/ask/ask';
import { prepareTurn, runTurn } from '@/lib/ask/ask';
import { ANON_COOKIE_MAX_AGE_SECONDS, ANON_COOKIE_NAME, MAX_QUESTION_CHARS } from '@/lib/ask/config';
import type { Gated } from '@/lib/ask/log';
import { EmptyIndexError, IngestConfigMismatchError } from '@/lib/ask/retrieve';
import type { Identity, LockedReason } from '@/lib/ask/types';

/**
 * POST /api/ask. Responds 200 with a UI message stream carrying `status`, `answer`,
 * `refusal` and `gate` parts; never a bare 401 or 429, because useChat routes non-2xx to
 * onError and would never render the inline sign-in interstitial. Order is in docs/ask-agent.md.
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

const askRequestSchema = z.object({
  question: z.string().trim().min(1).max(MAX_QUESTION_CHARS),
});

type StatusStage = 'received' | 'generating';

function statusChunk(stage: StatusStage) {
  return { type: 'data-status' as const, data: { stage }, transient: true };
}

function refusalChunk(reason: LockedReason, text: string) {
  return { type: 'data-refusal' as const, data: { reason, text } };
}

function gateChunk(gate: Gated) {
  return {
    type: 'data-gate' as const,
    data: { reason: gate.reason, resetsAt: gate.resetsAt ? gate.resetsAt.toISOString() : null },
  };
}

async function parseAskRequest(request: NextRequest): Promise<{ question: string } | null> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }
  const parsed = askRequestSchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

/** A thrown or unconfigured Clerk auth() is treated as anonymous; it must never crash the route. */
async function resolveClerkUserId(): Promise<string | null> {
  try {
    const { userId } = await auth();
    return userId;
  } catch {
    return null;
  }
}

/**
 * Clerk userId when signed in. Otherwise the anon cookie, validated as a uuid and never trusted
 * when it fails validation. `mintedAnonId` is set only when a fresh id was generated, which is
 * the only case the caller needs to set a cookie on the response.
 */
async function resolveIdentity(
  request: NextRequest,
): Promise<{ identity: Identity; mintedAnonId: string | null }> {
  const userId = await resolveClerkUserId();
  if (userId) {
    return { identity: { userId, anonId: null }, mintedAnonId: null };
  }

  const cookieValue = request.cookies.get(ANON_COOKIE_NAME)?.value;
  const validCookie = cookieValue ? z.uuid().safeParse(cookieValue) : null;
  if (validCookie?.success) {
    return { identity: { userId: null, anonId: validCookie.data }, mintedAnonId: null };
  }

  const anonId = randomUUID();
  return { identity: { userId: null, anonId }, mintedAnonId: anonId };
}

/** Serializes the anon cookie the way it needs to be set: httpOnly, secure, sameSite lax. */
function serializeAnonCookie(anonId: string): string {
  const carrier = new NextResponse();
  carrier.cookies.set(ANON_COOKIE_NAME, anonId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: ANON_COOKIE_MAX_AGE_SECONDS,
    path: '/',
  });
  return carrier.headers.get('set-cookie') as string;
}

function withAnonCookie(response: Response, mintedAnonId: string | null): Response {
  if (mintedAnonId) {
    response.headers.append('set-cookie', serializeAnonCookie(mintedAnonId));
  }
  return response;
}

/**
 * Pipes the model's token stream into the UI message stream as one text part, and hands the log
 * write to `after()` so it completes even if the function is frozen the moment the stream ends.
 */
async function streamAnswer(writer: UIMessageStreamWriter, turn: ReadyTurn): Promise<void> {
  const { stream, done } = runTurn(turn);
  after(done);

  const textId = randomUUID();
  writer.write({ type: 'text-start', id: textId });

  const reader = stream.getReader();
  for (;;) {
    const { done: readerDone, value } = await reader.read();
    if (readerDone) break;
    writer.write({ type: 'text-delta', id: textId, delta: value });
  }

  writer.write({ type: 'text-end', id: textId });
}

/**
 * `EmptyIndexError` and `IngestConfigMismatchError` mean the deployment is broken, not that the
 * turn was refused; they reach here by not being caught anywhere upstream. Logged loudly for
 * operators, reported to the client as a generic failure so internals never leak.
 */
function reportStreamError(error: unknown): string {
  if (error instanceof EmptyIndexError || error instanceof IngestConfigMismatchError) {
    console.error(`Ask agent deployment is broken: ${error.message}`);
  } else {
    console.error('Ask agent turn failed:', error);
  }
  return 'Something went wrong on our end. Try again in a moment.';
}

async function runAskTurn(writer: UIMessageStreamWriter, question: string, identity: Identity): Promise<void> {
  writer.write(statusChunk('received'));

  const prepared = await prepareTurn({ question, identity });

  if (prepared.kind === 'refused') {
    writer.write(refusalChunk(prepared.reason, prepared.text));
    return;
  }
  if (prepared.kind === 'gated') {
    writer.write(gateChunk(prepared.gate));
    return;
  }

  writer.write(statusChunk('generating'));
  await streamAnswer(writer, prepared);
}

export async function POST(request: NextRequest): Promise<Response> {
  const bot = await checkBotId();
  if (bot.isBot) {
    return new Response('Forbidden', { status: 403 });
  }

  const parsedBody = await parseAskRequest(request);
  if (!parsedBody) {
    return NextResponse.json({ error: 'Malformed request body: expected { question: string }.' }, { status: 400 });
  }

  const { identity, mintedAnonId } = await resolveIdentity(request);

  const stream = createUIMessageStream({
    execute: ({ writer }) => runAskTurn(writer, parsedBody.question, identity),
    onError: reportStreamError,
  });

  return withAnonCookie(createUIMessageStreamResponse({ stream }), mintedAnonId);
}
