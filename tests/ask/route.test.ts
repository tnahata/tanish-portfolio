import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Thin integration tests for app/api/ask/route.ts: every lib/ask module it calls is mocked, so
 *  this exercises only the route's own wiring, invoked directly the way Next.js calls `POST`. */

const checkAskEnvironmentGuardMock = vi.fn();
const fetchCorpusMetaMock = vi.fn();
const assertCorpusMatchesRunningConfigMock = vi.fn();
const extractClientIpMock = vi.fn();
const hashIpMock = vi.fn();
const readSessionCookieMock = vi.fn();
const resolveSessionMock = vi.fn();
const buildSessionCookieMock = vi.fn();
const loadConversationHistoryMock = vi.fn();
const runAskTurnMock = vi.fn();

vi.mock('../../lib/ask/environment', async () => {
  const actual = await vi.importActual<typeof import('../../lib/ask/environment')>(
    '../../lib/ask/environment'
  );
  return { ...actual, checkAskEnvironmentGuard: (...args: unknown[]) => checkAskEnvironmentGuardMock(...args) };
});

vi.mock('../../lib/ask/corpus-meta', () => ({
  fetchCorpusMeta: (...args: unknown[]) => fetchCorpusMetaMock(...args),
}));

vi.mock('../../lib/ask/retrieve', async () => {
  const actual = await vi.importActual<typeof import('../../lib/ask/retrieve')>('../../lib/ask/retrieve');
  return {
    ...actual,
    assertCorpusMatchesRunningConfig: (...args: unknown[]) => assertCorpusMatchesRunningConfigMock(...args),
  };
});

vi.mock('../../lib/ask/session', async () => {
  const actual = await vi.importActual<typeof import('../../lib/ask/session')>('../../lib/ask/session');
  return {
    ...actual,
    extractClientIp: (...args: unknown[]) => extractClientIpMock(...args),
    hashIp: (...args: unknown[]) => hashIpMock(...args),
    readSessionCookie: (...args: unknown[]) => readSessionCookieMock(...args),
    resolveSession: (...args: unknown[]) => resolveSessionMock(...args),
    buildSessionCookie: (...args: unknown[]) => buildSessionCookieMock(...args),
  };
});

vi.mock('../../lib/ask/history', () => ({
  loadConversationHistory: (...args: unknown[]) => loadConversationHistoryMock(...args),
}));

vi.mock('../../lib/ask/stream', () => ({
  runAskTurn: (...args: unknown[]) => runAskTurnMock(...args),
}));

import { POST } from '../../app/api/ask/route';

function jsonRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://tanishnahata.com/api/ask', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  checkAskEnvironmentGuardMock.mockReset();
  fetchCorpusMetaMock.mockReset();
  assertCorpusMatchesRunningConfigMock.mockReset();
  extractClientIpMock.mockReset();
  hashIpMock.mockReset();
  readSessionCookieMock.mockReset();
  resolveSessionMock.mockReset();
  buildSessionCookieMock.mockReset();
  loadConversationHistoryMock.mockReset();
  runAskTurnMock.mockReset();

  checkAskEnvironmentGuardMock.mockReturnValue('allow');
  fetchCorpusMetaMock.mockResolvedValue({
    embedModel: 'text-embedding-3-large',
    embedDims: 1024,
    corpusHash: 'corpus-hash-1',
  });
  assertCorpusMatchesRunningConfigMock.mockResolvedValue(undefined);
  extractClientIpMock.mockReturnValue('203.0.113.5');
  hashIpMock.mockReturnValue('hashed-ip');
  readSessionCookieMock.mockReturnValue(null);
  resolveSessionMock.mockResolvedValue({ id: 'session-1', isNew: true });
  buildSessionCookieMock.mockReturnValue('ask_sid=session-1; Path=/; HttpOnly');
  loadConversationHistoryMock.mockResolvedValue({ previousQuestion: null, history: [] });
  runAskTurnMock.mockResolvedValue(undefined);
});

