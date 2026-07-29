import { describe, expect, it } from 'vitest';
import { AskRequestValidationError, MAX_QUESTION_LENGTH, parseAskRequestBody } from '../../lib/ask/request';

/**
 * Pure-logic tests for request boundary validation: no database, no network call, no mock needed.
 */

describe('parseAskRequestBody: question', () => {
  it('accepts a well-formed question with no UTM fields', () => {
    const body = parseAskRequestBody({ question: 'What does he do at FedEx?' });
    expect(body.question).toBe('What does he do at FedEx?');
    expect(body.utmSource).toBeNull();
    expect(body.utmMedium).toBeNull();
    expect(body.utmCampaign).toBeNull();
  });

  it('trims surrounding whitespace', () => {
    expect(parseAskRequestBody({ question: '  hello  ' }).question).toBe('hello');
  });

  it('rejects a missing question', () => {
    expect(() => parseAskRequestBody({})).toThrow(AskRequestValidationError);
  });

  it('rejects a non-string question', () => {
    expect(() => parseAskRequestBody({ question: 42 })).toThrow(AskRequestValidationError);
  });

  it('rejects an empty (or whitespace-only) question', () => {
    expect(() => parseAskRequestBody({ question: '' })).toThrow(AskRequestValidationError);
    expect(() => parseAskRequestBody({ question: '   ' })).toThrow(AskRequestValidationError);
  });

  it('accepts a question exactly at the 1,000 character cap', () => {
    const question = 'a'.repeat(MAX_QUESTION_LENGTH);
    expect(parseAskRequestBody({ question }).question).toHaveLength(MAX_QUESTION_LENGTH);
  });

  it('rejects a question over the 1,000 character cap, per docs/ask-agent/05-runtime.md', () => {
    const question = 'a'.repeat(MAX_QUESTION_LENGTH + 1);
    expect(() => parseAskRequestBody({ question })).toThrow(AskRequestValidationError);
    expect(() => parseAskRequestBody({ question })).toThrow(/1000/);
  });

  it('rejects a non-object body', () => {
    expect(() => parseAskRequestBody('a string')).toThrow(AskRequestValidationError);
    expect(() => parseAskRequestBody(null)).toThrow(AskRequestValidationError);
    expect(() => parseAskRequestBody(42)).toThrow(AskRequestValidationError);
  });
});

describe('parseAskRequestBody: UTM fields', () => {
  it('reads utm_source / utm_medium / utm_campaign under the snake_case keys lib/utm.ts uses', () => {
    const body = parseAskRequestBody({
      question: 'q',
      utm_source: 'linkedin',
      utm_medium: 'social',
      utm_campaign: 'portfolio',
    });
    expect(body.utmSource).toBe('linkedin');
    expect(body.utmMedium).toBe('social');
    expect(body.utmCampaign).toBe('portfolio');
  });

  it('treats an empty-string UTM field the same as absent (null)', () => {
    const body = parseAskRequestBody({ question: 'q', utm_source: '' });
    expect(body.utmSource).toBeNull();
  });

  it('rejects a non-string UTM field', () => {
    expect(() => parseAskRequestBody({ question: 'q', utm_source: 42 })).toThrow(AskRequestValidationError);
  });
});
