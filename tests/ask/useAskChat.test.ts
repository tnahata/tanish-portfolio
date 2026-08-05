import { describe, expect, it } from 'vitest';

import { buildTurns, isResumableGate, MAX_STORED_TURNS, parseStoredTranscript, selectPersistableMessages, type AskUIMessage } from '@/components/ask/useAskChat';

function userMessage(id: string, text: string): AskUIMessage {
  return { id, role: 'user', parts: [{ type: 'text', text }] };
}

function assistantAnswer(id: string, text: string): AskUIMessage {
  return { id, role: 'assistant', parts: [{ type: 'text', text, state: 'done' }] };
}

function assistantStreaming(id: string, text: string): AskUIMessage {
  return { id, role: 'assistant', parts: [{ type: 'text', text, state: 'streaming' }] };
}

function assistantGate(id: string): AskUIMessage {
  return { id, role: 'assistant', parts: [{ type: 'data-gate', data: { reason: 'sign_in_required', resetsAt: null } }] };
}

function turnPair(index: number): AskUIMessage[] {
  return [userMessage(`u${index}`, `question ${index}`), assistantAnswer(`a${index}`, `answer ${index}`)];
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

describe('selectPersistableMessages: what survives a reload', () => {
  it('keeps a fully resolved turn so it restores with the same question and answer text', () => {
    const messages = turnPair(1);

    const persisted = selectPersistableMessages(messages);

    expect(persisted).toEqual(messages);
  });

  it('drops a mid-stream turn instead of restoring it as a permanently spinning line', () => {
    const messages: AskUIMessage[] = [...turnPair(1), userMessage('u2', 'still going')];

    const persisted = selectPersistableMessages(messages);

    expect(persisted).toEqual(turnPair(1));
  });

  it('drops a turn whose answer was still streaming when the page reloaded', () => {
    const messages: AskUIMessage[] = [...turnPair(1), userMessage('u2', 'in flight'), assistantStreaming('a2', 'partial')];

    const persisted = selectPersistableMessages(messages);

    expect(persisted).toEqual(turnPair(1));
  });

  it('drops an errored turn (no assistant message at all) the same way a mid-stream turn is dropped', () => {
    const messages: AskUIMessage[] = [...turnPair(1), userMessage('u2', 'this one failed')];

    const persisted = selectPersistableMessages(messages);

    expect(persisted).toEqual(turnPair(1));
  });

  it('keeps a resolved sign-in gate turn, since the pending question can still resume after sign-in', () => {
    const messages: AskUIMessage[] = [userMessage('u1', 'private question'), assistantGate('a1')];

    const persisted = selectPersistableMessages(messages);

    expect(persisted).toEqual(messages);
  });

  it('caps stored turns at MAX_STORED_TURNS, evicting the oldest turns first', () => {
    const turnCount = MAX_STORED_TURNS + 5;
    const messages = Array.from({ length: turnCount }, (_, i) => turnPair(i)).flat();

    const persisted = selectPersistableMessages(messages);

    expect(persisted).toHaveLength(MAX_STORED_TURNS * 2);
    expect(persisted[0]).toEqual(userMessage('u5', 'question 5'));
    expect(persisted[persisted.length - 1]).toEqual(assistantAnswer(`a${turnCount - 1}`, `answer ${turnCount - 1}`));
  });
});

describe('isResumableGate: which gates arm the resume-after-sign-in replay', () => {
  it('arms resume for a sign-in gate, which signing in lifts', () => {
    expect(isResumableGate('sign_in_required')).toBe(true);
  });

  it('never arms resume for a rate limit, so reopening the panel cannot replay and re-gate the question', () => {
    expect(isResumableGate('rate_limited')).toBe(false);
  });
});

describe('parseStoredTranscript: corrupt or stale sessionStorage never breaks the panel', () => {
  it('restores messages and the pending question from valid stored JSON', () => {
    const stored = JSON.stringify({ messages: turnPair(1), pendingQuestion: 'resume me' });

    const result = parseStoredTranscript(stored);

    expect(result).toEqual({ messages: turnPair(1), pendingQuestion: 'resume me' });
  });

  it('returns an empty transcript when nothing is stored', () => {
    expect(parseStoredTranscript(null)).toEqual({ messages: [], pendingQuestion: null });
  });

  it('degrades to an empty transcript on unparsable JSON instead of throwing', () => {
    expect(parseStoredTranscript('{not valid json')).toEqual({ messages: [], pendingQuestion: null });
  });

  it('degrades to an empty transcript when messages is not an array', () => {
    expect(parseStoredTranscript(JSON.stringify({ messages: 'nope' }))).toEqual({ messages: [], pendingQuestion: null });
  });

  it('degrades to an empty transcript when a stored message is missing required fields (a stale shape)', () => {
    const stored = JSON.stringify({ messages: [{ id: 'u1', role: 'user' }] });

    expect(parseStoredTranscript(stored)).toEqual({ messages: [], pendingQuestion: null });
  });

  it('falls back to a null pending question when the stored value is not a string', () => {
    const stored = JSON.stringify({ messages: turnPair(1), pendingQuestion: 42 });

    expect(parseStoredTranscript(stored).pendingQuestion).toBeNull();
  });
});