describe('POST /api/ask: environment guard', () => {
  it('returns 503 when the guard blocks (non-production, or wrong host)', async () => {
    checkAskEnvironmentGuardMock.mockReturnValue('block');

    const response = await POST(jsonRequest({ question: 'q' }));

    expect(response.status).toBe(503);
    expect(runAskTurnMock).not.toHaveBeenCalled();
  });

  it('returns 503, without leaking detail, when the guard throws on invalid production config', async () => {
    const { AskEnvironmentConfigError } = await import('../../lib/ask/environment');
    checkAskEnvironmentGuardMock.mockImplementation(() => {
      throw new AskEnvironmentConfigError('APEX_HOST is not set');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await POST(jsonRequest({ question: 'q' }));

    expect(response.status).toBe(503);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).not.toMatch(/APEX_HOST/);
    errorSpy.mockRestore();
  });
});

describe('POST /api/ask: request validation', () => {
  it('returns 400 for a missing question', async () => {
    const response = await POST(jsonRequest({}));
    expect(response.status).toBe(400);
    expect(runAskTurnMock).not.toHaveBeenCalled();
  });

  it('returns 400 for a question over the length cap', async () => {
    const response = await POST(jsonRequest({ question: 'a'.repeat(1001) }));
    expect(response.status).toBe(400);
  });

  it('returns 400 for a non-JSON body', async () => {
    const request = new Request('https://tanishnahata.com/api/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});

describe('POST /api/ask: corpus pre-flight', () => {
  it('returns 503 when corpus_meta has no row', async () => {
    fetchCorpusMetaMock.mockResolvedValueOnce(null);
    const response = await POST(jsonRequest({ question: 'q' }));
    expect(response.status).toBe(503);
    expect(runAskTurnMock).not.toHaveBeenCalled();
  });

  it('returns 503 when the running config does not match the index (AskCorpusMismatchError)', async () => {
    const { AskCorpusMismatchError } = await import('../../lib/ask/retrieve');
    assertCorpusMatchesRunningConfigMock.mockRejectedValueOnce(
      new AskCorpusMismatchError('embed_model mismatch')
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await POST(jsonRequest({ question: 'q' }));

    expect(response.status).toBe(503);
    expect(runAskTurnMock).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe('POST /api/ask: happy path', () => {
  it('returns a 200 streaming response and calls runAskTurn with the resolved session and history', async () => {
    loadConversationHistoryMock.mockResolvedValueOnce({
      previousQuestion: 'earlier question',
      history: [{ question: 'earlier question', answer: 'earlier answer' }],
    });

    const response = await POST(jsonRequest({ question: 'What does he do at FedEx?' }));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/text\/event-stream/);
    expect(runAskTurnMock).toHaveBeenCalledTimes(1);

    const call = runAskTurnMock.mock.calls[0][0] as Record<string, unknown>;
    expect(call.question).toBe('What does he do at FedEx?');
    expect(call.previousQuestion).toBe('earlier question');
    expect(call.history).toEqual([{ question: 'earlier question', answer: 'earlier answer' }]);
    expect(call.conversationId).toBe('session-1');
    expect(call.sessionId).toBe('session-1');
    expect(call.corpusHash).toBe('corpus-hash-1');
    expect(call.signal).toBeInstanceOf(AbortSignal);
  });

  it('sets a Set-Cookie header for a newly created session', async () => {
    resolveSessionMock.mockResolvedValueOnce({ id: 'session-2', isNew: true });

    const response = await POST(jsonRequest({ question: 'q' }));

    expect(response.headers.get('set-cookie')).toBeTruthy();
    expect(buildSessionCookieMock).toHaveBeenCalledWith('session-2', true);
  });

  it('does not set a Set-Cookie header when the session was resumed from an existing cookie', async () => {
    readSessionCookieMock.mockReturnValue('existing-session-id');
    resolveSessionMock.mockResolvedValueOnce({ id: 'existing-session-id', isNew: false });

    const response = await POST(jsonRequest({ question: 'q' }));

    expect(response.headers.get('set-cookie')).toBeNull();
    expect(buildSessionCookieMock).not.toHaveBeenCalled();
  });

  it('passes UTM fields from the request body through to resolveSession', async () => {
    await POST(
      jsonRequest({
        question: 'q',
        utm_source: 'linkedin',
        utm_medium: 'social',
        utm_campaign: 'portfolio',
      })
    );

    expect(resolveSessionMock).toHaveBeenCalledWith(null, 'hashed-ip', {
      utmSource: 'linkedin',
      utmMedium: 'social',
      utmCampaign: 'portfolio',
    });
  });
});
