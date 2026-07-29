/** Request payload validation for `POST /api/ask`: shape and the 1,000-character input cap.
 *  See docs/ask-agent/05-runtime.md. */

export const MAX_QUESTION_LENGTH = 1000;

export class AskRequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AskRequestValidationError';
  }
}

export interface AskRequestBody {
  question: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
}

function optionalString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new AskRequestValidationError(`"${field}" must be a string when present.`);
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Parses and validates the raw POST body. UTM fields use the same snake_case keys
 *  lib/useUTMPersistence.ts persists to `sessionStorage`. */
export function parseAskRequestBody(raw: unknown): AskRequestBody {
  if (typeof raw !== 'object' || raw === null) {
    throw new AskRequestValidationError('Request body must be a JSON object.');
  }
  const body = raw as Record<string, unknown>;

  if (typeof body.question !== 'string') {
    throw new AskRequestValidationError('"question" is required and must be a string.');
  }
  const question = body.question.trim();
  if (question.length === 0) {
    throw new AskRequestValidationError('"question" must not be empty.');
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    throw new AskRequestValidationError(
      `"question" must be ${MAX_QUESTION_LENGTH} characters or fewer (got ${question.length}).`
    );
  }

  return {
    question,
    utmSource: optionalString(body.utm_source, 'utm_source'),
    utmMedium: optionalString(body.utm_medium, 'utm_medium'),
    utmCampaign: optionalString(body.utm_campaign, 'utm_campaign'),
  };
}
