'use client';

import { useEffect, useState } from 'react';
import { DRAFT_PREFIX } from '../../lib/drafts';

// Setup page drafts, kept in this browser so nothing typed is lost on a
// reload or an error.

function read<T>(key: string): T | undefined {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private windows and full storage: the page still works, just unsaved.
  }
}

// Like useState, but restored from and saved to the draft when a key is given.
export function useDraft<T>(key: string | undefined, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);
  // Saving starts only after the saved draft is restored, so the empty
  // first render never overwrites it.
  const [ready, setReady] = useState(!key);
  useEffect(() => {
    if (!key) return;
    const saved = read<T>(key);
    queueMicrotask(() => {
      if (saved !== undefined) setValue(saved);
      setReady(true);
    });
  }, [key]);
  useEffect(() => {
    if (key && ready) write(key, value);
  }, [key, ready, value]);
  return [value, setValue];
}

export function clearDrafts(): void {
  try {
    for (const k of Object.keys(window.localStorage)) if (k.startsWith(DRAFT_PREFIX)) window.localStorage.removeItem(k);
  } catch {
    // Nothing to clear.
  }
}
