'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

import AskPanel from './AskPanel';
import SignalMotif, { type SignalState } from './SignalMotif';
import { useAskChat } from './useAskChat';
import { useOpenPersistence } from './useOpenPersistence';
import { useReducedMotion } from './useReducedMotion';

/**
 * The Signal node: a squircle radar motif taken from the hero visualization, fixed bottom-right on
 * every page. The orbit accelerates while the agent works, driven by the `status` stream part.
 * Open state persists across navigation via sessionStorage. Respects prefers-reduced-motion.
 */
export default function AskFab() {
  const [open, setOpen] = useOpenPersistence();
  const [hovered, setHovered] = useState(false);
  const fabRef = useRef<HTMLButtonElement | null>(null);
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();
  const chat = useAskChat();

  useEffect(() => {
    if (!open) return;
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeydown);
    return () => document.removeEventListener('keydown', onKeydown);
  }, [open, setOpen]);

  const close = useCallback(() => setOpen(false), [setOpen]);
  const toggle = useCallback(() => setOpen((prev) => !prev), [setOpen]);

  const fabState: SignalState = chat.busy ? 'thinking' : open ? 'open' : hovered ? 'hover' : 'idle';

  return (
    <>
      <button
        ref={fabRef}
        type="button"
        onClick={toggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={open ? 'Close Signal, the ask-Tanish agent' : 'Open Signal, the ask-Tanish agent'}
        className="ask-fab-enter"
        style={{
          position: 'fixed',
          right: 'clamp(1rem, 4vw, 2rem)',
          bottom: 'clamp(1rem, 4vw, 2rem)',
          zIndex: 60,
          width: 60,
          height: 60,
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          filter: chat.busy ? 'drop-shadow(0 0 18px rgba(0,217,255,0.35))' : 'drop-shadow(0 4px 20px rgba(0,0,0,0.45))',
          transition: 'filter var(--transition-base)',
        }}
      >
        <SignalMotif size={60} state={fabState} stage={chat.stage} reducedMotion={reducedMotion} />
      </button>

      {open && (
        <AskPanel
          chat={chat}
          pathname={pathname ?? '/'}
          reducedMotion={reducedMotion}
          onClose={close}
          returnFocusTo={fabRef}
        />
      )}
    </>
  );
}
