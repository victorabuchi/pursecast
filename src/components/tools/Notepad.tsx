'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './tools.module.css';
import FloatWindow from './FloatWindow';
import { Lights } from './Calculator';
import { saveNotepadAction } from '../../lib/money/note-actions';

// A note like macOS Notes, saved to the account as it is typed. Lines that
// start with ☐ are a checklist; clicking the box ticks it.

const SIZES = [14, 16, 19];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function stamp(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  return `${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()} at ${d.getHours()}.${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function Notepad({ initial, savedAt, onClose }: { initial: string; savedAt: string | null; onClose: () => void }) {
  const [text, setText] = useState(initial);
  const [at, setAt] = useState(savedAt);
  const [saving, setSaving] = useState(false);
  const [size, setSize] = useState(1);
  const [min, setMin] = useState(false);
  const [big, setBig] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<number | null>(null);
  const start = useCallback(() => ({ x: Math.max(16, document.documentElement.clientWidth - 760), y: 110 }), []);

  const save = useCallback((value: string) => {
    if (timer.current) window.clearTimeout(timer.current);
    setSaving(true);
    timer.current = window.setTimeout(async () => {
      try {
        setAt(await saveNotepadAction(value));
      } finally {
        setSaving(false);
      }
    }, 700);
  }, []);
  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), []);

  const change = (value: string) => {
    setText(value);
    save(value);
  };

  // Adds or removes ☐ at the start of the line the cursor is on.
  const checklist = () => {
    const el = area.current;
    if (!el) return;
    const pos = el.selectionStart;
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    const has = /^[☐☑] /.test(text.slice(lineStart));
    const next = has ? text.slice(0, lineStart) + text.slice(lineStart + 2) : `${text.slice(0, lineStart)}☐ ${text.slice(lineStart)}`;
    change(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = Math.max(lineStart, pos + (has ? -2 : 2));
    });
  };

  // Clicking right on a box ticks or unticks it.
  const tick = () => {
    const el = area.current;
    if (!el || el.selectionStart !== el.selectionEnd) return;
    const pos = el.selectionStart;
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    if (pos - lineStart > 1 || !/^[☐☑]/.test(text.slice(lineStart))) return;
    change(text.slice(0, lineStart) + (text[lineStart] === '☐' ? '☑' : '☐') + text.slice(lineStart + 1));
  };

  const title =
    text
      .split('\n')[0]
      ?.replace(/^[☐☑] /, '')
      .trim()
      .slice(0, 40) || 'New Note';

  return (
    <FloatWindow id="notepad" start={start} className={`${styles.note} ${big ? styles.noteBig : ''} ${min ? styles.noteMin : ''}`} label="Note">
      <div className={styles.noteBar} data-drag>
        <Lights onClose={onClose} onMin={() => setMin((m) => !m)} onMax={() => setBig((b) => !b)} />
        <b className={styles.noteTitle}>{title}</b>
        {!min && (
          <span className={styles.noteTools}>
            <button type="button" aria-label="Text size" title="Text size" onClick={() => setSize((s) => (s + 1) % SIZES.length)}>
              Aa
            </button>
            <button type="button" aria-label="Checklist" title="Checklist" onClick={checklist}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="m3.5 6.5 1.5 1.5 3-3M11 7h10M11 17h10" />
                <circle cx="5.5" cy="17" r="2.5" />
              </svg>
            </button>
          </span>
        )}
      </div>
      {!min && (
        <>
          <p className={styles.noteDate}>{saving ? 'Saving…' : stamp(at)}</p>
          <textarea
            ref={area}
            className={styles.noteText}
            style={{ fontSize: SIZES[size] }}
            value={text}
            onChange={(e) => change(e.target.value)}
            onClick={tick}
            placeholder="Jot anything: a shopping list, what to cancel, a sum to check…"
            aria-label="Note"
            autoFocus={!initial}
            maxLength={20000}
            spellCheck
          />
        </>
      )}
    </FloatWindow>
  );
}
