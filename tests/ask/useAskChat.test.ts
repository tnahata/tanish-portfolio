import { describe, expect, it } from 'vitest';

import { buildTurns, type AskUIMessage } from '@/components/ask/useAskChat';

function userMessage(id: string, text: string): AskUIMessage {
  return { id, role: 'user', parts: [{ type: 'text', text }] };
}

function assistantAnswer(id: string, text: string): AskUIMessage {
  return { id, role: 'assistant', parts: [{ type: 'text', text, state: 'done' }] };
}

describe('buildTurns: error stays on its own turn', () => {
  it('keeps the error on an errored turn once a later turn succeeds', () => {
    const messages: AskUIMessage[] = [userMessage('u1', 'first question'), userMessage('u2', 'second question'), assistantAnswer('a2', 'second answer')];
    const failedTurnIds = new Set(['u1']);

    const turns = buildTurns(messages, failedTurnIds, null);

    expect(turns).toHaveLength(2);
    expect(turns[0].response).toEqual({ kind: 'error', message: expect.any(String) });
    expect(turns[1].response).toEqual({ kind: 'answer', text: 'second answer', done: true });
  });

  it('shows an error on every failed turn when two turns in a row fail', () => {
    const messages: AskUIMessage[] = [userMessage('u1', 'first question'), userMessage('u2', 'second question')];
    const failedTurnIds = new Set(['u1', 'u2']);

    const turns = buildTurns(messages, failedTurnIds, null);

    expect(turns).toHaveLength(2);
    expect(turns[0].response?.kind).toBe('error');
    expect(turns[1].response?.kind).toBe('error');
  });

  it('leaves no stale error under a retry, which always lands as a new turn', () => {
    const messages: AskUIMessage[] = [userMessage('u1', 'flaky question'), userMessage('u2', 'flaky question'), assistantAnswer('a2', 'it worked this time')];
    const failedTurnIds = new Set(['u1']);

    const turns = buildTurns(messages, failedTurnIds, null);

    expect(turns[0].response?.kind).toBe('error');
    expect(turns[1].response).toEqual({ kind: 'answer', text: 'it worked this time', done: true });
  });

  it('still shows the thinking line for a turn with no assistant message and no recorded failure', () => {
    const messages: AskUIMessage[] = [userMessage('u1', 'question')];

    const turns = buildTurns(messages, new Set(), 'generating');

    expect(turns[0].response).toBeNull();
    expect(turns[0].stage).toBe('generating');
  });
});
