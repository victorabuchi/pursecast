'use client';

import styles from './app.module.css';
import I from './Icon';
import { useDraft } from './draft';
import { CADENCES, type Cadence } from '../../lib/money/recurrence';
import { currencySymbol } from '../../lib/money/format';

export type Preset = { name: string; amount?: number; cadence?: Cadence };
export type RepeatRow = { key: number; id?: string; name: string; amount: string; cadence: Cadence; date: string };
type Row = RepeatRow;

// Bills or subscriptions added one at a time: pick a popular one from the
// dropdown (its usual price filled in) or "Something else", and remove any
// row with ×. Fields are named `${prefix}Name0`, `${prefix}Amount0` and so on.
export default function RepeatRows({ prefix, presets, currency, today, addLabel, max = 20, draftKey, initialRows = [] }: { prefix: string; presets: Preset[]; currency: string; today: string; addLabel: string; max?: number; draftKey?: string; initialRows?: Row[] }) {
  const [rows, setRows] = useDraft<Row[]>(draftKey, initialRows);
  const next = rows.reduce((m, r) => Math.max(m, r.key + 1), 0);
  const sym = currencySymbol(currency);
  const taken = new Set(rows.map((r) => r.name.toLowerCase()));
  const left = presets.filter((p) => !taken.has(p.name.toLowerCase()));

  const add = (p: Preset | null) => {
    if (rows.length >= max) return;
    setRows((rs) => [...rs, { key: next, name: p?.name ?? '', amount: p?.amount ? String(p.amount / 100) : '', cadence: p?.cadence ?? 'monthly', date: '' }]);
  };
  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <>
      {rows.map((r, i) => (
        <div key={r.key} className={styles.repeatRow}>
          <input className={styles.input} name={`${prefix}Name${i}`} value={r.name} placeholder="Name" autoFocus={!r.name} onChange={(e) => update(r.key, { name: e.target.value })} aria-label={`Name ${i + 1}`} maxLength={80} />
          <span className={styles.money}>
            <span>{sym}</span>
            <input className={styles.input} name={`${prefix}Amount${i}`} inputMode="decimal" value={r.amount} placeholder="0" autoFocus={Boolean(r.name) && !r.amount} onChange={(e) => update(r.key, { amount: e.target.value })} aria-label={`${r.name || 'Amount'} amount`} />
          </span>
          <select name={`${prefix}Cadence${i}`} className={styles.select} value={r.cadence} onChange={(e) => update(r.key, { cadence: e.target.value as Cadence })} aria-label={`${r.name || 'Item'} how often`}>
            {CADENCES.map(([c, label]) => (
              <option key={c} value={c}>
                {label}
              </option>
            ))}
          </select>
          <input className={styles.input} type="date" name={`${prefix}Date${i}`} min={today} value={r.date} onChange={(e) => update(r.key, { date: e.target.value })} aria-label={`${r.name || 'Item'} next due date`} />
          <button type="button" className={styles.xBtn} aria-label={`Remove ${r.name || 'row'}`} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
            <I d="x" size={14} />
          </button>
          {r.id && <input type="hidden" name={`${prefix}Id${i}`} value={r.id} />}
        </div>
      ))}
      {rows.some((r) => r.amount && presets.some((p) => p.name === r.name && p.amount)) && <p className={styles.note}>Prices filled in are typical ones. Check yours.</p>}
      {rows.length < max && (
        <select
          className={styles.select}
          value=""
          aria-label={addLabel}
          onChange={(e) => {
            if (e.target.value === '__other') add(null);
            else add(left.find((p) => p.name === e.target.value) ?? null);
          }}
        >
          <option value="">+ {addLabel}…</option>
          {left.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
          <option value="__other">Something else…</option>
        </select>
      )}
    </>
  );
}
