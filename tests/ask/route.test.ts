import { randomUUID } from 'node:crypto';

import { auth } from '@clerk/nextjs/server';
import { checkBotId } from 'botid/server';
import { after } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from '../../app/api/ask/route';
import * as askModule from '@/lib/ask/ask';
import type { GatedTurn, ReadyTurn, RefusedTurn } from '@/lib/ask/ask';
import { ANON_COOKIE_NAME, EMBED_DIMS, EMBED_MODEL, MAX_QUESTION_CHARS } from '@/lib/ask/config';
import type { GenerationOutcome } from '@/lib/ask/generate';
import type { Gated } from '@/lib/ask/log';
import type { PromptParts } from '@/lib/ask/prompt';
import { refusalCopy } from '@/lib/ask/refusals';
import { EmptyIndexError, IngestConfigMismatchError } from '@/lib/ask/retrieve';
import type { ChunkMetadata, RetrievedChunk } from '@/lib/ask/types';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

vi.mock('botid/server', () => ({
  checkBotId: vi.fn(),
}));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, after: vi.fn() };
});

vi.mock('@/lib/ask/ask', () => ({
  prepareTurn: vi.fn(),
  runTurn: vi.fn(),
}));

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function askRequest(body: unknown, options: { cookie?: string } = {}): Request {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (options.cookie) headers.set('cookie', options.cookie);
  return new Request('http://localhost/api/ask', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function authResult(userId: string | null): Awaited<ReturnType<typeof auth>> {
  return { userId } as unknown as Awaited<ReturnType<typeof auth>>;
}

function arrangeHuman(): void {
  vi.mocked(checkBotId).mockResolvedValue({ isHuman: true, isBot: false, isVerifiedBot: false, bypassed: false });
}

function arrangeBot(): void {
  vi.mocked(checkBotId).mockResolvedValue({ isHuman: false, isBot: true, isVerifiedBot: false, bypassed: false });
}

function arrangeAnonymous(): void {
  vi.mocked(auth).mockResolvedValue(authResult(null));
}

function arrangeSignedIn(userId: string): void {
  vi.mocked(auth).mockResolvedValue(authResult(userId));
}

function metadata(): ChunkMetadata {
  return {
    file: 'about.md',
    heading: 'Role',
    title: 'About',
    embedModel: EMBED_MODEL,
    dims: EMBED_DIMS,
    contentHash: 'hash-a',
  };
}

function chunk(id: string, score: number): RetrievedChunk {
  return { id, content: `${id} content`, score, metadata: metadata() };
}

function promptParts(): PromptParts {
  return {
    system: 'system prompt',
    messages: [{ role: 'user', content: 'what does he build' }],
    marker: 'MARKERXYZ123',
  };
}

function refusedTurn(reason: RefusedTurn['reason'] = 'off_topic', text = 'Not something this agent answers.'): RefusedTurn {
  return { kind: 'refused', reason, text };
}

function gatedTurn(gate: Gated): GatedTurn {
  return { kind: 'gated', gate };
}

function readyTurn(turnId = 'turn-1'): ReadyTurn {
  return {
    kind: 'ready',
    turnId,
    prompt: promptParts(),
    retrieved: [chunk('identity#role', 0.72)],
  };
}

function streamFrom(chunks: string[]): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      for (const value of chunks) controller.enqueue(value);
      controller.close();
    },
  });
}

function erroringStreamFrom(chunks: string[], error: Error): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      for (const value of chunks) controller.enqueue(value);
      controller.error(error);
    },
  });
}

/** A resolved outcome, kept as a named helper so tests read as intent rather than plumbing. */
function outcomeOf(result: GenerationOutcome): Promise<GenerationOutcome> {
  return Promise.resolve(result);
}

interface StreamFrame {
  type: string;
  data?: Record<string, unknown>;
  delta?: string;
  errorText?: string;
}

/** Splits a UI message stream response body into its `data: {json}` SSE frames, in order. */
function parseSseFrames(body: string): StreamFrame[] {
  return body
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => line.slice('data: '.length).trim())
    .filter((payload) => payload.length > 0 && payload !== '[DONE]')
    .map((payload) => JSON.parse(payload) as StreamFrame);
}

function anonCookieHeader(response: Response): string | undefined {
  return response.headers.getSetCookie().find((entry) => entry.startsWith(`${ANON_COOKIE_NAME}=`));
}

