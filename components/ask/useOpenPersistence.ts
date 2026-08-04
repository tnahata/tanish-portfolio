'use client';

import { useSessionBoolean } from './useSessionBoolean';

const STORAGE_KEY = 'ask-signal-open';

/** The panel's open state, backed by `sessionStorage` so it survives client-side navigation. */
export function useOpenPersistence(): [boolean, (next: boolean | ((prev: boolean) => boolean)) => void] {
  return useSessionBoolean(STORAGE_KEY);
}
