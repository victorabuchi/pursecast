'use client';

import styles from './app.module.css';
import I from './Icon';
import { useDraft } from './draft';
import { amountOf } from '../../lib/money/calc';
import { currencySymbol, money } from '../../lib/money/format';

export type OwedRow = { key: number; id?: string; who: string; party: 'person' | 'institution'; amount: string; date: string };
type Row = OwedRow;

// Money the person owes, added one at a time: someone they know or a bank or
// other institution, with a running total. Posts owedWho{i}, owedParty{i},
// owedAmount{i} and owedDate{i}.
export default function OwedRows({ currency, today, draftKey, initialRows = [], lent = false }: { currency: string; today: string; draftKey?: string; initialRows?: Row[]; lent?: boolean }) {
  const prefix = lent ? 'lent' : 'owed';
  const [rows, setRows] = useDraft<Row[]>(draftKey, initialRows);
  const sym = currencySymbol(currency);
  const total = rows.reduce((s, r) => s + amountOf(r.amount), 0);
  const nextKey = rows.reduce((m, r) => Math.max(m, r.key + 1), 0);
  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const add = (party: Row['party']) => setRows((rs) => [...rs, { key: nextKey, who: '', party, amount: '', date: '' }]);

  return (
    <div className={styles.owedBox}>
      <div className={styles.cardHead}>
        <span>
          <b>{lent ? 'Money people owe you' : 'Money you owe'}</b>
          <span className={styles.cardSub} style={{ display: 'block' }}>
            {lent ? 'Money you lent to friends, family or anyone else. Optional.' : 'Loans, credit cards, or money from friends and family. Optional.'}
          </span>
        </span>
        {rows.length > 0 && <b className={`${styles.num} ${lent ? styles.pos : styles.neg}`}>{money(Math.round(total * 100), currency)}</b>}
      </div>
      {rows.map((r, i) => (
        <div key={r.key} className={styles.owedRow}>
          <span className={styles.catDot} style={{ background: r.party === 'institution' ? '#e0e7ff' : lent ? '#dcfce7' : '#fee2e2', color: r.party === 'institution' ? '#4338ca' : lent ? '#15803d' : '#dc2626' }} aria-hidden="true">
            <I d={r.party === 'institution' ? 'bank' : 'user'} size={15} />
          </span>
          <input className={styles.input} name={`${prefix}Who${i}`} value={r.who} placeholder={r.party === 'institution' ? (lent ? 'Company' : 'Nordea car loan') : lent ? 'Sam' : 'Mom'} autoFocus={!r.who} onChange={(e) => update(r.key, { who: e.target.value })} aria-label={lent ? 'Who owes you' : 'Who you owe'} maxLength={60} />
          <span className={styles.money}>
            <span>{sym}</span>
            <input className={styles.input} name={`${prefix}Amount${i}`} inputMode="decimal" value={r.amount} placeholder="0" onChange={(e) => update(r.key, { amount: e.target.value })} aria-label={lent ? `Amount ${r.who || 'they'} owe you` : `Amount owed to ${r.who || 'them'}`} />
          </span>
          <input className={styles.input} type="date" name={`${prefix}Date${i}`} min={today} value={r.date} onChange={(e) => update(r.key, { date: e.target.value })} aria-label={lent ? `${r.who || 'They'} pay you back by` : `Pay ${r.who || 'them'} back by`} title="Pay back by (optional)" />
          <button type="button" className={styles.xBtn} aria-label={`Remove ${r.who || 'row'}`} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
            <I d="x" size={14} />
          </button>
          <input type="hidden" name={`${prefix}Party${i}`} value={r.party} />
          {r.id && <input type="hidden" name={`${prefix}Id${i}`} value={r.id} />}
        </div>
      ))}
      {rows.length > 0 && (
        <p className={styles.note}>
          {lent ? 'The date is when you expect it back, if there is one. It counts in Money Weather once it is paid back.' : 'The date is when it should be paid back, if there is one. Money Weather counts it on that day.'}
        </p>
      )}
      <div className={styles.row}>
        <button type="button" className={`${styles.btnGhost} ${styles.btnSmall}`} style={{ flex: 'none' }} onClick={() => add('person')}>
          <I d="user" size={14} /> A person
        </button>
        <button type="button" className={`${styles.btnGhost} ${styles.btnSmall}`} style={{ flex: 'none' }} onClick={() => add('institution')}>
          <I d="bank" size={14} /> A bank or institution
        </button>
        {rows.length > 0 && (
          <span className={styles.cardSub} style={{ marginLeft: 'auto', flex: 'none', alignSelf: 'center' }}>
            {rows.length} {lent ? (rows.length === 1 ? 'person' : 'people') : rows.length === 1 ? 'debt' : 'debts'} · {money(Math.round(total * 100), currency)} in total
          </span>
        )}
      </div>
    </div>
  );
}