function anonCookieValue(response: Response): string | undefined {
  return anonCookieHeader(response)?.match(new RegExp(`${ANON_COOKIE_NAME}=([^;]+)`))?.[1];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/ask: order and short-circuiting', () => {
  it('rejects a detected bot without ever calling prepareTurn', async () => {
    arrangeBot();
    arrangeAnonymous();

    const response = await POST(askRequest({ question: 'What does he build?' }));

    expect(response.ok).toBe(false);
    expect(askModule.prepareTurn).not.toHaveBeenCalled();
  });

  it('fails closed: a rejected checkBotId still rejects the request and prepareTurn is never called', async () => {
    vi.mocked(checkBotId).mockRejectedValue(new Error('botid unreachable'));
    arrangeAnonymous();

    const response = await POST(askRequest({ question: 'What does he build?' }));

    expect(response.ok).toBe(false);
    expect(askModule.prepareTurn).not.toHaveBeenCalled();
  });

  it('rejects a body missing the question field as a client error, before prepareTurn', async () => {
    arrangeHuman();
    arrangeAnonymous();

    const response = await POST(askRequest({}));

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    expect(askModule.prepareTurn).not.toHaveBeenCalled();
  });

  it('rejects an empty question string as a client error, before prepareTurn', async () => {
    arrangeHuman();
    arrangeAnonymous();

    const response = await POST(askRequest({ question: '' }));

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    expect(askModule.prepareTurn).not.toHaveBeenCalled();
  });

  it('rejects a question longer than MAX_QUESTION_CHARS as a client error, before prepareTurn', async () => {
    arrangeHuman();
    arrangeAnonymous();
    const question = 'a'.repeat(MAX_QUESTION_CHARS + 1);

    const response = await POST(askRequest({ question }));

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    expect(askModule.prepareTurn).not.toHaveBeenCalled();
  });
});

