'use client';

import { useSyncExternalStore } from 'react';
import styles from './app.module.css';
import I, { type IconName } from './Icon';

type Theme = 'system' | 'light' | 'dark';
const KEY = 'pursecast:theme';
const OPTIONS: Array<[Theme, string, IconName]> = [
  ['system', 'Automatic', 'sliders'],
  ['light', 'Light', 'sun'],
  ['dark', 'Dark', 'moon'],
];

function read(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

function pick(t: Theme) {
  try {
    if (t === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {}
  const root = document.documentElement;
  if (t === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t);
  listeners.forEach((fn) => fn());
}

// Light, dark, or whatever the device uses. Saved on this device.
export default function ThemePicker() {
  const theme = useSyncExternalStore(subscribe, read, () => 'system' as Theme);
  return (
    <div className={styles.segment} role="radiogroup" aria-label="Appearance">
      {OPTIONS.map(([t, label, icon]) => (
        <button key={t} type="button" role="radio" aria-checked={theme === t} data-on={theme === t} onClick={() => pick(t)}>
          <I d={icon} size={15} /> {label}
        </button>
      ))}
    </div>
  );
}
