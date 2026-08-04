'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';

import type { LockedReason } from '@/lib/ask/types';

import type { ConversationTurn, TurnResponse } from './types';

const GENERIC_ERROR = "Couldn't reach the agent. Try again in a moment.";

/** The three `data-*` shapes `app/api/ask/route.ts` writes, keyed the way `useChat` expects (without the `data-` prefix). */
type AskDataParts = {
  status: { stage: 'received' | 'generating' };
  refusal: { reason: LockedReason; text: string };
  gate: { reason: Extract<LockedReason, 'sign_in_required' | 'rate_limited'>; resetsAt: string | null };
};

export type AskUIMessage = UIMessage<unknown, AskDataParts>;
type AskMessagePart = AskUIMessage['parts'][number];

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
  const [stage, setStage] = useState<'received' | 'generating' | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
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
    onData: (part) => {
      if (part.type === 'data-status') setStage(part.data.stage);
      if (part.type === 'data-gate') setPendingQuestion(lastQuestionRef.current);
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
  messagesRef.current = messages;

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