describe('POST /api/ask: status codes and stream shape', () => {
  it('responds 200 with a refusal part carrying the reason and text, never a 4xx', async () => {
    arrangeHuman();
    arrangeAnonymous();
    vi.mocked(askModule.prepareTurn).mockResolvedValue(
      refusedTurn('no_grounding', "Not something he's written about."),
    );

    const response = await POST(askRequest({ question: 'What is his salary at ESMON?' }));
    const frames = parseSseFrames(await response.text());
    const refusal = frames.find((frame) => frame.type === 'data-refusal');

    expect(response.status).toBe(200);
    expect(refusal?.data).toEqual({ reason: 'no_grounding', text: "Not something he's written about." });
  });

  it('responds 200 with a gate part carrying the reason, never 401 or 429', async () => {
    arrangeHuman();
    arrangeAnonymous();
    vi.mocked(askModule.prepareTurn).mockResolvedValue(
      gatedTurn({ reason: 'sign_in_required', resetsAt: null }),
    );

    const response = await POST(askRequest({ question: 'What does he build?' }));
    const frames = parseSseFrames(await response.text());
    const gate = frames.find((frame) => frame.type === 'data-gate');

    expect(response.status).toBe(200);
    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(429);
    expect(gate?.data).toEqual({ reason: 'sign_in_required', resetsAt: null });
  });

  it('emits a status part before any answer content', async () => {
    arrangeHuman();
    arrangeAnonymous();
    vi.mocked(askModule.prepareTurn).mockResolvedValue(readyTurn());
    vi.mocked(askModule.runTurn).mockReturnValue({
      stream: streamFrom(['He builds agents for a living.']),
      outcome: outcomeOf({ text: 'He builds agents for a living.', unanswerable: false }),
      done: Promise.resolve(),
    });

    const response = await POST(askRequest({ question: 'What does he build?' }));
    const frames = parseSseFrames(await response.text());

    const statusIndex = frames.findIndex((frame) => frame.type === 'data-status');
    const answerIndex = frames.findIndex((frame) => frame.type === 'text-delta');

    expect(statusIndex).toBeGreaterThanOrEqual(0);
    expect(answerIndex).toBeGreaterThan(statusIndex);
  });

  it('streams a normal answer as text-start, its deltas in order, then text-end', async () => {
    arrangeHuman();
    arrangeAnonymous();
    vi.mocked(askModule.prepareTurn).mockResolvedValue(readyTurn());
    vi.mocked(askModule.runTurn).mockReturnValue({
      stream: streamFrom(['He builds ', 'agents for a living.']),
      outcome: outcomeOf({ text: 'He builds agents for a living.', unanswerable: false }),
      done: Promise.resolve(),
    });

    const response = await POST(askRequest({ question: 'What does he build?' }));
    const frames = parseSseFrames(await response.text());
    const types = frames.map((frame) => frame.type);

    const startIndex = types.indexOf('text-start');
    const endIndex = types.indexOf('text-end');
    const deltaIndexes = types
      .map((type, index) => (type === 'text-delta' ? index : -1))
      .filter((index) => index !== -1);

    expect(startIndex).toBeGreaterThanOrEqual(0);
    expect(endIndex).toBeGreaterThan(startIndex);
    expect(deltaIndexes.every((index) => index > startIndex && index < endIndex)).toBe(true);

    const answer = frames
      .filter((frame) => frame.type === 'text-delta')
      .map((frame) => frame.delta)
      .join('');

    expect(response.status).toBe(200);
    expect(answer).toBe('He builds agents for a living.');
  });

  it('renders an unanswerable turn as a refusal part with no text-start or text-end, never a blank bubble', async () => {
    arrangeHuman();
    arrangeAnonymous();
    vi.mocked(askModule.prepareTurn).mockResolvedValue(readyTurn());
    vi.mocked(askModule.runTurn).mockReturnValue({
      stream: streamFrom([]),
      outcome: outcomeOf({ text: '', unanswerable: true }),
      done: Promise.resolve(),
    });

    const response = await POST(askRequest({ question: 'What is his salary at ESMON?' }));
    const frames = parseSseFrames(await response.text());
    const refusal = frames.find((frame) => frame.type === 'data-refusal');

    expect(response.status).toBe(200);
    expect(refusal?.data).toEqual({ reason: 'unanswerable', text: refusalCopy('unanswerable') });
    expect(frames.some((frame) => frame.type === 'text-start')).toBe(false);
    expect(frames.some((frame) => frame.type === 'text-end')).toBe(false);
  });

  it('surfaces a rejected outcome as an error part, never a refusal part', async () => {
    arrangeHuman();
    arrangeAnonymous();
    vi.mocked(askModule.prepareTurn).mockResolvedValue(readyTurn());
    const outcomeError = new Error('generation did not finish cleanly: length');
    const rejectedOutcome = Promise.reject(outcomeError);
    rejectedOutcome.catch(() => {}); // mark handled now; the route's own await still sees the rejection
    // generate() derives the stream's flush() throw and outcome's rejection from the same
    // finishReason check, so a real truncated generation fails both together; mocking a healthy
    // stream against a rejecting outcome tests a pairing production can never produce.
    vi.mocked(askModule.runTurn).mockReturnValue({
      stream: erroringStreamFrom(['He builds ', 'agents for a liv'], outcomeError),
      outcome: rejectedOutcome,
      done: Promise.resolve(),
    });

    const response = await POST(askRequest({ question: 'What does he build?' }));
    const frames = parseSseFrames(await response.text());

    expect(response.status).toBe(200);
    expect(frames.some((frame) => frame.type === 'error')).toBe(true);
    expect(frames.some((frame) => frame.type === 'data-refusal')).toBe(false);
    expect(frames.some((frame) => frame.type === 'text-end')).toBe(false);
  });
});

