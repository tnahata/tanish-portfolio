'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';

import type { LockedReason } from '@/lib/ask/types';

import type { ConversationTurn, TurnResponse } from './types';

const GENERIC_ERROR = "Couldn't reach the agent. Try again in a moment.";
const TRANSCRIPT_STORAGE_KEY = 'ask-signal-transcript';

/** Turn pairs kept in `sessionStorage`, oldest evicted first. Answers run under 120 words each. */
export const MAX_STORED_TURNS = 50;

/** The three `data-*` shapes `app/api/ask/route.ts` writes, keyed the way `useChat` expects (without the `data-` prefix). */
type AskDataParts = {
  status: { stage: 'received' | 'generating' };
  refusal: { reason: LockedReason; text: string };
  gate: { reason: Extract<LockedReason, 'sign_in_required' | 'rate_limited'>; resetsAt: string | null };
};

export type AskUIMessage = UIMessage<unknown, AskDataParts>;
type AskMessagePart = AskUIMessage['parts'][number];

/** Only a sign-in gate is resumable (signing in lifts it). Arming resume for a rate limit makes
 *  the panel's mount-time replay re-send and re-gate the question on every reopen, growing the chat. */
export function isResumableGate(reason: AskDataParts['gate']['reason']): boolean {
  return reason === 'sign_in_required';
}

function isTextPart(part: AskMessagePart): part is Extract<AskMessagePart, { type: 'text' }> {
  return part.type === 'text';
}
function isRefusalPart(part: AskMessagePart): part is Extract<AskMessagePart, { type: 'data-refusal' }> {
  return part.type === 'data-refusal';
}
function isGatePart(part: AskMessagePart): part is Extract<AskMessagePart, { type: 'data-gate' }> {
  return part.type === 'data-gate';
}

/** Joins the text parts of a user message. `sendMessage({ text })` always produces exactly one. */
function questionText(message: AskUIMessage): string {
  return message.parts.filter(isTextPart).map((part) => part.text).join('');
}

/** Reads the response an assistant message resolved to. Undefined (no message yet) means still waiting. */
function turnResponse(message: AskUIMessage | undefined): TurnResponse {
  if (!message) return null;

  const refusal = message.parts.find(isRefusalPart);
  if (refusal) return { kind: 'refusal', ...refusal.data };

  const gate = message.parts.find(isGatePart);
  if (gate) return { kind: 'gate', ...gate.data };

  const text = message.parts.find(isTextPart);
  if (text) return { kind: 'answer', text: text.text, done: text.state !== 'streaming' };

  return null;
}

/**
 * Turns `messages` into per-turn view state. `failedTurnIds` marks a turn as failed by its own
 * user message id, so an error stays attached to the turn it happened to regardless of how many
 * turns follow it. Pure and exported so the mapping is testable without rendering `useChat`.
 */
export function buildTurns(
  messages: AskUIMessage[],
  failedTurnIds: ReadonlySet<string>,
  stage: 'received' | 'generating' | null,
): ConversationTurn[] {
  const result: ConversationTurn[] = [];
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.role !== 'user') continue;

    const next = messages[index + 1];
    const assistant = next?.role === 'assistant' ? next : undefined;
    const isLastTurn = (assistant ? index + 1 : index) === messages.length - 1;

    result.push({
      id: message.id,
      question: questionText(message),
      response: failedTurnIds.has(message.id) ? { kind: 'error', message: GENERIC_ERROR } : turnResponse(assistant),
      stage: isLastTurn ? stage : null,
    });
  }
  return result;
}

interface StoredTranscript {
  messages: AskUIMessage[];
  pendingQuestion: string | null;
}

const EMPTY_TRANSCRIPT: StoredTranscript = { messages: [], pendingQuestion: null };

function isStoredMessage(value: unknown): value is AskUIMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Record<string, unknown>;
  return typeof message.id === 'string' && (message.role === 'user' || message.role === 'assistant') && Array.isArray(message.parts);
}

/**
 * A turn only persists once its response fully resolved: a mid-stream or still-streaming turn
 * cannot resume after a reload, so it renders forever as `ThinkingLine` if restored. An errored
 * turn (no assistant message at all) is dropped the same way, for the same reason.
 */
