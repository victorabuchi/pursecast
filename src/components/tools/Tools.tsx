'use client';

import { useEffect, useState } from 'react';
import Calculator from './Calculator';
import Notepad from './Notepad';
import CalcInputs from './CalcInputs';

// Top bar buttons for the floating calculator and note. Which ones are open
// is remembered in this browser.
export default function Tools({ notepad, notepadAt, buttonClass }: { notepad: string; notepadAt: string | null; buttonClass: string }) {
  const [open, setOpen] = useState<{ calc: boolean; note: boolean }>({
    calc: false,
    note: false,
  });
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem('pursecast:tools') ?? 'null');
      if (saved) queueMicrotask(() => setOpen(saved));
    } catch {
      // Closed by default.
    }
  }, []);
  const toggle = (k: 'calc' | 'note', v?: boolean) =>
    setOpen((o) => {
      const next = { ...o, [k]: v ?? !o[k] };
      try {
        window.localStorage.setItem('pursecast:tools', JSON.stringify(next));
      } catch {
        // Not remembered.
      }
      return next;
    });

  return (
    <>
      <button type="button" className={buttonClass} aria-label="Calculator" aria-pressed={open.calc} title="Calculator" onClick={() => toggle('calc')}>
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <rect x="5" y="2.5" width="14" height="19" rx="3" />
          <path d="M8.5 6.5h7M9 11h.01M12 11h.01M15 11h.01M9 14.5h.01M12 14.5h.01M15 14.5h.01M9 18h.01M12 18h.01M15 18h.01" />
        </svg>
      </button>
      <button type="button" className={buttonClass} aria-label="Note" aria-pressed={open.note} title="Note" onClick={() => toggle('note')}>
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
          <path d="M14 3v6h6M8 13h8M8 17h5" />
        </svg>
      </button>
      {open.calc && <Calculator onClose={() => toggle('calc', false)} />}
      {open.note && <Notepad initial={notepad} savedAt={notepadAt} onClose={() => toggle('note', false)} />}
      <CalcInputs />
    </>
  );
}
