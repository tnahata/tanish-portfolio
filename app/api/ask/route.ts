import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { AskEnvironmentConfigError, checkAskEnvironmentGuard } from '@/lib/ask/environment';
import { fetchCorpusMeta } from '@/lib/ask/corpus-meta';
import { loadConversationHistory } from '@/lib/ask/history';
import { AskRequestValidationError, parseAskRequestBody } from '@/lib/ask/request';
import { AskCorpusMismatchError, assertCorpusMatchesRunningConfig } from '@/lib/ask/retrieve';
import {
  AskSessionConfigError,
  buildSessionCookie,
  extractClientIp,
  hashIp,
  readSessionCookie,
  resolveSession,
} from '@/lib/ask/session';
import { runAskTurn, type AskUIMessage } from '@/lib/ask/stream';

/** `POST /api/ask`: validates the request, resolves session and history, and streams
 *  `runAskTurn()`'s result. Thin by design; orchestration lives in lib/ask/stream.ts. */
export const runtime = 'nodejs';
export const maxDuration = 30;

function serviceUnavailable(message: string): Response {
  return Response.json({ error: message }, { status: 503 });
}

export async function POST(request: Request): Promise<Response> {
  // Environment guard: refuse traffic outside production and the apex host. A misconfigured
  // production environment throws rather than silently passing; see lib/ask/environment.ts.
  try {
    if (checkAskEnvironmentGuard(request) === 'block') {
      return serviceUnavailable('This endpoint is not available in this environment.');
    }
  } catch (err) {
    if (err instanceof AskEnvironmentConfigError) {
      console.error('ask environment guard misconfigured:', err.message);
      return serviceUnavailable('Service temporarily unavailable.');
    }
    throw err;
  }

  // Request validation.
  let body;
  try {
    const raw: unknown = await request.json();
    body = parseAskRequestBody(raw);
  } catch (err) {
    if (err instanceof AskRequestValidationError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  // Corpus pre-flight, checked before the stream opens so a corpus problem returns a real 503:
  // once createUIMessageStreamResponse() returns, headers have already committed to 200.
  const corpusMeta = await fetchCorpusMeta();
  if (!corpusMeta) {
    return serviceUnavailable('The corpus has not been ingested yet.');
  }
  try {
    await assertCorpusMatchesRunningConfig();
  } catch (err) {
    if (err instanceof AskCorpusMismatchError) {
      console.error('ask corpus mismatch:', err.message);
      return serviceUnavailable('The corpus index is temporarily unavailable.');
    }
    throw err;
  }

  // Session resolution.
  let ipHash: string;
  try {
    ipHash = hashIp(extractClientIp(request));
  } catch (err) {
    if (err instanceof AskSessionConfigError) {
      console.error('ask session config error:', err.message);
      return serviceUnavailable('Service temporarily unavailable.');
    }
    throw err;
  }

  const cookieSessionId = readSessionCookie(request.headers.get('cookie'));
  const session = await resolveSession(cookieSessionId, ipHash, {
    utmSource: body.utmSource,
    utmMedium: body.utmMedium,
    utmCampaign: body.utmCampaign,
  });

  // No signed-in `users` row to resume a conversation across devices by, so a session's own id
  // doubles as its conversation id. See lib/ask/session.ts's `resolveSession()`.
  const conversationId = session.id;

  const { previousQuestion, history } = await loadConversationHistory(conversationId);

  // Abuse-control seam (none of it exists yet): slots in here, before the stream starts, so a
  // blocked request never pays for opening one. See docs/ask-agent/08-abuse-controls.md.

  const stream = createUIMessageStream<AskUIMessage>({
    execute: async ({ writer }) => {
      await runAskTurn({
        writer,
        signal: request.signal,
        question: body.question,
        previousQuestion,
        history,
        conversationId,
        sessionId: session.id,
        corpusHash: corpusMeta.corpusHash,
      });
    },
  });

  const response = createUIMessageStreamResponse({ stream });
  if (session.isNew) {
    const secure = new URL(request.url).protocol === 'https:';
    response.headers.append('set-cookie', buildSessionCookie(session.id, secure));
  }
  return response;
}
