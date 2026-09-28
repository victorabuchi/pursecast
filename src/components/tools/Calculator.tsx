'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './tools.module.css';
import FloatWindow from './FloatWindow';
import { evaluate, show } from '../../lib/money/calc';
import { lastAmountField, setFieldValue } from './CalcInputs';

// A calculator like the macOS one: grey digits, orange operators, a history
// tape (sidebar button) and extra keys for √, x² and brackets (calculator
// button). Works with the keyboard while it has focus.

type Line = { expr: string; result: string };
const OPS = new Set(['+', '-', '*', '/']);
// Long sums shrink to fit the display, like the real one.
const fit = (text: string) => `${Math.max(18, Math.min(42, 42 - (text.length - 7) * 2.6))}px`;
const pretty = (s: string) => s.replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−').replace(/\./g, ',');

export default function Calculator({ onClose }: { onClose: () => void }) {
  const [expr, setExpr] = useState('');
  const [done, setDone] = useState<Line | null>(null);
  const [tape, setTape] = useState<Line[]>([]);
  const [side, setSide] = useState(false);
  const [sci, setSci] = useState(false);
  const [note, setNote] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const start = useCallback(() => ({ x: document.documentElement.clientWidth - 260, y: 90 }), []);

  const live = expr ? evaluate(expr) : null;

  // The sum lives in a ref too, so fast key presses always build on the
  // latest one rather than on the last render.
  const cur = useRef({ expr: '', done: null as Line | null });
  const set = (next: string, finished: Line | null = null) => {
    cur.current = { expr: next, done: finished };
    setExpr(next);
    setDone(finished);
  };

  const press = useCallback((k: string) => {
    setNote('');
    const { expr: e, done: d } = cur.current;
    if (k === 'AC') return set('');
    if (k === '⌫') return set(e.slice(0, -1));
    if (k === '=') {
      const v = e ? evaluate(e) : null;
      if (v === null) {
        if (e) setNote('Not a complete sum');
        return;
      }
      const line = { expr: e, result: show(v) };
      setTape((t) => [line, ...t].slice(0, 30));
      return set(String(Math.round(v * 1e8) / 1e8), line);
    }
    if (k === '±') {
      const m = /(\(-)?(\d*\.?\d+)$/.exec(e);
      if (!m) return set(e ? `-(${e})` : '-');
      return set(m[1] ? e.slice(0, m.index) + m[2] : `${e.slice(0, m.index)}(-${m[2]}`);
    }
    if (k === 'x²') return set(e ? `${e}^2` : e);
    // After a result, a digit starts over and an operator carries on.
    const base = d && /[\d.√(]/.test(k) ? '' : e;
    const last = base.slice(-1);
    if (OPS.has(k) && OPS.has(last)) return set(base.slice(0, -1) + k);
    if (k === '.' && /\.\d*$/.test(base)) return;
    set(base + k);
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, string> = {
        Enter: '=',
        '=': '=',
        Backspace: '⌫',
        Escape: 'AC',
        Delete: 'AC',
        ',': '.',
        x: '*',
        X: '*',
      };
      const k = map[e.key] ?? (/^[\d.+\-*/%()^]$/.test(e.key) ? e.key : null);
      if (!k) return;
      e.preventDefault();
      press(k);
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [press]);

  const result = done ? done.result : live !== null && expr ? show(live) : '';
  const shown = expr && !done ? pretty(expr) : (result || '0').replace('.', ',');
  const use = () => {
    const field = lastAmountField();
    const value = done?.result ?? (live !== null ? show(live) : '');
    if (!field || !value) return setNote('Click an amount field first');
    setFieldValue(field, value);
    field.focus();
    setNote('Put in the field');
  };
  const copy = async () => {
    const value = done?.result ?? (live !== null ? show(live) : '');
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setNote('Copied');
    } catch {
      setNote(value);
    }
  };

  const keys: Array<[string, string, string]> = [
    ['⌫', 'fn', 'Delete'],
    ['AC', 'fn', 'All clear'],
    ['%', 'fn', 'Percent'],
    ['/', 'op', 'Divide'],
    ['7', 'num', '7'],
    ['8', 'num', '8'],
    ['9', 'num', '9'],
    ['*', 'op', 'Times'],
    ['4', 'num', '4'],
    ['5', 'num', '5'],
    ['6', 'num', '6'],
    ['-', 'op', 'Minus'],
    ['1', 'num', '1'],
    ['2', 'num', '2'],
    ['3', 'num', '3'],
    ['+', 'op', 'Plus'],
    ['±', 'num', 'Change sign'],
    ['0', 'num', '0'],
    ['.', 'num', 'Decimal comma'],
    ['=', 'op', 'Equals'],
  ];
  const label = (k: string) => (k === '⌫' ? <Backspace /> : k === '±' ? '⁺∕₋' : pretty(k));

  return (
    <FloatWindow id="calculator" start={start} className={`${styles.calc} ${side ? styles.calcWide : ''}`} label="Calculator">
      <div ref={box} tabIndex={-1} className={styles.calcInner} onPointerDown={() => box.current?.focus()}>
        {side && (
          <aside className={styles.tape} aria-label="History">
            <b>History</b>
            {tape.length === 0 && <small>Your sums appear here.</small>}
            {tape.map((l, i) => (
              <button key={i} type="button" onClick={() => set(String(evaluate(l.expr) ?? ''))}>
                <small>{pretty(l.expr)}</small>
                {l.result.replace('.', ',')}
              </button>
            ))}
          </aside>
        )}
        <div className={styles.calcMain}>
          <div className={styles.calcBar} data-drag>
            <Lights onClose={onClose} />
            <button type="button" className={styles.roundTool} aria-label="History" aria-pressed={side} onClick={() => setSide((s) => !s)}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="3" />
                <path d="M9 5v14M5.5 9h1.5M5.5 12h1.5M5.5 15h1.5" />
              </svg>
            </button>
            <span className={styles.barSpacer} />
            <button type="button" className={styles.roundTool} aria-label="More keys" aria-pressed={sci} onClick={() => setSci((s) => !s)}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                <rect x="5" y="2.5" width="14" height="19" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <rect x="8" y="5.5" width="8" height="3" rx="1" />
                {[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => <circle key={`${r}${c}`} cx={9 + c * 3} cy={12 + r * 3} r="1" />))}
              </svg>
            </button>
          </div>
          <div className={styles.display} onClick={copy} title="Click to copy">
            <small>{done ? pretty(done.expr) : note || ' '}</small>
            <output aria-live="polite" style={{ fontSize: fit(shown) }}>
                {shown}
              </output>
            <small className={styles.preview}>{!done && result && expr !== result ? `= ${result.replace('.', ',')}` : ' '}</small>
          </div>
          {sci && (
            <div className={styles.keys} style={{ marginBottom: 10 }}>
              {['(', ')', '√', 'x²'].map((k) => (
                <button key={k} type="button" className={`${styles.key} ${styles.keyFn}`} onClick={() => press(k)} aria-label={k === '√' ? 'Square root' : k === 'x²' ? 'Squared' : k}>
                  {k}
                </button>
              ))}
            </div>
          )}
          <div className={styles.keys}>
            {keys.map(([k, kind, aria], i) => (
              <button key={i} type="button" className={`${styles.key} ${kind === 'op' ? styles.keyOp : kind === 'fn' ? styles.keyFn : ''}`} onClick={() => press(k)} aria-label={aria}>
                {label(k)}
              </button>
            ))}
          </div>
          <button type="button" className={styles.useBtn} onClick={use}>
            Use in amount field
          </button>
        </div>
      </div>
    </FloatWindow>
  );
}

function Backspace() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 5h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H8l-6-7Z" />
      <path d="m11 9 6 6M17 9l-6 6" />
    </svg>
  );
}

export function Lights({ onClose, onMin, onMax }: { onClose: () => void; onMin?: () => void; onMax?: () => void }) {
  return (
    <span className={styles.lights}>
      <button type="button" className={styles.lightRed} onClick={onClose} aria-label="Close">
        <svg className={styles.glyph} viewBox="0 0 12 12" width="8" height="8" aria-hidden="true">
          <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      <button type="button" className={styles.lightYellow} onClick={onMin ?? onClose} aria-label="Minimise">
        <svg className={styles.glyph} viewBox="0 0 12 12" width="8" height="8" aria-hidden="true">
          <path d="M2.5 6h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
      <button type="button" className={styles.lightGreen} onClick={onMax} aria-label="Zoom" disabled={!onMax}>
        {onMax && (
          <svg className={styles.glyph} viewBox="0 0 12 12" width="8" height="8" aria-hidden="true">
            <path d="M3.2 8.8V4.4l4.4 4.4ZM8.8 3.2v4.4L4.4 3.2Z" fill="currentColor" />
          </svg>
        )}
      </button>
    </span>
  );
}
