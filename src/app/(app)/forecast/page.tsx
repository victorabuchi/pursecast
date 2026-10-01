import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '../../../prisma/db';
import styles from '../../../components/app/app.module.css';
import I from '../../../components/app/Icon';
import PageHead from '../../../components/app/PageHead';
import { MoneyInput, SignToggle } from '../../../components/app/Fields';
import { SheetButton, UrlSheet, CloseButton } from '../../../components/app/Sheet';
import Submit from '../../../components/app/Submit';
import { VB, pct, smooth, type Pt } from '../../../components/app/chart';
import { getMe, loadMoney } from '../../../lib/money/load';
import { conditionOf, everyday, monthsOfForecast, nextIncomeAfter, suggestFix, sunnyUntil, weekFlows, weeksOf, worstWeek, type FcBudget, type Forecast, type Sky, type Week } from '../../../lib/money/forecast';
import { addDays, addMonths, countWord, diffDays, monthName, monthOf, range, short } from '../../../lib/money/dates';
import { exact, money } from '../../../lib/money/format';
import { fixStormAction, setBalanceAction, setCushionAction } from '../../../lib/money/actions';

export const metadata: Metadata = { title: 'Money Weather', robots: { index: false } };

const RANGES = [
  { id: '1m', label: '1 month', words: 'month', days: 31, byMonth: false },
  { id: '3m', label: '3 months', words: '3 months', days: 91, byMonth: false },
  { id: '6m', label: '6 months', words: '6 months', days: 183, byMonth: true },
  { id: '1y', label: '1 year', words: 'year', days: 366, byMonth: true },
] as const;

const SKY_ICON: Record<Sky, 'sun' | 'partly' | 'cloud' | 'storm'> = { sun: 'sun', partly: 'partly', cloud: 'cloud', storm: 'storm' };
// A small weather icon inside a sentence, in the sky's own colour.
function Sky({ sky }: { sky: Sky }) {
  return (
    <span className={styles.skyInline} data-sky={sky} aria-hidden="true">
      <I d={SKY_ICON[sky]} size={15} stroke={2.2} />
    </span>
  );
}
const CONDITION: Record<Sky, string> = { sun: 'Clear skies', partly: 'Mostly sunny', cloud: 'Covered', storm: 'Storm ahead' };

