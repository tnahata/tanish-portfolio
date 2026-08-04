'use client';

import { useEffect } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Traps Tab focus inside `containerRef` while `active`, and restores focus to `returnFocusTo` on cleanup. */
export function useFocusTrap(containerRef: React.RefObject<HTMLElement | null>, active: boolean, returnFocusTo: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    const first = focusables()[0];
    first?.focus();

    const onKeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const elements = focusables();
      if (elements.length === 0) return;

      const firstEl = elements[0];
      const lastEl = elements[elements.length - 1];

      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };

    container.addEventListener('keydown', onKeydown);
    const returnTarget = returnFocusTo.current;
    return () => {
      container.removeEventListener('keydown', onKeydown);
      (returnTarget ?? previouslyFocused)?.focus();
    };
  }, [active, containerRef, returnFocusTo]);
}