export function selectPersistableMessages(messages: AskUIMessage[]): AskUIMessage[] {
  const pairs: AskUIMessage[][] = [];
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.role !== 'user') continue;

    const assistant = messages[index + 1];
    const response = assistant?.role === 'assistant' ? turnResponse(assistant) : null;
    const resolved = response !== null && (response.kind !== 'answer' || response.done);
    if (resolved) pairs.push([message, assistant as AskUIMessage]);
  }
  return pairs.slice(-MAX_STORED_TURNS).flat();
}

/** Any parse or shape failure degrades to an empty transcript rather than throwing. */
export function parseStoredTranscript(raw: string | null): StoredTranscript {
  if (!raw) return EMPTY_TRANSCRIPT;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || !Array.isArray(parsed.messages) || !parsed.messages.every(isStoredMessage)) return EMPTY_TRANSCRIPT;
    return {
      messages: parsed.messages,
      pendingQuestion: typeof parsed.pendingQuestion === 'string' ? parsed.pendingQuestion : null,
    };
  } catch {
    return EMPTY_TRANSCRIPT;
  }
}

function readStoredTranscript(): StoredTranscript {
  if (typeof window === 'undefined') return EMPTY_TRANSCRIPT;
  return parseStoredTranscript(sessionStorage.getItem(TRANSCRIPT_STORAGE_KEY));
}

function persistTranscript(messages: AskUIMessage[], pendingQuestion: string | null): void {
  if (typeof window === 'undefined') return;
  const payload: StoredTranscript = { messages: selectPersistableMessages(messages), pendingQuestion };
  try {
    sessionStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage can be full or unavailable (private browsing); the transcript simply won't survive a reload.
  }
}

/**
 * Wraps `@ai-sdk/react`'s `useChat`, pointed at the same `POST /api/ask` the server already
 * writes a standard UI message stream for (`docs/ask-agent.md`, Streaming). The route parses
 * `{ question: string }`, not the SDK's default `{ id, messages, trigger }` body, so
 * `prepareSendMessagesRequest` rewrites the outgoing request instead of changing the route.
 *
 * `data-status` ships `transient: true` from the server, so it never lands in `message.parts`;
 * it only reaches `onData`, which is where `stage` is tracked here. `data-refusal` and
 * `data-gate` are not transient and do land in parts, which `turnResponse` reads.
 */
export function useAskChat() {
  const [restored] = useState(readStoredTranscript);
  const [stage, setStage] = useState<'received' | 'generating' | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(restored.pendingQuestion);
  const [failedTurnIds, setFailedTurnIds] = useState<ReadonlySet<string>>(() => new Set());
  const lastQuestionRef = useRef('');
  const messagesRef = useRef<AskUIMessage[]>([]);

  const [transport] = useState(
    () =>
      new DefaultChatTransport<AskUIMessage>({
        api: '/api/ask',
        prepareSendMessagesRequest: ({ messages }) => ({
          body: { question: questionText(messages[messages.length - 1]) },
        }),
      }),
  );

  const { messages, status, sendMessage } = useChat<AskUIMessage>({
    transport,
    messages: restored.messages,
    onData: (part) => {
      if (part.type === 'data-status') setStage(part.data.stage);
      if (part.type === 'data-gate' && isResumableGate(part.data.reason)) setPendingQuestion(lastQuestionRef.current);
    },
    onFinish: () => setStage(null),
    onError: () => {
      setStage(null);
      // A failed request produces no assistant message, so the failing user message is whatever is last here.
      const failedMessage = messagesRef.current[messagesRef.current.length - 1];
      if (failedMessage?.role === 'user') {
        setFailedTurnIds((prev) => new Set(prev).add(failedMessage.id));
      }
    },
  });

  useEffect(() => {
    messagesRef.current = messages;
    persistTranscript(messages, pendingQuestion);
  }, [messages, pendingQuestion]);

  const busy = status === 'submitted' || status === 'streaming';

  const ask = useCallback(
    async (question: string) => {
      lastQuestionRef.current = question;
      setPendingQuestion(null);
      setStage('received');
      await sendMessage({ text: question });
    },
    [sendMessage],
  );

  const clearPending = useCallback(() => setPendingQuestion(null), []);

  const turns = useMemo(() => buildTurns(messages, failedTurnIds, stage), [messages, failedTurnIds, stage]);

  return { turns, busy, stage, pendingQuestion, ask, clearPending };
}
