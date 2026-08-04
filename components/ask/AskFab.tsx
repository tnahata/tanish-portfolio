'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

import AskPanel from './AskPanel';
import SignalMotif, { type SignalState } from './SignalMotif';
import { useAskChat } from './useAskChat';
import { useExpandPersistence } from './useExpandPersistence';
import { useOpenPersistence } from './useOpenPersistence';
import { useReducedMotion } from './useReducedMotion';

/**
 * The Signal node: a squircle radar motif taken from the hero visualization, fixed bottom-right on
 * every page. The orbit accelerates while the agent works, driven by the `status` stream part.
 * Open state persists across navigation via sessionStorage. Respects prefers-reduced-motion.
 */
export default function AskFab() {
  const [open, setOpen] = useOpenPersistence();
  const [expanded, setExpanded] = useExpandPersistence();
  const [hovered, setHovered] = useState(false);
  const fabRef = useRef<HTMLButtonElement | null>(null);
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();
  const chat = useAskChat();

  const close = useCallback(() => {
    setOpen(false);
    setExpanded(false);
  }, [setOpen, setExpanded]);
  const toggle = useCallback(() => setOpen((prev) => !prev), [setOpen]);
  const toggleExpand = useCallback(() => setExpanded((prev) => !prev), [setExpanded]);

  useEffect(() => {
    if (!open) return;
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (expanded) setExpanded(false);
      else close();
    };
    document.addEventListener('keydown', onKeydown);
    return () => document.removeEventListener('keydown', onKeydown);
  }, [open, expanded, close, setExpanded]);

  const fabState: SignalState = chat.busy ? 'thinking' : open ? 'open' : hovered ? 'hover' : 'idle';

  /**
   * A quiet cyan halo at rest, not just a black drop shadow, so the FAB reads as a lit instrument
   * on the dark hero rather than a plain dark disc. Thinking's halo stays the brightest by far.
   */
  const FAB_GLOW: Record<SignalState, string> = {
    idle: 'drop-shadow(0 0 9px rgba(0,217,255,0.22)) drop-shadow(0 4px 16px rgba(0,0,0,0.4))',
    hover: 'drop-shadow(0 0 16px rgba(0,217,255,0.4)) drop-shadow(0 4px 18px rgba(0,0,0,0.42))',
    open: 'drop-shadow(0 0 9px rgba(0,217,255,0.22)) drop-shadow(0 4px 16px rgba(0,0,0,0.4))',
    thinking: 'drop-shadow(0 0 18px rgba(0,217,255,0.35))',
  };

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
          filter: FAB_GLOW[fabState],
          transform: hovered && !chat.busy ? 'scale(1.05)' : 'scale(1)',
          transition: 'filter var(--transition-base), transform var(--transition-base)',
        }}
      >
        <SignalMotif size={60} state={fabState} stage={chat.stage} reducedMotion={reducedMotion} />
      </button>

      {open && (
        <AskPanel
          chat={chat}
          pathname={pathname ?? '/'}
          reducedMotion={reducedMotion}
          expanded={expanded}
          onToggleExpand={toggleExpand}
          onClose={close}
          returnFocusTo={fabRef}
        />
      )}
    </>
  );
}
