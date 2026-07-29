import { randomUUID, createHmac } from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from './db';
import { sessions } from './schema';

/** Session resolution for `/api/ask`: the `ask_sid` cookie, IP hashing, and the `sessions` row a
 *  turn logs against. See docs/ask-agent/07-identity-gate.md. */

/** Currently unsigned: nothing yet authorizes off this cookie, only resumes a session. Signing
 *  becomes required once it grants a free generation; see docs/ask-agent/07-identity-gate.md. */
export const ASK_SESSION_COOKIE = 'ask_sid';
/** 180 days: long enough to resume a stale tab, short enough that an abandoned cookie eventually
 *  stops being a live session. */
const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

const IP_HASH_SALT_SEED_ENV = 'IP_HASH_SALT_SEED';

export class AskSessionConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AskSessionConfigError';
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True only for a well-formed UUID, so a corrupted or forged cookie is treated as absent
 *  (a fresh session is created) rather than reaching the database as a malformed cast. */
export function isWellFormedSessionId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/** Reads `ask_sid` out of a raw `Cookie` header, or null if absent or malformed. Takes a plain
 *  string and returns one, so it's testable without a Next.js request context. */
export function readSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex === -1) continue;
    const name = part.slice(0, separatorIndex).trim();
    if (name === ASK_SESSION_COOKIE) {
      const value = part.slice(separatorIndex + 1).trim();
      return isWellFormedSessionId(value) ? value : null;
    }
  }
  return null;
}

/** Builds the `Set-Cookie` header for a freshly created session. `Secure` is conditional on the
 *  request having come in over HTTPS, so local `next dev` can still read the cookie back. */
export function buildSessionCookie(sessionId: string, secure: boolean): string {
  const attributes = [
    `${ASK_SESSION_COOKIE}=${sessionId}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_COOKIE_MAX_AGE_SECONDS}`,
  ];
  if (secure) attributes.push('Secure');
  return attributes.join('; ');
}

/** Derives the day's IP-hashing salt as `HMAC(seed, utcDate)`, then hashes `ip` under it: a
 *  static salt over IPv4 space is brute-forceable in seconds. See docs/ask-agent/07-identity-gate.md. */
export function hashIp(ip: string, now: Date = new Date()): string {
  const seed = process.env[IP_HASH_SALT_SEED_ENV];
  if (!seed) {
    throw new AskSessionConfigError(
      `Missing ${IP_HASH_SALT_SEED_ENV}: it is not set in this process's environment. Session ` +
        'creation cannot hash a visitor IP without it. For preview and production, set it in the ' +
        'deployment environment (Vercel project settings); for local development, set it in a ' +
        'local configuration file. Never commit a real value.'
    );
  }
  const utcDate = now.toISOString().slice(0, 10); // YYYY-MM-DD; toISOString() is always UTC.
  const dailySalt = createHmac('sha256', seed).update(utcDate).digest();
  return createHmac('sha256', dailySalt).update(ip).digest('hex');
}

/** First entry of `X-Forwarded-For` (nearest-hop-last on Vercel), falling back to `X-Real-Ip`,
 *  then a fixed placeholder for local `next dev`, which sets neither header. */
const LOCAL_DEV_IP_PLACEHOLDER = 'local-dev';

export function extractClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return LOCAL_DEV_IP_PLACEHOLDER;
}

export interface SessionUtmParams {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
}

export interface ResolvedSession {
  id: string;
  isNew: boolean;
}

/** Resumes the session named by `cookieSessionId` if it still exists, otherwise creates one. A
 *  session's own id doubles as its conversation id at the call site (app/api/ask/route.ts). */
export async function resolveSession(
  cookieSessionId: string | null,
  ipHash: string,
  utm: SessionUtmParams
): Promise<ResolvedSession> {
  if (cookieSessionId) {
    const existing = await db()
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.id, cookieSessionId))
      .limit(1);
    if (existing[0]) {
      await db()
        .update(sessions)
        .set({ lastSeenAt: sql`now()` })
        .where(eq(sessions.id, cookieSessionId));
      return { id: existing[0].id, isNew: false };
    }
  }

  const newId = randomUUID();
  await db()
    .insert(sessions)
    .values({
      id: newId,
      ipHash,
      utmSource: utm.utmSource,
      utmMedium: utm.utmMedium,
      utmCampaign: utm.utmCampaign,
    });
  return { id: newId, isNew: true };
}
