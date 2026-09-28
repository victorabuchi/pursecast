'use client';

import { useEffect, useRef } from 'react';
import { clearDrafts } from './draft';

// Remembers the plain fields of the form it sits in (by name), restoring
// them on the next visit. Row components keep their own drafts.
export function FormDraft({ storageKey, names }: { storageKey: string; names: string[] }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = ref.current?.closest('form');
    if (!form) return;
    const fields = () => names.flatMap((n) => [...form.querySelectorAll<HTMLInputElement | HTMLSelectElement>(`[name="${n}"]`)]);
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? '{}') as Record<string, string | boolean>;
      for (const el of fields()) {
        const v = saved[el instanceof HTMLInputElement && el.type === 'radio' ? `${el.name}=${el.value}` : el.name];
        if (v === undefined) continue;
        if (el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox')) el.checked = Boolean(v);
        else el.value = String(v);
      }
      if (saved['__open']) form.querySelectorAll('details').forEach((d) => (d.open = true));
    } catch {
      // No saved draft.
    }
    const save = () => {
      const out: Record<string, string | boolean> = {};
      for (const el of fields()) {
        if (el instanceof HTMLInputElement && el.type === 'radio') out[`${el.name}=${el.value}`] = el.checked;
        else out[el.name] = el.value;
      }
      out['__open'] = [...form.querySelectorAll('details')].some((d) => d.open);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(out));
      } catch {
        // Storage unavailable.
      }
    };
    form.addEventListener('input', save);
    form.addEventListener('change', save);
    form.addEventListener('toggle', save, true);
    return () => {
      form.removeEventListener('input', save);
      form.removeEventListener('change', save);
      form.removeEventListener('toggle', save, true);
    };
  }, [storageKey, names]);
  return <span ref={ref} hidden />;
}

// Drafts go once setup is saved (the save lands on ?setup=saved), not merely
// because the app was opened.
export function ClearSetupDraft() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('setup') !== 'saved') return;
    clearDrafts();
    url.searchParams.delete('setup');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }, []);
  return null;
}

// Removes this person's drafts from older versions of their data.
export function DraftJanitor({ keep, userPrefix }: { keep: string; userPrefix: string }) {
  useEffect(() => {
    try {
      for (const key of Object.keys(window.localStorage)) if (key.startsWith(userPrefix) && !key.startsWith(keep)) window.localStorage.removeItem(key);
    } catch {
      // Nothing to tidy.
    }
  }, [keep, userPrefix]);
  return null;
}
