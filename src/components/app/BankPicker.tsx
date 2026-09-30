'use client';

import { useEffect, useState, useTransition } from 'react';
import styles from './app.module.css';
import I from './Icon';
import Submit from './Submit';
import { banksAction, connectBankAction } from '../../lib/bank/actions';

type Bank = { name: string; country: string; logo: string; beta: boolean };

const COUNTRIES: Array<[string, string]> = [
  ['FI', 'Finland'],
  ['SE', 'Sweden'],
  ['NO', 'Norway'],
  ['DK', 'Denmark'],
  ['EE', 'Estonia'],
  ['LV', 'Latvia'],
  ['LT', 'Lithuania'],
  ['DE', 'Germany'],
  ['NL', 'Netherlands'],
  ['BE', 'Belgium'],
  ['FR', 'France'],
  ['ES', 'Spain'],
  ['PT', 'Portugal'],
  ['IT', 'Italy'],
  ['AT', 'Austria'],
  ['IE', 'Ireland'],
  ['PL', 'Poland'],
  ['GR', 'Greece'],
];

// Pick a country, find your bank, and go approve the connection there.
export default function BankPicker({ country: initial }: { country: string }) {
  const [country, setCountry] = useState(initial);
  const [banks, setBanks] = useState<Bank[] | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Bank | null>(null);
  const [loading, start] = useTransition();

  useEffect(() => {
    let live = true;
    start(async () => {
      const res = await banksAction(country);
      if (live) {
        setBanks(res.banks);
        setError(res.error ?? '');
        setPicked(null);
      }
    });
    return () => {
      live = false;
    };
  }, [country]);

  const shown = (banks ?? []).filter((b) => b.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className={styles.stack} style={{ gap: 12 }}>
      <div className={styles.row}>
        <select className={styles.select} value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Country" style={{ flex: '0 1 200px' }}>
          {COUNTRIES.map(([c, label]) => (
            <option key={c} value={c}>
              {label}
            </option>
          ))}
        </select>
        <input className={styles.input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for your bank" aria-label="Search banks" />
      </div>
      <div className={styles.bankGrid} aria-busy={loading}>
        {error ? (
          <p className={styles.neg}>The bank list could not load: {error}</p>
        ) : banks === null || loading ? (
          <p className={styles.note}>Loading banks…</p>
        ) : shown.length === 0 ? (
          <p className={styles.note}>No bank by that name here.</p>
        ) : (
          shown.slice(0, 60).map((b) => (
            <button key={b.name} type="button" className={styles.bankTile} data-on={picked?.name === b.name} onClick={() => setPicked(b)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.logo} alt="" loading="lazy" />
              <span>{b.name}</span>
              {b.beta && <em>beta</em>}
            </button>
          ))
        )}
      </div>
      {picked && (
        <form action={connectBankAction} className={styles.bankGo}>
          <input type="hidden" name="name" value={picked.name} />
          <input type="hidden" name="country" value={picked.country} />
          <span>
            You go to <b>{picked.name}</b> to approve. Pursecast can then read balances and transactions, never move money. Access lasts up to 180 days.
          </span>
          <Submit className={styles.btn} pending="Opening your bank…">
            <I d="link" size={15} /> Connect {picked.name}
          </Submit>
        </form>
      )}
    </div>
  );
}
