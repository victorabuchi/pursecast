'use client';

import { useState } from 'react';
import styles from './app.module.css';
import I from './Icon';
import { currencySymbol, money } from '../../lib/money/format';
import { useDraft } from './draft';
import { amountOf } from '../../lib/money/calc';

export type BudgetOption = { name: string; amount: number; color?: string; spent?: number; cut?: number };

// Everyday budgets added one at a time from a dropdown, or typed as a new
// category, instead of every category at once. Posts budgetName{i} and
// budgetAmount{i}, and budgetsAll so removed ones go back to zero.
export default function BudgetPicker({ options, initial, currency, draftKey }: { options: BudgetOption[]; initial: string[]; currency: string; draftKey?: string }) {
  const [shown, setShown] = useDraft<string[]>(draftKey && `${draftKey}shown`, initial);
  const [amounts, setAmounts] = useDraft<Record<string, string>>(draftKey && `${draftKey}amounts`, Object.fromEntries(options.map((o) => [o.name, o.amount ? String(o.amount / 100) : ''])));
  const [custom, setCustom] = useState(false);
  const [newName, setNewName] = useState('');
  const byName = new Map(options.map((o) => [o.name, o]));
  const hidden = options.filter((o) => !shown.includes(o.name));
  const sym = currencySymbol(currency);
  const total = shown.reduce((s, n) => s + amountOf(amounts[n] ?? ''), 0);

  const add = (name: string) => {
    const clean = name.trim().slice(0, 40);
    if (!clean || shown.some((n) => n.toLowerCase() === clean.toLowerCase())) return;
    setShown((s) => [...s, clean]);
  };

  return (
    <div className={styles.stack} style={{ gap: 0 }}>
      <input type="hidden" name="budgetsAll" value="1" />
      {shown.length === 0 && <p className={styles.note}>No everyday budgets yet. Add the ones you spend on.</p>}
      {shown.map((name, i) => {
        const o = byName.get(name);
        const spent = o?.spent;
        const planned = Math.max(0, Math.round(amountOf(amounts[name] ?? '') * 100) - (o?.cut ?? 0));
        const used = spent !== undefined ? Math.min(100, planned ? (spent / planned) * 100 : spent ? 100 : 0) : null;
        return (
          <div key={name} className={styles.budgetRow} style={{ gridTemplateColumns: 'minmax(0,1fr) 130px 30px' }}>
            <div>
              <span>
                <b>{name}</b>
                {spent !== undefined && (
                  <span className={`${styles.num} ${styles.muted}`}>
                    {money(spent, currency)} of {money(planned, currency)}
                    {o?.cut ? ` (−${money(o.cut, currency)} this month)` : ''}
                  </span>
                )}
              </span>
              {used !== null && (
                <div className={styles.meter}>
                  <span style={{ width: `${used}%`, background: used >= 100 ? '#e5484d' : used > 80 ? '#f5a524' : (o?.color ?? undefined) }} />
                </div>
              )}
            </div>
            <input type="hidden" name={`budgetName${i}`} value={name} />
            <span className={styles.money}>
              <span>{sym}</span>
              <input className={styles.input} name={`budgetAmount${i}`} inputMode="decimal" value={amounts[name] ?? ''} placeholder="0" onChange={(e) => setAmounts((a) => ({ ...a, [name]: e.target.value }))} aria-label={`${name} per month`} />
            </span>
            <button type="button" className={styles.xBtn} aria-label={`Remove ${name}`} onClick={() => setShown((s) => s.filter((n) => n !== name))}>
              <I d="x" size={14} />
            </button>
          </div>
        );
      })}
      <div className={styles.row} style={{ paddingTop: 12, borderTop: '1px solid var(--line)', alignItems: 'center' }}>
        {custom ? (
          <>
            <input
              className={styles.input}
              value={newName}
              autoFocus
              placeholder="Climbing"
              maxLength={40}
              aria-label="New category name"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  add(newName);
                  setNewName('');
                  setCustom(false);
                }
              }}
            />
            <button
              type="button"
              className={`${styles.btnGhost} ${styles.btnSmall}`}
              style={{ flex: 'none' }}
              onClick={() => {
                add(newName);
                setNewName('');
                setCustom(false);
              }}
            >
              Add
            </button>
          </>
        ) : (
          <select
            className={styles.select}
            value=""
            aria-label="Add everyday spending"
            onChange={(e) => {
              if (e.target.value === '__new') setCustom(true);
              else add(e.target.value);
            }}
          >
            <option value="">+ Add everyday spending…</option>
            {hidden.map((o) => (
              <option key={o.name} value={o.name}>
                {o.name}
                {o.amount ? ` · suggested ${money(o.amount, currency)}` : ''}
              </option>
            ))}
            <option value="__new">New category…</option>
          </select>
        )}
        <span className={styles.cardSub} style={{ flex: 'none' }}>
          {money(total * 100, currency)} a month
        </span>
      </div>
    </div>
  );
}
