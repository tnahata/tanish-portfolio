/**
 * POST /api/ask. Responds 200 with a UI message stream carrying `status`, `answer`,
 * `refusal` and `gate` parts; never a bare 401 or 429, because useChat routes non-2xx to
 * onError and would never render the inline sign-in interstitial. Order is in docs/ask-agent.md.
 */
export const runtime = 'nodejs';
export const maxDuration = 30;

export function POST(request: Request): Promise<Response> {
  throw new Error(`not implemented: POST /api/ask (${request.method})`);
}
