'use client';

import { useSessionBoolean } from './useSessionBoolean';

const STORAGE_KEY = 'ask-signal-expanded';

/** Whether the panel is fullscreen-expanded, backed by `sessionStorage` so it survives navigation. */
export function useExpandPersistence(): [boolean, (next: boolean | ((prev: boolean) => boolean)) => void] {
  return useSessionBoolean(STORAGE_KEY);
}
