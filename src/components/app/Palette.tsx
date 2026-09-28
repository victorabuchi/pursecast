'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './app.module.css';
import I from './Icon';

export type PaletteItem = { group: string; label: string; hint?: string; href: string };

// Search with Cmd/Ctrl+K over pages, actions and your own records.
export default function Palette({ items }: { items: PaletteItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [index, setIndex] = useState(0);
  const [mac, setMac] = useState(true);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!/Mac|iPhone|iPad/.test(navigator.platform)) queueMicrotask(() => setMac(false));
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = query ? items.filter((i) => `${i.label} ${i.hint ?? ''} ${i.group}`.toLowerCase().includes(query)) : items.filter((i) => i.group === 'Go to' || i.group === 'Do');
    return list.slice(0, 40);
  }, [items, q]);

  const go = (item: PaletteItem | undefined) => {
    if (!item) return;
    setOpen(false);
    setQ('');
    setIndex(0);
    router.push(item.href);
  };

  return (
    <>
      <button type="button" className={styles.search} onClick={() => setOpen(true)}>
        <I d="search" size={15} />
        Search
        <kbd>{mac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>
      <button type="button" className={`${styles.iconBtn} ${styles.searchPhone}`} onClick={() => setOpen(true)} aria-label="Search">
        <I d="search" />
      </button>
      <dialog
        ref={dialog}
        className={styles.palette}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
      >
        {open && (
          <>
            <div className={styles.paletteSearch}>
              <I d="search" size={18} />
              <input
                autoFocus
                value={q}
                placeholder="Search spending, forks, events…"
                aria-label="Search"
                onChange={(e) => {
                  setQ(e.target.value);
                  setIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setIndex((i) => Math.min(i + 1, results.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setIndex((i) => Math.max(i - 1, 0));
                  } else if (e.key === 'Enter') go(results[index]);
                }}
              />
              <kbd>Esc</kbd>
            </div>
            <div className={styles.paletteList} role="listbox">
              {results.length === 0 && <p className={styles.popEmpty}>Nothing matches “{q}”.</p>}
              {results.map((item, i) => (
                <div key={`${item.group}|${item.href}|${item.label}|${i}`}>
                  {item.group !== results[i - 1]?.group && <div className={styles.popLabel}>{item.group}</div>}
                  <button type="button" role="option" aria-selected={i === index} className={styles.paletteItem} onMouseEnter={() => setIndex(i)} onClick={() => go(item)}>
                    <span>{item.label}</span>
                    {item.hint && <span className={styles.paletteHint}>{item.hint}</span>}
                    {i === index && <span className={styles.paletteEnter}>↵</span>}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
