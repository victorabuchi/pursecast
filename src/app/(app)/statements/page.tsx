import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '../../../components/app/app.module.css';
import I from '../../../components/app/Icon';
import PageHead from '../../../components/app/PageHead';
import Uploader from '../../../components/app/Uploader';
import TxnCategory from '../../../components/app/TxnCategory';
import { db } from '../../../prisma/db';
import { getMe } from '../../../lib/money/load';
import { diffDays, monthName, short } from '../../../lib/money/dates';
import { exact, money } from '../../../lib/money/format';
import { story } from '../../../lib/statements/analysis';
import { aiReady } from '../../../lib/statements/read';
import { STATEMENT_CATEGORIES, type Txn } from '../../../lib/statements/types';
import { deleteStatementAction, deleteTxnAction } from '../../../lib/statements/actions';

export const metadata: Metadata = { title: 'Statements', robots: { index: false } };

const COLORS: Record<string, string> = {
  Income: '#15803d',
  Groceries: '#16a34a',
  'Eating out': '#f97316',
  Takeaway: '#ef4444',
  Coffee: '#a16207',
  Transport: '#0ea5e9',
  Housing: '#0f7a63',
  'Bills & insurance': '#475569',
  Subscriptions: '#d946ef',
  Shopping: '#ec4899',
  Health: '#14b8a6',
  Fun: '#8b5cf6',
  Travel: '#6366f1',
  Gifts: '#f43f5e',
  Cash: '#84cc16',
  Fees: '#78716c',
  Transfers: '#94a3b8',
  Other: '#64748b',
};
const PAGE = 80;

