'use client';

import { useCallback, useSyncExternalStore } from 'react';

const registry = new Map<string, Set<() => void>>();

function listenersFor(key: string): Set<() => void> {
  const existing = registry.get(key);
  if (existing) return existing;
  const created = new Set<() => void>();
  registry.set(key, created);
  return created;
}

function persist(key: string, value: boolean): void {
  sessionStorage.setItem(key, value ? '1' : '0');
  listenersFor(key).forEach((listener) => listener());
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * A boolean persisted to `sessionStorage` under `key`, via `useSyncExternalStore` (not a
 * read-then-setState effect) so the server/client snapshot mismatch never surfaces as a
 * hydration warning. Shared by any state that must survive client-side navigation.
 */
export function useSessionBoolean(key: string): [boolean, (next: boolean | ((prev: boolean) => boolean)) => void] {
  const getSnapshot = useCallback(() => sessionStorage.getItem(key) === '1', [key]);
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const listeners = listenersFor(key);
      listeners.add(onStoreChange);
      return () => listeners.delete(onStoreChange);
    },
    [key],
  );

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const resolved = typeof next === 'function' ? next(sessionStorage.getItem(key) === '1') : next;
      persist(key, resolved);
    },
    [key],
  );

  return [value, setValue];
}
