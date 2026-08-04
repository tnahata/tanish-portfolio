'use client';

import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'ask-signal-open';
const listeners = new Set<() => void>();

function getSnapshot(): boolean {
  return sessionStorage.getItem(STORAGE_KEY) === '1';
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function persist(value: boolean): void {
  sessionStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  listeners.forEach((listener) => listener());
}

/**
 * The panel's open state, backed by `sessionStorage` so it survives client-side navigation.
 * `useSyncExternalStore` (not a read-then-setState effect) is what keeps the server/client
 * snapshot mismatch from ever surfacing as a hydration warning.
 */
export function useOpenPersistence(): [boolean, (next: boolean | ((prev: boolean) => boolean)) => void] {
  const open = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setOpen = useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    const resolved = typeof next === 'function' ? next(getSnapshot()) : next;
    persist(resolved);
  }, []);

  return [open, setOpen];
}
