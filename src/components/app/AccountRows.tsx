'use client';

import styles from './app.module.css';
import I from './Icon';
import PriceInput from './PriceInput';
import { useDraft } from './draft';
import { convert, type Rates } from '../../lib/money/currencies';
import { money, parseAmount } from '../../lib/money/format';

export type AccountRow = { key: number; id?: string; name: string; kind: string; amount: string; cur?: string; count: boolean };
type Row = AccountRow;

export const ACCOUNT_KINDS: Array<[string, string, string]> = [
  ['savings', 'Savings', 'Savings'],
  ['everyday', 'Everyday', 'Second account'],
  ['card', 'Card', 'Travel card'],
  ['cash', 'Cash', 'Cash'],
];

// Accounts besides the main one, each in its own currency. Savings do not
// count in the forecast unless switched on. Posts accId{i}, accName{i},
// accKind{i}, accAmount{i}, accAmount{i}Currency and accCount{i}.
export default function AccountRows({ currency, rates, draftKey, initialRows = [] }: { currency: string; rates: Rates; draftKey?: string; initialRows?: Row[] }) {
  const [rows, setRows] = useDraft<Row[]>(draftKey, initialRows);
  const nextKey = rows.reduce((m, r) => Math.max(m, r.key + 1), 0);
  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const add = (kind: string) => setRows((rs) => [...rs, { key: nextKey, name: ACCOUNT_KINDS.find(([k]) => k === kind)?.[2] ?? '', kind, amount: '', count: kind !== 'savings' }]);
  const inMain = (r: Row) => convert(parseAmount(r.amount) ?? 0, r.cur || currency, currency, rates) ?? 0;
  const counted = rows.filter((r) => r.count).reduce((s, r) => s + inMain(r), 0);
  const all = rows.reduce((s, r) => s + inMain(r), 0);

  return (
    <div className={styles.owedBox}>
      <div className={styles.cardHead}>
        <span>
          <b>Other accounts</b>
          <span className={styles.cardSub} style={{ display: 'block' }}>
            Savings, a second account, a card in dollars, cash. Optional. Switch on the ones Money Weather should count.
          </span>
        </span>
        {rows.length > 0 && <b className={styles.num}>{money(all, currency)}</b>}
      </div>
      {rows.map((r, i) => (
        <div key={r.key} className={styles.accRow}>
          <input className={styles.input} name={`accName${i}`} value={r.name} placeholder="Name" onChange={(e) => update(r.key, { name: e.target.value })} aria-label="Account name" maxLength={60} />
          <select name={`accKind${i}`} className={styles.select} value={r.kind} onChange={(e) => update(r.key, { kind: e.target.value })} aria-label={`${r.name || 'Account'} type`}>
            {ACCOUNT_KINDS.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          <PriceInput name={`accAmount${i}`} account={currency} rates={rates} currency={r.cur} onCurrency={(c) => update(r.key, { cur: c === currency ? undefined : c })} value={r.amount} onChange={(v) => update(r.key, { amount: v })} autoFocus={!r.amount} label={`${r.name || 'Account'} balance`} />
          <label className={styles.accCount} title="Add this account to the balance Money Weather starts from">
            <input type="checkbox" name={`accCount${i}`} checked={r.count} onChange={(e) => update(r.key, { count: e.target.checked })} />
            In forecast
          </label>
          <button type="button" className={styles.xBtn} aria-label={`Remove ${r.name || 'account'}`} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
            <I d="x" size={14} />
          </button>
          {r.id && <input type="hidden" name={`accId${i}`} value={r.id} />}
        </div>
      ))}
      <div className={styles.row}>
        {ACCOUNT_KINDS.map(([k, label]) => (
          <button key={k} type="button" className={`${styles.btnGhost} ${styles.btnSmall}`} style={{ flex: 'none' }} onClick={() => add(k)}>
            <I d={k === 'savings' ? 'jar' : k === 'cash' ? 'wallet' : 'bank'} size={14} /> {label}
          </button>
        ))}
        {rows.length > 0 && (
          <span className={styles.cardSub} style={{ marginLeft: 'auto', flex: 'none', alignSelf: 'center' }}>
            {money(counted, currency)} counts in the forecast
          </span>
        )}
      </div>
    </div>
  );
}
