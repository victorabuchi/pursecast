'use client';

import { useState } from 'react';
import styles from './app.module.css';
import I from './Icon';
import Submit from './Submit';
import { CloseButton } from './Sheet';
import { MoneyInput, SignToggle } from './Fields';
import { createForkAction } from '../../lib/money/actions';
import { currencySymbol, money, parseAmount } from '../../lib/money/format';

type Row = { key: number; name: string; sign: '-' | '+'; amount: string; base?: number };
type Base = { id: string; name: string; amount: number };

// "What if I…" and the monthly differences it makes. A row can start from an
// existing bill or income: type its new amount and the difference is used.
export default function NewFork({ currency, bases }: { currency: string; bases: Base[] }) {
  const [rows, setRows] = useState<Row[]>([{ key: 0, name: '', sign: '+', amount: '' }]);
  const [next, setNext] = useState(1);
  const add = (row: Omit<Row, 'key'>) => {
    setRows((r) => [...r.filter((x) => x.name || x.amount), { ...row, key: next }]);
    setNext((n) => n + 1);
  };
  const update = (key: number, patch: Partial<Row>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const sym = currencySymbol(currency);

  return (
    <form action={createForkAction} className={styles.form}>
      <label className={styles.whatIf}>
        <small>What if I…</small>
        <input name="name" placeholder="move to Austin" autoFocus required maxLength={80} autoComplete="off" />
      </label>

      <div className={styles.field}>
        Each month it would change
        <small>A new salary, rent, a car you would not need. Plus means more money.</small>
      </div>
      {rows.map((r, i) => {
        const typed = parseAmount(r.amount);
        // For a row based on a bill, the typed value is the new amount.
        const delta = r.base !== undefined && typed !== null ? (r.base < 0 ? -typed : typed) - r.base : null;
        return (
          <div key={r.key} className={styles.effRow}>
            <input className={styles.input} placeholder={i === 0 ? 'Salary' : 'Rent'} value={r.name} onChange={(e) => update(r.key, { name: e.target.value })} aria-label="What changes" />
            {r.base === undefined ? (
              <span className={styles.sign}>
                {(['-', '+'] as const).map((s) => (
                  <label key={s}>
                    <input type="radio" checked={r.sign === s} onChange={() => update(r.key, { sign: s })} />
                    {s === '-' ? '−' : '+'}
                  </label>
                ))}
              </span>
            ) : (
              <small className={styles.muted} style={{ whiteSpace: 'nowrap' }}>
                now {money(Math.abs(r.base), currency)}
              </small>
            )}
            <span className={styles.money}>
              <span>{sym}</span>
              <input className={styles.input} inputMode="decimal" placeholder={r.base !== undefined ? 'New' : '0'} value={r.amount} onChange={(e) => update(r.key, { amount: e.target.value })} aria-label="Amount per month" />
            </span>
            <button type="button" className={styles.xBtn} aria-label="Remove" onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : [{ key: next, name: '', sign: '+', amount: '' }]))}>
              <I d="x" size={14} />
            </button>
            <input type="hidden" name={`effName${i}`} value={r.name} />
            <input type="hidden" name={`effSign${i}`} value={delta !== null ? (delta < 0 ? '-' : '+') : r.sign} />
            <input type="hidden" name={`effAmount${i}`} value={delta !== null ? String(Math.abs(delta) / 100) : r.amount} />
            {delta !== null && delta !== 0 && (
              <small className={delta > 0 ? styles.pos : styles.neg} style={{ gridColumn: '1 / -1', fontWeight: 700 }}>
                {money(delta, currency, { sign: true })} / mo
              </small>
            )}
          </div>
        );
      })}
      <div className={styles.row}>
        <button type="button" className={`${styles.btnGhost} ${styles.btnSmall}`} onClick={() => add({ name: '', sign: '+', amount: '' })} disabled={rows.length >= 8}>
          <I d="plus" size={14} stroke={2.6} /> Add a change
        </button>
        {bases.length > 0 && (
          <select
            className={styles.select}
            value=""
            onChange={(e) => {
              const b = bases.find((x) => x.id === e.target.value);
              if (b) add({ name: b.name, sign: b.amount < 0 ? '-' : '+', amount: '', base: b.amount });
            }}
            aria-label="Change a bill or income"
          >
            <option value="">Change a bill or income…</option>
            {bases.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} · {money(b.amount, currency)}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className={styles.field}>
        One-off cost or gain when it starts
        <div className={styles.row}>
          <SignToggle name="oneTimeSign" value="-" label="Cost or gain" />
          <MoneyInput name="oneTime" currency={currency} placeholder="Moving costs" label="One-off amount" />
        </div>
      </div>

      <div className={styles.sheetActions}>
        <CloseButton className={styles.btnGhost}>Cancel</CloseButton>
        <Submit className={styles.btn} pending="Creating…">
          Create fork
        </Submit>
      </div>
    </form>
  );
}
