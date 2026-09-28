import { redirect } from 'next/navigation';
import { isDay } from './dates';
import { parseAmount } from './format';

// Small helpers for server actions. Not a 'use server' file, so it can export
// plain functions.

export const str = (f: FormData, k: string, max = 200) => String(f.get(k) ?? '').trim().slice(0, max);

// Positive cents from a form field, or null.
export function cents(f: FormData, k: string): number | null {
  const v = parseAmount(str(f, k, 40));
  return v !== null && v >= 0 && v < 100_000_000_00 ? v : null;
}

export function day(f: FormData, k: string): string | null {
  const v = str(f, k, 10);
  return isDay(v) ? v : null;
}

// Only paths inside the app, never another site.
export function backTo(f: FormData, fallback: string): string {
  const b = str(f, 'back', 300);
  return b.startsWith('/') && !b.startsWith('//') ? b : fallback;
}

// Redirect with a one-off toast (or error) message shown by <Toast />.
export function done(path: string, toast: string, kind: 'toast' | 'error' = 'toast'): never {
  const [withoutHash, hash = ''] = path.split('#');
  const [p, q = ''] = withoutHash!.split('?');
  const search = new URLSearchParams(q);
  search.set(kind, toast);
  redirect(`${p}?${search.toString()}${hash ? `#${hash}` : ''}`);
}