function list(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

// The forecast seen through one calendar month: its days, and the lowest
// point within them.
function focusMonth(fc: Forecast, month: string): Forecast {
  const days = fc.days.filter((d) => monthOf(d.date) === month);
  if (!days.length) return fc;
  let low = days[0]!;
  for (const d of days) if (d.spendable < low.spendable) low = d;
  return { ...fc, days, low: { date: low.date, amount: low.spendable } };
}

export default async function ForecastPage({ searchParams }: PageProps<'/forecast'>) {
  const params = await searchParams;
  const view = RANGES.find((r) => r.id === params['range']) ?? RANGES[1]!;
  // The 1 month view is one calendar month, chosen with the arrows (this
  // month and the 11 after it); the forecast runs to its last day.
  const first = await getMe();
  const months = Array.from({ length: 12 }, (_, i) => monthOf(addMonths(`${monthOf(first.today)}-01`, i)));
  const focus = view.id === '1m' ? (months.includes(String(params['month'])) ? String(params['month']) : months[0]!) : null;
  const focusEnd = focus ? addDays(addMonths(`${focus}-01`, 1), -1) : null;
  const loaded = await loadMoney(focusEnd ? diffDays(first.today, focusEnd) + 1 : view.days);
  const { me, budgets, balance, mainBalance, mainName, accounts } = loaded;
  const fc = focus ? focusMonth(loaded.forecast, focus) : loaded.forecast;
  // Things waiting for a payday, shown on that pay in Coming up.
  const todos = await db.orm.public.Todo.where({ userId: me.id }).where((t) => t.doneAt.isNull()).where((t) => t.incomeId.isNotNull()).select('incomeId', 'due').all();
  const toDo = new Map<string, number>();
  for (const t of todos) toDo.set(`${t.incomeId}|${t.due}`, (toDo.get(`${t.incomeId}|${t.due}`) ?? 0) + 1);
  // Links inside the page keep the chosen range.
  const q = (extra: string) => `/forecast?${view.id === '3m' ? '' : `range=${view.id}&`}${focus && focus !== months[0] ? `month=${focus}&` : ''}${extra}`;
  const cur = me.currency;
  const m = (n: number, sign = false) => money(n, cur, { sign });
  // Weeks for the short views, calendar months for the long ones.
  const weeks = view.byMonth ? monthsOfForecast(fc) : focus ? weeksOf({ ...fc, today: fc.days[0]!.date }, 6) : weeksOf(fc, Math.ceil(view.days / 7) + 1);
  // How the chosen period is named in sentences.
  const period = focus ? (focus === months[0] ? 'the rest of this month' : monthName(focus, true)) : `the next ${view.words}`;
  const condition = conditionOf(fc);
  const worst = worstWeek(weeks);
  const sunny = sunnyUntil(weeks);

  const namesIn = (w: Week) => weekFlows(w).filter((f) => f.amount < 0 && f.kind !== 'jar').map((f) => f.name);
  let tip: React.ReactNode;
  if (worst?.sky === 'storm') {
    const names = namesIn(worst).slice(0, 3);
    tip = (
      <>
        {sunny && (
          <b>
            <Sky sky="sun" /> Sunny through {short(sunny)}.{' '}
          </b>
        )}
        <Sky sky="storm" /> Storm warning {view.byMonth ? `in ${monthName(monthOf(worst.start), true)}` : `for the week of ${short(worst.start)}`}:{' '}
        {names.length >= 2 ? `${list(names)} land together.` : names.length === 1 ? `${names[0]} and everyday spending take you below zero.` : 'everyday spending takes you below zero.'}
      </>
    );
  } else if (worst?.sky === 'cloud') {
    const payday = nextIncomeAfter(fc, worst.lowDate);
    tip = (
      <>
        <b>
          <Sky sky="cloud" /> {view.byMonth ? monthName(monthOf(worst.start), true) : `Week of ${short(worst.start)}`} is tight but covered.</b>
        {payday ? ` Sunny again from payday on ${short(payday.date)}.` : ` Lowest point ${m(worst.low)} on ${short(worst.lowDate)}.`}
      </>
    );
  } else {
    tip = (
      <>
        <b>
          <Sky sky={condition === 'sun' ? 'sun' : 'partly'} /> {condition === 'sun' ? `Sunny for ${period}.` : `Mostly sunny for ${period}.`}
        </b> Your lowest point is {m(fc.low.amount)} on {short(fc.low.date)}.
      </>
    );
  }

  // Chart
  const values = fc.days.map((d) => d.spendable);
  const lo = Math.min(0, ...values);
  const hi = Math.max(1, ...values);
  const pad = (hi - lo) * 0.14 || 100;
  const [min, max] = [lo - pad, hi + pad];
  const pts: Pt[] = fc.days.map((d, i) => [(i / (fc.days.length - 1)) * VB.w, VB.h - ((d.spendable - min) / (max - min)) * VB.h]);
  const lowIndex = fc.days.findIndex((d) => d.date === fc.low.date);
  const zeroTop = pct([0, VB.h - ((0 - min) / (max - min)) * VB.h]).top;
  const monthTicks = fc.days.map((d, i) => ({ d, i })).filter(({ d, i }) => i === 0 || (d.date.endsWith('-01') && i > 6));

  const coming = fc.days
    .flatMap((d) => d.flows.filter((f) => f.kind !== 'jar').map((f) => ({ ...f, date: d.date })))
    .filter((f) => diffDays(me.today, f.date) <= 45)
    .slice(0, 6);

  const openWeek = typeof params['week'] === 'string' ? weeks.find((w) => w.start === params['week']) : undefined;

  return (
    <>
      <PageHead
        title="Money Weather"
        sub={focus ? `${monthName(focus, true)} ${focus.slice(0, 4)}` : `Next ${view.words}`}
        icon="sun"
        right={
          <>
          <SheetButton className={styles.pill} label={<>Cushion {m(me.cushion)}</>} title="Your cushion" sub="Weeks that dip below it show as cloudy.">
            <form action={setCushionAction} className={styles.form}>
              <MoneyInput name="cushion" currency={cur} value={me.cushion} autoFocus label="Cushion" />
              <div className={styles.sheetActions}>
                <CloseButton className={styles.btnGhost}>Cancel</CloseButton>
                <Submit className={styles.btn}>Save cushion</Submit>
              </div>
            </form>
          </SheetButton>
          </>
        }
      />
      <div className={styles.split}>
        <div className={styles.stack}>
          <div className={`${styles.card} ${styles.today}`}>
            <div>
              <small>{accounts.some((a) => a.inForecast) ? 'Balance today, all counted accounts' : 'Balance today'}</small>
              <strong className={styles.bigNum}>{Math.abs(balance) < 10000 ? exact(balance, me.currency) : m(balance)}</strong>
              {accounts.length > 0 && (
                <span className={styles.accLine}>
                  <span>
                    {mainName} {exact(mainBalance, me.currency)}
                  </span>
                  {accounts.filter((a) => a.balance !== 0).map((a) => (
                    <span key={a.id} data-off={!a.inForecast || undefined} title={a.inForecast ? 'Counted in the forecast' : 'Not counted in the forecast'}>
                      {a.name} {exact(a.balance, a.currency)}
                      {a.currency !== me.currency ? ` ≈ ${m(a.value)}` : ''}
                      {a.inForecast ? '' : ' (not counted)'}
                    </span>
                  ))}
                </span>
              )}
              <small>
                {fc.reserved > 0 && <>{m(fc.reserved)} set aside for plans · </>}
                <Link href={q('balance=1')} scroll={false} className={styles.linkBtn}>
                  Update
                </Link>
              </small>
            </div>
            <Link href={q(`week=${worst ? worst.start : (weeks.find((w) => w.lowDate === fc.low.date)?.start ?? weeks[0]?.start)}`)} scroll={false} className={styles.cond} style={{ textDecoration: 'none', color: 'inherit' }}>
              <span className={styles[`sky_${condition}`]}>
                <I d={SKY_ICON[condition]} size={24} />
              </span>
              <span>
                <b>{CONDITION[condition]}</b>
                <small>
                  Lowest point <span className={fc.low.amount < 0 ? styles.neg : styles.pos}>{m(fc.low.amount)}</span> · {short(fc.low.date)}
                </small>
              </span>
            </Link>
          </div>

          <div className={styles.rangeRow}>
            <nav className={styles.segment} aria-label="Forecast range">
              {RANGES.map((r) => (
                <Link key={r.id} href={r.id === '3m' ? '/forecast' : `/forecast?range=${r.id}`} scroll={false} aria-current={r.id === view.id ? 'page' : undefined}>
                  {r.label}
                </Link>
              ))}
            </nav>
            {focus && (
              <nav className={styles.monthPick} aria-label="Month">
                {months.indexOf(focus) > 0 ? (
                  <Link href={`/forecast?range=1m&month=${months[months.indexOf(focus) - 1]}`} scroll={false} aria-label="Previous month">
                    <I d="left" size={16} />
                  </Link>
                ) : (
                  <span aria-hidden="true">
                    <I d="left" size={16} />
                  </span>
                )}
                <b>
                  {monthName(focus, true)} {focus.slice(0, 4)}
                </b>
                {months.indexOf(focus) < months.length - 1 ? (
                  <Link href={`/forecast?range=1m&month=${months[months.indexOf(focus) + 1]}`} scroll={false} aria-label="Next month">
                    <I d="right" size={16} />
                  </Link>
                ) : (
                  <span aria-hidden="true">
                    <I d="right" size={16} />
                  </span>
                )}
              </nav>
            )}
          </div>

          <div className={styles.strip} style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}>
            {weeks.map((w, i) => (
              <Link key={w.start} href={q(`week=${w.start}`)} scroll={false} className={`${styles.wk} ${styles[`wk_${w.sky}`]} ${String(params['toast'] ?? '').startsWith('Storm cleared') && w.start === worst?.start ? styles.wkPop : ''}`} style={{ textDecoration: 'none', color: 'inherit' }} aria-label={`${view.byMonth ? monthName(monthOf(w.start), true) : `Week of ${short(w.start)}`}: ${CONDITION[w.sky]}, lowest ${m(w.low)}`}>
                <small>{view.byMonth ? (i === 0 ? 'This month' : monthName(monthOf(w.start))) : i === 0 && !(focus && focus !== months[0]) ? 'This week' : short(w.start)}</small>
                <span className={styles[`sky_${w.sky}`]}>
                  <I d={SKY_ICON[w.sky]} size={22} />
                </span>
                <b>{m(w.low)}</b>
              </Link>
            ))}
          </div>

          <div className={styles.card}>
            <div className={styles.chart} style={{ height: 200 }}>
              <span className={styles.zero} style={{ top: zeroTop }}>
                <em>{m(0)}</em>
              </span>
              <svg viewBox={`0 0 ${VB.w} ${VB.h}`} preserveAspectRatio="none" className={styles.chartSvg} role="img" aria-label={`Balance forecast. Lowest ${m(fc.low.amount)} on ${short(fc.low.date)}.`}>
                <path d={smooth(pts)} className={`${styles.lineMain} ${styles.draw}`} />
              </svg>
              {lowIndex >= 0 && (
                <>
                  <i className={`${styles.dot} ${fc.low.amount < 0 ? styles.dotBad : styles.dotOk}`} style={pct(pts[lowIndex]!)}>
                    {fc.low.amount < 0 && <i className={styles.dotPing} />}
                  </i>
                  <span className={styles.dotLabel} style={pct(pts[lowIndex]!)}>
                    {m(fc.low.amount)} · {short(fc.low.date)}
                  </span>
                </>
              )}
            </div>
            <div className={styles.months} style={{ position: 'relative', height: 14 }}>
              {monthTicks.map(({ d, i }) => (
                <span key={d.date} style={{ position: 'absolute', left: `${(i / (fc.days.length - 1)) * 100}%`, transform: i === 0 ? undefined : 'translateX(-50%)' }}>
                  {i === 0 ? (d.date === me.today ? 'Today' : short(d.date)) : short(d.date).split(' ')[0]}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.stack}>
          <div className={styles.tipCard}>
            {tip}
            {worst && (
              <>
                {' '}
                <Link href={q(`week=${worst.start}`)} scroll={false} className={styles.linkBtn}>
                  See the week
                </Link>
              </>
            )}
          </div>
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <strong className={styles.cardTitle}>Coming up</strong>
              <span style={{ display: 'flex', gap: 14 }}>
                <Link href="/spending?tab=bills&advance=1" className={styles.linkBtn} style={{ fontSize: 13 }}>
                  Salary advance
                </Link>
                <Link href="/spending?tab=bills" className={styles.linkBtn} style={{ fontSize: 13 }}>
                  Bills
                </Link>
              </span>
            </div>
            {coming.length === 0 && <p className={styles.note}>No bills, income or plans in the next 45 days.</p>}
            {coming.map((f) => (
              <div key={`${f.ref}${f.date}`} className={styles.bill}>
                <span>
                  <b>{f.name}</b>
                  <small>
                    {short(f.date)}
                    {f.calendar ? ' · calendar' : ''}
                    {toDo.get(`${f.ref}|${f.date}`) ? (
                      <>
                        {' · '}
                        <Link href="/plan#todo" className={styles.linkBtn} style={{ fontSize: 12.5 }}>
                          {toDo.get(`${f.ref}|${f.date}`)} to do when it lands
                        </Link>
                      </>
                    ) : null}
                  </small>
                </span>
                <b className={f.amount > 0 ? styles.pos : undefined}>{m(f.amount, true)}</b>
              </div>
            ))}
          </div>
          <div className={styles.card}>
            <strong className={styles.cardTitle}>How this is worked out</strong>
            <p className={styles.note}>
              Your balance, minus everyday spending from your budgets ({m(budgets.reduce((s, b) => s + b.budget, 0))} a month), plus bills and income on their dates, and planned costs from your calendar.
            </p>
          </div>
        </div>
      </div>

      {openWeek && <WeekSheet week={openWeek} fc={fc} budgets={budgets} currency={cur} />}

      {params['balance'] && (
        <UrlSheet title="Update your balance" sub="What is in your account right now. Everything you log after this moves it." drop={['balance']}>
          <form action={setBalanceAction} className={styles.form}>
            <div className={styles.row}>
              <SignToggle name="balanceSign" value={me.balance < 0 ? '-' : '+'} label="Positive or overdrawn" />
              <MoneyInput name="balance" currency={cur} value={balance} autoFocus required label="Balance" />
            </div>
            <div className={styles.sheetActions}>
              <CloseButton className={styles.btnGhost}>Cancel</CloseButton>
              <Submit className={styles.btn}>Save balance</Submit>
            </div>
          </form>
        </UrlSheet>
      )}
    </>
  );

}

function WeekSheet({ week, fc: f, budgets: b, currency }: { week: Week; fc: Forecast; budgets: FcBudget[]; currency: string }) {
  const flows = weekFlows(week).filter((x) => x.kind !== 'jar' || x.amount !== 0);
  const daily = everyday(week);
  const fix = week.sky === 'storm' || week.sky === 'cloud' ? suggestFix(f, week, b) : null;
  const payday = nextIncomeAfter(f, week.lowDate);
  const until = payday ? diffDays(week.lowDate, payday.date) : null;
  const title = (
    <span className={styles.skyTitle}>
      <Sky sky={week.sky} />
      {week.sky === 'storm' ? 'Storm warning' : CONDITION[week.sky]} · {range(week.start, week.end)}
    </span>
  );
  const mm = (n: number, sign = false) => money(n, currency, { sign });
  return (
    <UrlSheet title={title} drop={['week']}>
      <div className={styles.details}>
        {flows.map((x, i) => (
          <span key={`${x.ref}${i}`}>
            {x.name} {x.calendar && <small>from your calendar</small>} <b className={x.amount > 0 ? styles.pos : undefined}>{x.amount > 0 ? mm(x.amount, true) : mm(-x.amount)}</b>
          </span>
        ))}
        <span>
          Everyday spending <small>from your budgets</small> <b>{mm(daily)}</b>
        </span>
      </div>
      <p className={styles.note}>
        {week.low < 0 ? 'Your balance dips to ' : 'Your lowest point is '}
        {mm(week.low)} on {short(week.lowDate)}
        {until !== null && until > 0 && until < 14 ? `, ${countWord(until)} ${until === 1 ? 'day' : 'days'} before payday.` : '.'}
      </p>
      {fix ? (
        <>
          <div className={styles.suggest}>
            <I d="bulb" size={18} />
            <span>
              Spend <b>{mm(fix.amount)}</b> less on {fix.name.toLowerCase()} before {short(fix.until)} to cover it.
            </span>
          </div>
          <form action={fixStormAction} className={styles.sheetActions}>
            <input type="hidden" name="categoryId" value={fix.categoryId} />
            <input type="hidden" name="amount" value={String(fix.amount / 100)} />
            <input type="hidden" name="until" value={fix.until} />
            <CloseButton className={styles.btnGhost}>Later</CloseButton>
            <Submit className={styles.btn} pending="Fixing…">
              Fix it
            </Submit>
          </form>
        </>
      ) : week.sky === 'storm' ? (
        <div className={styles.suggest}>
          <I d="bulb" size={18} />
          <span>
            Your budgets have no room left this month. Lower a bill, move a planned cost, or{' '}
            <Link href="/spending?tab=budgets" className={styles.linkBtn}>
              adjust budgets
            </Link>
            .
          </span>
        </div>
      ) : (
        <CloseButton className={`${styles.btnGhost} ${styles.btnWide}`}>Close</CloseButton>
      )}
    </UrlSheet>
  );
}
