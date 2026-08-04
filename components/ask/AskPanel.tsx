'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { SignInButton, useUser } from '@clerk/nextjs';
import { Maximize2, Minimize2, X } from 'lucide-react';

import { refusalCopy } from '@/lib/ask/refusals';

import { getStarterChips } from './starterChips';
import SignalMotif from './SignalMotif';
import { useFocusTrap } from './useFocusTrap';
import type { useAskChat } from './useAskChat';
import type { ConversationTurn } from './types';

interface AskPanelProps {
  chat: ReturnType<typeof useAskChat>;
  pathname: string;
  reducedMotion: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onClose: () => void;
  returnFocusTo: React.RefObject<HTMLElement | null>;
}

const TITLE_ID = 'ask-signal-title';

function formatResetTime(resetsAt: string | null): string {
  if (!resetsAt) return 'tomorrow';
  return new Date(resetsAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function QuestionBubble({ question }: { question: string }) {
  return (
    <div style={{ alignSelf: 'flex-end', maxWidth: '85%', textAlign: 'right' }}>
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.62rem',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--color-accent)',
          margin: '0 0 0.3rem 0',
        }}
      >
        You asked
      </p>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--ask-answer-size)',
          lineHeight: 1.5,
          color: 'var(--color-text)',
          borderRight: '2px solid var(--color-accent)',
          paddingRight: '0.7rem',
          margin: 0,
        }}
      >
        {question}
      </p>
    </div>
  );
}

const EQ_BAR_COUNT = 4;

function ThinkingLine() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 0.35rem 0' }}>
      <span className="ask-eq" aria-hidden="true">
        {Array.from({ length: EQ_BAR_COUNT }, (_, i) => (
          <span key={i} className="ask-eq-bar" style={{ animationDelay: `${i * 0.12}s` }} />
        ))}
      </span>
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.7rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
          margin: 0,
        }}
      >
        Signal is reading&hellip;
      </p>
    </div>
  );
}

function AnswerBlock({ text, done }: { text: string; done: boolean }) {
  return (
    <div style={{ alignSelf: 'flex-start', maxWidth: '90%' }}>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--ask-answer-size)',
          lineHeight: 1.6,
          color: 'var(--color-text)',
          margin: 0,
          whiteSpace: 'pre-wrap',
        }}
      >
        {text}
        {!done && <span aria-hidden="true" className="ask-cursor" />}
      </p>
    </div>
  );
}

function RefusalBlock({ reason, text }: { reason: string; text: string }) {
  return (
    <div
      role="note"
      aria-label="Refusal"
      style={{
        alignSelf: 'flex-start',
        maxWidth: '92%',
        border: '1px solid rgba(99,102,241,0.35)',
        background: 'rgba(99,102,241,0.1)',
        borderRadius: '6px',
        padding: '0.85rem 1rem',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--color-secondary)',
          margin: '0 0 0.4rem 0',
        }}
      >
        Not answering that one &middot; {reason.replace(/_/g, ' ')}
      </p>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', lineHeight: 1.55, color: 'var(--color-text)', margin: 0 }}>{text}</p>
    </div>
  );
}

function GateBlock({
  reason,
  resetsAt,
}: {
  reason: 'sign_in_required' | 'rate_limited';
  resetsAt: string | null;
}) {
  return (
    <div
      role="note"
      aria-label="Sign in required"
      style={{
        alignSelf: 'flex-start',
        maxWidth: '92%',
        border: '1px solid rgba(0,217,255,0.3)',
        background: 'rgba(0,217,255,0.07)',
        borderRadius: '6px',
        padding: '0.85rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
      }}
    >
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', lineHeight: 1.55, color: 'var(--color-text)', margin: 0 }}>
        {reason === 'rate_limited' ? `${refusalCopy(reason)} Resets ${formatResetTime(resetsAt)}.` : refusalCopy(reason)}
      </p>
      {reason === 'sign_in_required' && (
        <SignInButton mode="modal">
          <button
            type="button"
            style={{
              alignSelf: 'flex-start',
              fontFamily: 'var(--font-body)',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'var(--color-primary)',
              background: 'var(--color-accent)',
              border: 'none',
              borderRadius: '6px',
              padding: '0.5rem 0.9rem',
              cursor: 'pointer',
            }}
          >
            Sign in to continue
          </button>
        </SignInButton>
      )}
    </div>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      style={{
        alignSelf: 'flex-start',
        maxWidth: '92%',
        border: '1px solid rgba(240,110,90,0.4)',
        background: 'rgba(240,110,90,0.08)',
        borderRadius: '6px',
        padding: '0.85rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#f0806e',
          margin: 0,
        }}
      >
        Something went wrong
      </p>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', lineHeight: 1.55, color: 'var(--color-text)', margin: 0 }}>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        style={{
          alignSelf: 'flex-start',
          fontFamily: 'var(--font-body)',
          fontSize: '0.78rem',
          fontWeight: 600,
          color: '#f0806e',
          background: 'transparent',
          border: '1px solid rgba(240,110,90,0.5)',
          borderRadius: '6px',
          padding: '0.4rem 0.75rem',
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  );
}