describe('POST /api/ask: identity and the cookie', () => {
  it("uses the signed-in Clerk userId as identity and mints no anonymous cookie", async () => {
    arrangeHuman();
    arrangeSignedIn('user_abc');
    vi.mocked(askModule.prepareTurn).mockResolvedValue(refusedTurn());

    const response = await POST(askRequest({ question: 'What does he build?' }));

    expect(vi.mocked(askModule.prepareTurn)).toHaveBeenCalledWith(
      expect.objectContaining({ identity: { userId: 'user_abc', anonId: null } }),
    );
    expect(anonCookieHeader(response)).toBeUndefined();
  });

  it('mints a fresh anonymous cookie, a valid uuid, httpOnly secure sameSite=lax, when none is present', async () => {
    arrangeHuman();
    arrangeAnonymous();
    vi.mocked(askModule.prepareTurn).mockResolvedValue(refusedTurn());

    const response = await POST(askRequest({ question: 'What does he build?' }));

    const setCookie = anonCookieHeader(response);
    expect(setCookie).toBeDefined();
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/Secure/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);

    const mintedId = anonCookieValue(response);
    expect(mintedId).toMatch(UUID_PATTERN);

    expect(vi.mocked(askModule.prepareTurn)).toHaveBeenCalledWith(
      expect.objectContaining({ identity: { userId: null, anonId: mintedId } }),
    );
  });

  it('reuses a valid anonymous cookie instead of minting a new one', async () => {
    arrangeHuman();
    arrangeAnonymous();
    vi.mocked(askModule.prepareTurn).mockResolvedValue(refusedTurn());
    const existingId = randomUUID();

    const response = await POST(
      askRequest({ question: 'What does he build?' }, { cookie: `${ANON_COOKIE_NAME}=${existingId}` }),
    );

    expect(vi.mocked(askModule.prepareTurn)).toHaveBeenCalledWith(
      expect.objectContaining({ identity: { userId: null, anonId: existingId } }),
    );

    const setCookie = anonCookieHeader(response);
    if (setCookie) {
      expect(setCookie).toContain(`${ANON_COOKIE_NAME}=${existingId}`);
    }
  });

  it('treats an invalid cookie value as absent and mints a fresh one, never trusting a forged uuid', async () => {
    arrangeHuman();
    arrangeAnonymous();
    vi.mocked(askModule.prepareTurn).mockResolvedValue(refusedTurn());
    const forgedId = `${randomUUID()}-someone-elses-turn`;

    const response = await POST(
      askRequest({ question: 'What does he build?' }, { cookie: `${ANON_COOKIE_NAME}=${forgedId}` }),
    );

    const identityArg = vi.mocked(askModule.prepareTurn).mock.calls[0]?.[0]?.identity;
    expect(identityArg?.anonId).not.toBe(forgedId);
    expect(identityArg?.anonId).toMatch(UUID_PATTERN);

    const mintedId = anonCookieValue(response);
    expect(mintedId).toBe(identityArg?.anonId);
    expect(mintedId).not.toBe(forgedId);
  });
});

describe('POST /api/ask: completion and failure', () => {
  it("hands after() the done promise from runTurn so a frozen function can't lose the write", async () => {
    arrangeHuman();
    arrangeAnonymous();
    vi.mocked(askModule.prepareTurn).mockResolvedValue(readyTurn());
    const donePromise = Promise.resolve();
    vi.mocked(askModule.runTurn).mockReturnValue({
      stream: streamFrom(['He builds agents.']),
      outcome: outcomeOf({ text: 'He builds agents.', unanswerable: false }),
      done: donePromise,
    });

    await POST(askRequest({ question: 'What does he build?' }));

    expect(vi.mocked(after)).toHaveBeenCalledWith(donePromise);
  });

  it('surfaces EmptyIndexError from prepareTurn as an error part inside the 200 stream, never a refusal, without leaking the internal message', async () => {
    arrangeHuman();
    arrangeAnonymous();
    const internalMessage = 'chunks table is empty. Ingest has not been run against this database';
    vi.mocked(askModule.prepareTurn).mockRejectedValue(new EmptyIndexError(internalMessage));

    const response = await POST(askRequest({ question: 'What does he build?' }));
    const body = await response.text();
    const frames = parseSseFrames(body);

    expect(response.status).toBe(200);
    expect(frames.some((frame) => frame.type === 'error')).toBe(true);
    expect(frames.some((frame) => frame.type === 'data-refusal')).toBe(false);
    expect(body).not.toContain(internalMessage);
    expect(body).not.toContain('EmptyIndexError');
  });

  it('surfaces IngestConfigMismatchError from prepareTurn as an error part inside the 200 stream, never a refusal, without leaking the internal message', async () => {
    arrangeHuman();
    arrangeAnonymous();
    const internalMessage = 'chunks.metadata records embedModel "text-embedding-3-small" (512 dims)';
    vi.mocked(askModule.prepareTurn).mockRejectedValue(new IngestConfigMismatchError(internalMessage));

    const response = await POST(askRequest({ question: 'What does he build?' }));
    const body = await response.text();
    const frames = parseSseFrames(body);

    expect(response.status).toBe(200);
    expect(frames.some((frame) => frame.type === 'error')).toBe(true);
    expect(frames.some((frame) => frame.type === 'data-refusal')).toBe(false);
    expect(body).not.toContain(internalMessage);
    expect(body).not.toContain('IngestConfigMismatchError');
  });
});