export default async function StatementsPage({ searchParams }: PageProps<'/statements'>) {
  const params = await searchParams;
  const one = (k: string) => (typeof params[k] === 'string' ? params[k] : '');
  const me = await getMe();
  const cur = me.currency;
  const m = (c: number) => money(c, cur);

  const statements = await db.orm.public.Statement.where({ userId: me.id }).orderBy((s) => s.createdAt.desc()).all();
  const selected = statements.find((s) => s.id === one('s'));
  const rows = await db.orm.public.StatementTxn.where(selected ? { userId: me.id, statementId: selected.id } : { userId: me.id })
    .orderBy([(t) => t.date.desc(), (t) => t.id.asc()])
    .all();
  const txns: Array<Txn & { id: string }> = rows.map((t) => ({ id: t.id, date: t.date, description: t.description, place: t.place, amount: t.amount, category: t.category }));
  const monthLabel = (month: string) => `${monthName(month, true)} ${month.slice(0, 4)}`;
  const s = story(txns, m, monthLabel);

  // The list: search and category filter, newest first.
  const q = one('q').toLowerCase();
  const cat = one('cat');
  const listed = txns.filter((t) => (!q || `${t.place} ${t.description}`.toLowerCase().includes(q)) && (!cat || t.category === cat));
  const shown = Math.min(listed.length, Number(one('n')) || PAGE);
  const here = (extra: Record<string, string>) => {
    const u = new URLSearchParams();
    if (selected) u.set('s', selected.id);
    if (q) u.set('q', one('q'));
    if (cat) u.set('cat', cat);
    for (const [k, v] of Object.entries(extra)) {
      if (v) u.set(k, v);
      else u.delete(k);
    }
    return `/statements${u.size ? `?${u}` : ''}`;
  };
  const back = here({});

  return (
    <>
      <PageHead
        title="Statements"
        sub="Where your money went"
        icon="file"
        right={
          statements.length > 0 && (
            <nav className={styles.segment} aria-label="Statements">
              <Link href="/statements" aria-current={!selected ? 'page' : undefined}>
                All
              </Link>
              {statements.slice(0, 5).map((st) => (
                <Link key={st.id} href={`/statements?s=${st.id}`} aria-current={selected?.id === st.id ? 'page' : undefined}>
                  {st.name.slice(0, 24)}
                </Link>
              ))}
            </nav>
          )
        }
      />

      {!aiReady() && (
        <p className={styles.note}>
          Screenshots and PDFs need an Anthropic API key (ANTHROPIC_API_KEY) on the server. Excel and CSV exports from your bank work already.
        </p>
      )}

      {!s ? (
        <div className={styles.stack}>
          <div className={styles.tipCard}>
            <b>See a whole year at a glance.</b> Upload a bank statement for any period, say October 2025 to September 2026, as a PDF, screenshots, or the Excel/CSV export from your bank. Pursecast reads every transaction and shows where your money came from and where it went. It does not change your balance or forecast.
          </div>
          <Uploader />
        </div>
      ) : (
        <>
          <div className={styles.cardHead}>
            <span className={styles.cardSub}>
              {short(s.from)} {s.from.slice(0, 4)} – {short(s.to)} {s.to.slice(0, 4)} · {s.months.length} {s.months.length === 1 ? 'month' : 'months'} · {txns.length} transactions
              {selected && ` · ${selected.name}`}
            </span>
            {selected && (
              <form action={deleteStatementAction}>
                <input type="hidden" name="id" value={selected.id} />
                <button type="submit" className={styles.linkBtn} style={{ color: 'var(--muted)', fontSize: 13 }}>
                  Remove this statement
                </button>
              </form>
            )}
          </div>

          <div className={styles.stats} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
            <div className={`${styles.card} ${styles.bigStat}`}>
              <small>Money in</small>
              <b className={styles.pos}>{m(s.moneyIn)}</b>
            </div>
            <div className={`${styles.card} ${styles.bigStat}`}>
              <small>Money out</small>
              <b>{m(s.moneyOut)}</b>
            </div>
            <div className={`${styles.card} ${styles.bigStat}`}>
              <small>{s.moneyIn >= s.moneyOut ? 'You kept' : 'You overspent'}</small>
              <b className={s.moneyIn >= s.moneyOut ? styles.pos : styles.neg}>{m(Math.abs(s.moneyIn - s.moneyOut))}</b>
            </div>
            <div className={`${styles.card} ${styles.bigStat}`}>
              <small>Spent per month</small>
              <b>{m(Math.round(s.moneyOut / Math.max(1, Math.round(diffDays(s.from, s.to) / 30.4) || 1)))}</b>
            </div>
          </div>

          {s.highlights.length > 0 && (
            <ul className={styles.story}>
              {s.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          )}

          <section className={styles.card} aria-label="Money in and out by month">
            <div className={styles.cardHead}>
              <strong className={styles.cardTitle}>Month by month</strong>
              <span className={styles.cardSub}>
                <i className={styles.legendDot} style={{ background: '#22c55e' }} />
                In
                <i className={styles.legendDot} style={{ background: '#0f7a63', marginLeft: 12 }} />
                Out
              </span>
            </div>
            <div className={styles.flowChart}>
              {s.months.map((mo, i) => {
                const top = Math.max(1, ...s.months.map((x) => Math.max(x.in, x.out)));
                return (
                  <div key={mo.month} className={styles.flowMonth} title={`${monthLabel(mo.month)}: in ${m(mo.in)}, out ${m(mo.out)}`}>
                    <div className={styles.flowBars}>
                      <i style={{ height: `${(mo.in / top) * 100}%`, background: '#22c55e', animationDelay: `${i * 40}ms` }} />
                      <i style={{ height: `${(mo.out / top) * 100}%`, background: '#0f7a63', animationDelay: `${i * 40 + 20}ms` }} />
                    </div>
                    <small>{monthName(mo.month)}</small>
                  </div>
                );
              })}
            </div>
          </section>

          <div className={styles.split2}>
            <section className={styles.card} aria-label="Where it went">
              <strong className={styles.cardTitle}>Where it went</strong>
              {s.categories.map((c) => (
                <Link key={c.name} href={here({ cat: c.name, n: '' }) + '#list'} className={styles.barRow} style={{ color: 'inherit', textDecoration: 'none' }}>
                  <span>
                    <span>
                      <i className={styles.legendDot} style={{ background: COLORS[c.name] ?? '#64748b' }} />
                      {c.name} <span className={styles.muted}>· {Math.round(c.share * 100)}%</span>
                    </span>
                    <b className={styles.num}>{m(c.out)}</b>
                  </span>
                  <div className={styles.meter}>
                    <span style={{ width: `${Math.max(2, (c.out / s.categories[0]!.out) * 100)}%`, background: COLORS[c.name] ?? '#64748b' }} />
                  </div>
                </Link>
              ))}
            </section>
            <section className={styles.card} aria-label="Top places">
              <strong className={styles.cardTitle}>Where you paid most</strong>
              {s.places.map((p, i) => (
                <div key={p.name} className={styles.bill}>
                  <span>
                    <b>
                      {i + 1}. {p.name}
                    </b>
                    <small>
                      {p.count} {p.count === 1 ? 'payment' : 'payments'}
                    </small>
                  </span>
                  <b>{m(p.out)}</b>
                </div>
              ))}
            </section>
          </div>

          <div className={styles.split2}>
            <section className={styles.card} aria-label="Where money came from">
              <strong className={styles.cardTitle}>Where money came from</strong>
              {s.sources.length === 0 && <p className={styles.note}>No money came in during this period.</p>}
              {s.sources.map((p) => (
                <div key={p.name} className={styles.bill}>
                  <span>
                    <b>{p.name}</b>
                    <small>
                      {p.count} {p.count === 1 ? 'payment' : 'payments'} · {Math.round((p.in / s.moneyIn) * 100)}%
                    </small>
                  </span>
                  <b className={styles.pos}>{m(p.in)}</b>
                </div>
              ))}
            </section>
            <section className={styles.card} aria-label="Regular charges">
              <strong className={styles.cardTitle}>Regular charges</strong>
              {s.recurring.length === 0 && <p className={styles.note}>No charges repeat month after month here.</p>}
              {s.recurring.map((r) => (
                <div key={r.name} className={styles.bill}>
                  <span>
                    <b>{r.name}</b>
                    <small>
                      ~{m(r.typical)} a month · seen in {r.months} months · {m(r.yearly)} a year
                    </small>
                  </span>
                  <Link href="/spending?tab=bills&new=1" className={styles.linkBtn} style={{ fontSize: 12.5 }}>
                    Track it
                  </Link>
                </div>
              ))}
            </section>
          </div>

          <section className={styles.card} aria-label="Biggest purchases">
            <strong className={styles.cardTitle}>Biggest purchases</strong>
            {s.biggest.map((t, i) => (
              <div key={`${t.date}${t.amount}${i}`} className={styles.bill}>
                <span>
                  <b>{t.place}</b>
                  <small>
                    {short(t.date)} {t.date.slice(0, 4)} · {t.category}
                  </small>
                </span>
                <b>{exact(-t.amount, cur)}</b>
              </div>
            ))}
          </section>

          <section id="list" className={styles.card} aria-label="All transactions">
            <div className={styles.cardHead}>
              <strong className={styles.cardTitle}>
                All transactions {cat && `· ${cat}`} <span className={styles.cardSub}>({listed.length})</span>
              </strong>
              {(q || cat) && (
                <Link href={here({ q: '', cat: '', n: '' }) + '#list'} className={styles.linkBtn} style={{ fontSize: 13 }}>
                  Clear filter
                </Link>
              )}
            </div>
            <Uploader statementId={selected?.id} compact label="Add a transaction from a screenshot, or more statements" />
            <form className={styles.row} action="/statements">
              {selected && <input type="hidden" name="s" value={selected.id} />}
              <input className={styles.input} name="q" defaultValue={one('q')} placeholder="Search places and descriptions" aria-label="Search" />
              <select name="cat" className={styles.select} defaultValue={cat} aria-label="Category" style={{ flex: '0 1 200px' }}>
                <option value="">All categories</option>
                {STATEMENT_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <button type="submit" className={`${styles.btnGhost} ${styles.btnSmall}`} style={{ flex: 'none' }}>
                Search
              </button>
            </form>
            <table className={styles.txnTable}>
              <tbody>
                {listed.slice(0, shown).map((t) => (
                  <tr key={t.id}>
                    <td className={styles.muted} style={{ whiteSpace: 'nowrap' }}>
                      {short(t.date)} {t.date.slice(2, 4)}
                    </td>
                    <td style={{ width: '45%' }}>
                      <b>{t.place}</b>
                      {t.description !== t.place && (
                        <small className={styles.muted} style={{ display: 'block', fontSize: 12 }}>
                          {t.description}
                        </small>
                      )}
                    </td>
                    <td>
                      <TxnCategory id={t.id} value={t.category} back={back} />
                    </td>
                    <td className={`${styles.num} ${t.amount > 0 ? styles.pos : ''}`} style={{ textAlign: 'right' }}>
                      {exact(t.amount, cur, { sign: t.amount > 0 })}
                    </td>
                    <td>
                      <form action={deleteTxnAction}>
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="back" value={back} />
                        <button type="submit" className={styles.xBtn} aria-label={`Delete ${t.place}`}>
                          <I d="x" size={13} />
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {listed.length > shown && (
              <Link href={here({ n: String(shown + PAGE * 2) }) + '#list'} scroll={false} className={`${styles.btnGhost} ${styles.btnSmall}`}>
                Show more ({listed.length - shown} left)
              </Link>
            )}
          </section>
        </>
      )}
    </>
  );
}