function TurnBlock({ turn, onRetry }: { turn: ConversationTurn; onRetry: (question: string) => void }) {
  const showThinkingLine = turn.response === null || (turn.response.kind === 'answer' && turn.response.text === '' && !turn.response.done);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <QuestionBubble question={turn.question} />
      {showThinkingLine && <ThinkingLine />}
      {turn.response?.kind === 'answer' && <AnswerBlock text={turn.response.text} done={turn.response.done} />}
      {turn.response?.kind === 'refusal' && <RefusalBlock reason={turn.response.reason} text={turn.response.text} />}
      {turn.response?.kind === 'gate' && <GateBlock reason={turn.response.reason} resetsAt={turn.response.resetsAt} />}
      {turn.response?.kind === 'error' && <ErrorBlock message={turn.response.message} onRetry={() => onRetry(turn.question)} />}
    </div>
  );
}

export default function AskPanel({ chat, pathname, reducedMotion, expanded, onToggleExpand, onClose, returnFocusTo }: AskPanelProps) {
  const [draft, setDraft] = useState('');
  const panelRef = useRef<HTMLDivElement | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const wasSignedIn = useRef(false);
  const { isSignedIn } = useUser();

  useFocusTrap(panelRef, true, returnFocusTo);

  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [expanded]);

  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.turns]);

  useEffect(() => {
    const justSignedIn = isSignedIn === true && wasSignedIn.current === false;
    wasSignedIn.current = isSignedIn === true;
    if (justSignedIn && chat.pendingQuestion) {
      void chat.ask(chat.pendingQuestion);
    }
  }, [isSignedIn, chat]);

  const submit = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || chat.busy) return;
    setDraft('');
    void chat.ask(trimmed);
  };

  const onFormSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit(draft);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit(draft);
    }
  };

  const chips = getStarterChips(pathname);

  const dockedStyle: React.CSSProperties = expanded
    ? {}
    : {
        right: 'clamp(1rem, 4vw, 2rem)',
        bottom: 'calc(clamp(1rem, 4vw, 2rem) + 72px)',
        width: 'min(400px, calc(100vw - 2rem))',
      };

  return (
    <>
      {expanded && <div className="ask-backdrop" onClick={onToggleExpand} />}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        className={`ask-panel-enter ask-panel-surface ${expanded ? 'ask-panel-expanded' : 'ask-panel'}`}
        style={{
          position: 'fixed',
          zIndex: 62,
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(10,14,39,0.97)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.55), 0 0 40px rgba(0,217,255,0.06)',
          overflow: 'hidden',
          ...dockedStyle,
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            padding: '0.9rem 1rem',
            borderBottom: '1px solid rgba(0,217,255,0.1)',
          }}
        >
          <SignalMotif size={30} state={chat.busy ? 'thinking' : 'open'} stage={chat.stage} reducedMotion={reducedMotion} />
          <div style={{ flex: 1 }}>
            <h2
              id={TITLE_ID}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--color-text)',
                margin: 0,
              }}
            >
              Signal
            </h2>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--color-text-muted)', margin: 0, letterSpacing: '0.05em' }}>
              Ask about Tanish&apos;s work
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleExpand}
            aria-label={expanded ? 'Exit fullscreen' : 'Expand to fullscreen'}
            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '4px' }}
          >
            {expanded ? <Minimize2 size={18} strokeWidth={1.5} /> : <Maximize2 size={18} strokeWidth={1.5} />}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Signal"
            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </header>

        <div ref={transcriptRef} style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          <div className={expanded ? 'ask-panel-column' : undefined} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {chat.turns.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--color-text-muted)', margin: 0 }}>
                  Grounded in what Tanish has actually written. Ask something, or start here:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {chips.map((chip, index) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => submit(chip)}
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '0.6rem',
                        textAlign: 'left',
                        fontFamily: 'var(--font-body)',
                        fontSize: '0.82rem',
                        color: 'var(--color-text)',
                        background: 'rgba(0,217,255,0.06)',
                        border: '1px solid rgba(0,217,255,0.16)',
                        borderRadius: '4px',
                        padding: '0.6rem 0.8rem',
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.65rem',
                          color: 'var(--color-accent)',
                          letterSpacing: '0.05em',
                          flexShrink: 0,
                        }}
                      >
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              chat.turns.map((turn) => <TurnBlock key={turn.id} turn={turn} onRetry={submit} />)
            )}
          </div>
        </div>

        <div style={{ padding: '0.85rem', borderTop: '1px solid rgba(0,217,255,0.1)' }}>
          <form onSubmit={onFormSubmit} className={expanded ? 'ask-panel-column' : undefined} style={{ display: 'flex', gap: '0.5rem' }}>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask Signal about Tanish's work"
              rows={1}
              disabled={chat.busy}
              aria-label="Your question"
              style={{
                flex: 1,
                resize: 'none',
                fontFamily: 'var(--font-body)',
                fontSize: '0.85rem',
                color: 'var(--color-text)',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(0,217,255,0.15)',
                borderRadius: '8px',
                padding: '0.55rem 0.7rem',
              }}
            />
            <button
              type="submit"
              disabled={chat.busy || draft.trim().length === 0}
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--color-primary)',
                background: 'var(--color-accent)',
                border: 'none',
                borderRadius: '8px',
                padding: '0 1rem',
                cursor: chat.busy ? 'default' : 'pointer',
                opacity: chat.busy || draft.trim().length === 0 ? 0.5 : 1,
              }}
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
