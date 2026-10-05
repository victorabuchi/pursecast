import type { Metadata } from 'next';
import styles from '../../../components/app/app.module.css';
import I from '../../../components/app/Icon';
import ConfirmX from '../../../components/app/ConfirmX';
import PageHead from '../../../components/app/PageHead';
import NewFork from '../../../components/app/NewFork';
import { SheetButton } from '../../../components/app/Sheet';
import { VB, pct, smooth, type Pt } from '../../../components/app/chart';
import { db } from '../../../prisma/db';
import { loadMoney } from '../../../lib/money/load';
import { addMonthKey, monthEnd, monthLabel, monthName, monthOf, nowMs, short, todayIn } from '../../../lib/money/dates';
import { exact, money } from '../../../lib/money/format';
import { forkValue, pastBalance, scale, type Point } from '../../../lib/money/forks';
import { deleteForkAction } from '../../../lib/money/actions';

export const metadata: Metadata = { title: 'Timeline Forks', robots: { index: false } };

const COLORS = ['#f5a524', '#8b5cf6', '#0ea5e9', '#ec4899'];

export default async function ForksPage({ searchParams }: PageProps<'/forks'>) {
  const params = await searchParams;
  const { me, entries, forecast, balance, recurring, cats } = await loadMoney(290);
  const cur = me.currency;
  const m = (n: number, sign = false) => money(n, cur, { sign });

  const forks = await db.orm.public.Fork.where({ userId: me.id }).orderBy((f) => f.createdAt.asc()).all();
  const effects = forks.length ? await db.orm.public.ForkEffect.where({ userId: me.id }).all() : [];

  // Twelve months: three back, this one, eight ahead.
  const thisMonth = monthOf(me.today);
  const months = Array.from({ length: 12 }, (_, i) => addMonthKey(thisMonth, i - 3));
  const from = `${months[0]}-01`;
  const to = monthEnd(`${months[11]}-01`);
  const firstDay = todayIn(me.timezone, new Date(me.balanceSetAt));
  const counted = entries.filter((e) => e.createdAt > me.balanceSetAt);
  const future = new Map(forecast.days.map((d) => [d.date, d.real]));
  const realAt = (date: string): number | null => (date < me.today ? pastBalance(balance, counted, date, firstDay) : date === me.today ? balance : (future.get(date) ?? null));

  const ends = months.map((mo) => monthEnd(`${mo}-01`));
  const past: Point[] = [];
  if (firstDay > from && firstDay < me.today) past.push({ date: firstDay, value: realAt(firstDay)! });
  for (const d of ends) if (d < me.today && realAt(d) !== null) past.push({ date: d, value: realAt(d)! });
  past.sort((a, b) => (a.date < b.date ? -1 : 1));
  const nowPt: Point = { date: me.today, value: balance };
  const ahead: Point[] = [nowPt, ...ends.filter((d) => d > me.today && future.has(d)).map((d) => ({ date: d, value: future.get(d)! }))];
  const realEnd = ahead[ahead.length - 1]!;

  const lines = forks.map((f, i) => {
    const mine = effects.filter((e) => e.forkId === f.id);
    const monthly = mine.reduce((s, e) => s + e.monthly, 0);
    const spec = { startDate: f.startDate, oneTime: f.oneTime, monthly };
    const dates = [f.startDate, ...ends.filter((d) => d > f.startDate), ...(f.startDate < me.today ? [me.today] : [])].filter((d) => d <= realEnd.date).sort();
    const pts: Point[] = [];
    for (const d of [...new Set(dates)]) {
      const r = realAt(d);
      if (r !== null) pts.push({ date: d, value: forkValue(r, spec, d)! });
    }
    const end = forkValue(realEnd.value, spec, realEnd.date);
    return { fork: f, effects: mine, monthly, pts, end, color: COLORS[i % COLORS.length]! };
  });

  const sc = scale([past, ahead, ...lines.map((l) => l.pts)], from, to);
  const toPt = (p: Point): Pt => [sc.x(p.date), sc.y(p.value)];
  const pastPath = smooth([...past, nowPt].map(toPt));
  const aheadPath = smooth(ahead.map(toPt));
  const latest = entries[0];
  const fresh = latest && nowMs() - Date.parse(latest.createdAt) < 10 * 60_000;
  const catName = latest?.categoryId ? cats.find((c) => c.id === latest.categoryId)?.name : null;
  const bases = recurring.map((r) => ({ id: r.id, name: r.name, amount: r.amount }));

  return (
    <>
      <PageHead
        title="Timeline Forks"
        sub={`Balance by ${monthLabel(months[11]!, me.today)}`}
        icon="fork"
        right={
          <SheetButton className={`${styles.btn} ${styles.btnSmall}`} initiallyOpen={Boolean(params['new'])} label={<><I d="plus" size={14} stroke={2.6} /> New fork</>} title="New fork" sub="It starts today and follows your real spending from here." wide>
            <NewFork currency={cur} bases={bases} />
          </SheetButton>
        }
      />

      <div className={styles.legend}>
        <div className={styles.legendCard}>
          <i style={{ background: '#0f7a63' }} />
          <span>
            <small>Real life · as you live now</small>
            <b>{m(realEnd.value)}</b>
          </span>
        </div>
        {lines.map((l) => (
          <div key={l.fork.id} className={`${styles.legendCard} ${styles.legendFork}`} style={{ borderColor: `${l.color}66`, background: `${l.color}12` }}>
            <i style={{ background: l.color }} />
            <span>
              <small>Fork · {l.fork.name.toLowerCase()}</small>
              <b>{l.end === null ? '—' : m(l.end)}</b>
            </span>
            {l.end !== null && (
              <em className={`${styles.diff} ${l.end - realEnd.value < 0 ? styles.diffNeg : ''}`}>{m(l.end - realEnd.value, true)}</em>
            )}
            <form action={deleteForkAction}>
              <input type="hidden" name="id" value={l.fork.id} />
              <ConfirmX label={`Remove fork ${l.fork.name}`} />
            </form>
          </div>
        ))}
      </div>

      <div className={styles.card}>
        <div className={styles.chart} style={{ height: 280 }}>
          <span className={styles.nowLine} style={{ left: pct(toPt(nowPt)).left }}>
            <em>Today</em>
          </span>
          {sc.min < 0 && (
            <span className={styles.zero} style={{ top: pct([0, sc.y(0)]).top }}>
              <em>{m(0)}</em>
            </span>
          )}
          <svg viewBox={`0 0 ${VB.w} ${VB.h}`} preserveAspectRatio="none" className={styles.chartSvg} role="img" aria-label={`Real life ends at ${m(realEnd.value)}${lines.map((l) => `, ${l.fork.name} at ${l.end === null ? 'unknown' : m(l.end)}`).join('')}.`}>
            {past.length > 0 && <path d={pastPath} className={styles.lineMain} />}
            <path d={aheadPath} className={`${styles.lineMain} ${styles.dashed}`} />
            {lines.map((l) => (
              <path key={l.fork.id} d={smooth(l.pts.map(toPt))} className={`${styles.lineFork} ${styles.draw}`} style={{ stroke: l.color }} />
            ))}
          </svg>
          <i className={`${styles.dot} ${styles.dotOk}`} style={pct(toPt(nowPt))} />
          {lines.map((l) => l.pts.length > 0 && <i key={l.fork.id} className={styles.dot} style={{ ...pct(toPt(l.pts[l.pts.length - 1]!)), background: l.color }} />)}
        </div>
        <div className={styles.months} style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}>
          {months.map((mo, i) => (
            <span key={mo} className={i % 2 ? styles.monthOdd : undefined} style={{ fontWeight: mo === thisMonth ? 800 : undefined }}>
              {monthName(mo)}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.liveBar}>
        <span className={styles.liveDot} />
        <span>
          <b>Live</b> ·{' '}
          <span className={fresh ? styles.flashText : undefined}>
            {latest ? `${catName ?? latest.note} ${exact(Math.abs(latest.amount), cur)} applied to ${forks.length ? 'every timeline' : 'real life'}` : forks.length ? 'Every timeline follows your real spending' : 'Real life follows your real spending'}
          </span>
        </span>
      </div>

      {lines.length === 0 ? (
        <div className={styles.empty}>
          <b>Try a life before you live it.</b>A new city, a new job, selling the car. Create a fork with what would change each month and watch both futures update with every real purchase.
        </div>
      ) : (
        <div className={styles.split2}>
          {lines.map((l) => (
            <div key={l.fork.id} className={styles.card}>
              <div className={styles.cardHead}>
                <strong className={styles.cardTitle}>
                  <i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 5, background: l.color, marginRight: 8 }} />
                  {l.fork.name}
                </strong>
                <span className={styles.cardSub}>Since {short(l.fork.startDate)}</span>
              </div>
              <div className={styles.details} style={{ background: `${l.color}14` }}>
                {l.effects.map((e) => (
                  <span key={e.id}>
                    {e.name} <b className={e.monthly >= 0 ? styles.pos : styles.neg}>{m(e.monthly, true)} / mo</b>
                  </span>
                ))}
                {l.fork.oneTime !== 0 && (
                  <span>
                    One-off <b className={l.fork.oneTime >= 0 ? styles.pos : styles.neg}>{m(l.fork.oneTime, true)}</b>
                  </span>
                )}
                <span>
                  In total <b className={l.monthly >= 0 ? styles.pos : styles.neg}>{m(l.monthly, true)} / mo</b>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
