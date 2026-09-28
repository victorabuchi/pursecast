'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './app.module.css';

// A button with a small panel under it that closes on outside click or Escape.
export default function Popover({ button, label, className, wide, children }: { button: React.ReactNode; label: string; className?: string; wide?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className={styles.popWrap}>
      <button type="button" className={className} aria-label={label} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {button}
      </button>
      {open && <div className={`${styles.pop} ${wide ? styles.popWide : ''}`}>{children}</div>}
    </div>
  );
}
