'use client';

import styles from './app.module.css';
import I from './Icon';
import { useDraft } from './draft';
import { amountOf } from '../../lib/money/calc';
import { currencySymbol, money } from '../../lib/money/format';

export type AdvanceRow = { key: number; id?: string; amount: string; date: string; note?: string };

// Salary advances on the setup page: the ones already saved show as rows to
// change or remove, and new ones are added the same way. Posts advId{i},
// advAmount{i} and advDate{i}.
export default function AdvanceRows({ currency, today, draftKey, initialRows = [] }: { currency: string; today: string; draftKey?: string; initialRows?: AdvanceRow[] }) {
  const [rows, setRows] = useDraft<AdvanceRow[]>(draftKey, initialRows);
  const sym = currencySymbol(currency);
  const nextKey = rows.reduce((m, r) => Math.max(m, r.key + 1), 0);
  const total = rows.reduce((s, r) => s + amountOf(r.amount), 0);
  const update = (key: number, patch: Partial<AdvanceRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <div className={styles.owedBox}>
      <div className={styles.cardHead}>
        <span>
          <b>Salary advance</b>
          <span className={styles.cardSub} style={{ display: 'block' }}>
            Part of your pay early, today or on a later day. It comes off the next payday after it arrives.
          </span>
        </span>
        {rows.length > 0 && <b className={`${styles.num} ${styles.pos}`}>{money(Math.round(total * 100), currency)}</b>}
      </div>
      {rows.map((r, i) => (
        <div key={r.key} className={styles.advRow}>
          <span className={styles.catDot} style={{ background: 'var(--pos-bg)', color: 'var(--pos)' }} aria-hidden="true">
            <I d="wallet" size={15} />
          </span>
          <span className={styles.money}>
            <span>{sym}</span>
            <input className={styles.input} name={`advAmount${i}`} inputMode="decimal" value={r.amount} placeholder="300" autoFocus={!r.amount} onChange={(e) => update(r.key, { amount: e.target.value })} aria-label="Advance amount" />
          </span>
          <input className={styles.input} type="date" name={`advDate${i}`} min={r.id ? undefined : today} value={r.date} onChange={(e) => update(r.key, { date: e.target.value })} aria-label="Arrives on" title="Arrives on" />
          <button type="button" className={styles.xBtn} aria-label="Remove advance" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
            <I d="x" size={14} />
          </button>
          {r.id && <input type="hidden" name={`advId${i}`} value={r.id} />}
          {r.note && <small className={styles.advNote}>{r.note}</small>}
        </div>
      ))}
      <div className={styles.row}>
        <button type="button" className={`${styles.btnGhost} ${styles.btnSmall}`} style={{ flex: 'none' }} onClick={() => setRows((rs) => [...rs, { key: nextKey, amount: '', date: today }])}>
          <I d="plus" size={14} stroke={2.6} /> Add a salary advance
        </button>
      </div>
    </div>
  );
}
