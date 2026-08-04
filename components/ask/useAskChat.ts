'use client';

import { useCallback, useReducer, useRef } from 'react';

import type { AskStreamChunk, ConversationTurn, TurnResponse } from './types';

const GENERIC_ERROR = "Couldn't reach the agent. Try again in a moment.";

interface AskChatState {
  turns: ConversationTurn[];
  busy: boolean;
  pendingQuestion: string | null;
}

type Action =
  | { type: 'submit'; id: string; question: string }
  | { type: 'chunk'; id: string; chunk: AskStreamChunk }
  | { type: 'stream-failed'; id: string; message: string }
  | { type: 'clear-pending' };

const initialState: AskChatState = { turns: [], busy: false, pendingQuestion: null };

function updateTurn(turns: ConversationTurn[], id: string, update: (turn: ConversationTurn) => ConversationTurn): ConversationTurn[] {
  return turns.map((turn) => (turn.id === id ? update(turn) : turn));
}

function applyChunk(turn: ConversationTurn, chunk: AskStreamChunk): { turn: ConversationTurn; gated: boolean } {
  switch (chunk.type) {
    case 'data-status':
      return { turn: { ...turn, stage: chunk.data.stage }, gated: false };
    case 'text-start':
      return { turn: { ...turn, response: { kind: 'answer', text: '', done: false } }, gated: false };
    case 'text-delta': {
      const current: TurnResponse = turn.response?.kind === 'answer' ? turn.response : { kind: 'answer', text: '', done: false };
      return { turn: { ...turn, response: { ...current, text: current.text + chunk.delta } }, gated: false };
    }
    case 'text-end': {
      const current: TurnResponse = turn.response?.kind === 'answer' ? turn.response : { kind: 'answer', text: '', done: false };
      return { turn: { ...turn, stage: null, response: { ...current, done: true } }, gated: false };
    }
    case 'data-refusal':
      return { turn: { ...turn, stage: null, response: { kind: 'refusal', ...chunk.data } }, gated: false };
    case 'data-gate':
      return { turn: { ...turn, stage: null, response: { kind: 'gate', ...chunk.data } }, gated: true };
    case 'error':
      return { turn: { ...turn, stage: null, response: { kind: 'error', message: chunk.errorText } }, gated: false };
  }
}

function reducer(state: AskChatState, action: Action): AskChatState {
  switch (action.type) {
    case 'submit': {
      const turn: ConversationTurn = { id: action.id, question: action.question, response: null, stage: 'received' };
      return { turns: [...state.turns, turn], busy: true, pendingQuestion: null };
    }
    case 'chunk': {
      let gated = false;
      const turns = updateTurn(state.turns, action.id, (turn) => {
        const applied = applyChunk(turn, action.chunk);
        gated = applied.gated;
        return applied.turn;
      });
      const stillBusy = action.chunk.type !== 'text-end' && action.chunk.type !== 'data-refusal' && action.chunk.type !== 'data-gate' && action.chunk.type !== 'error';
      return {
        turns,
        busy: stillBusy,
        pendingQuestion: gated ? state.turns.find((t) => t.id === action.id)?.question ?? null : state.pendingQuestion,
      };
    }
    case 'stream-failed': {
      const turns = updateTurn(state.turns, action.id, (turn) => ({ ...turn, stage: null, response: { kind: 'error', message: action.message } }));
      return { ...state, turns, busy: false };
    }
    case 'clear-pending':
      return { ...state, pendingQuestion: null };
  }
}

/** Splits an SSE byte stream on blank-line boundaries and yields the JSON payload of each `data:` line. */
async function* readSseEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const dataLine = rawEvent.split('\n').find((line) => line.startsWith('data:'));
      if (dataLine) yield dataLine.slice('data:'.length).trim();
      boundary = buffer.indexOf('\n\n');
    }
  }
}

/**
 * Drives POST /api/ask by hand: no `useChat` here because `@ai-sdk/react` isn't a project
 * dependency. Parses the same UI-message SSE wire format `DefaultChatTransport` would.
 */
export function useAskChat() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const nextId = useRef(0);

  const ask = useCallback(async (question: string) => {
    const id = `turn-${nextId.current++}`;
    dispatch({ type: 'submit', id, question });

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      if (!response.ok || !response.body) {
        dispatch({ type: 'stream-failed', id, message: GENERIC_ERROR });
        return;
      }

      for await (const payload of readSseEvents(response.body)) {
        if (payload === '[DONE]') continue;
        const chunk = JSON.parse(payload) as AskStreamChunk;
        dispatch({ type: 'chunk', id, chunk });
      }
    } catch {
      dispatch({ type: 'stream-failed', id, message: GENERIC_ERROR });
    }
  }, []);

  const clearPending = useCallback(() => dispatch({ type: 'clear-pending' }), []);

  const lastTurn = state.turns[state.turns.length - 1];
  const stage = state.busy ? (lastTurn?.stage ?? 'received') : null;

  return { turns: state.turns, busy: state.busy, stage, pendingQuestion: state.pendingQuestion, ask, clearPending };
}
