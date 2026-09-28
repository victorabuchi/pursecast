import { addDays, addMonthKey, dayOfMonth, daysInMonth, monthOf, monthsBetween, weekStart } from './dates';
import { occurrences, perMonth, type Cadence } from './recurrence';

// Money Weather: a day by day projection of spendable money. Spendable is the
// real balance minus what has been set aside for planned events. Amounts are
// cents throughout.

// skips are dates left out once. Advances come off the pay on their payday;
// one that has not arrived yet also comes in on arrivesOn.
export type FcRecurring = { id: string; name: string; amount: number; cadence: Cadence; nextDate: string; skips?: string[]; advances?: Array<{ payday: string; amount: number; arrivesOn?: string }> };
// budget and moves are per month; spent is what was logged this month so far.
export type FcBudget = { id: string; name: string; budget: number; spent: number; cuts: Record<string, number> };
export type FcEvent = { id: string; name: string; date: string; cost: number; saveMonthly: number | null; saveFrom: string | null; source: string };
export type FlowKind = 'bill' | 'income' | 'event' | 'jar' | 'debt';
// Money you owe someone, paid back on its due date.
export type FcDebt = { id: string; person: string; remaining: number; dueDate: string };
export type Flow = { name: string; amount: number; kind: FlowKind; ref: string; calendar?: boolean };
export type FcDay = { date: string; spendable: number; real: number; daily: number; flows: Flow[] };
export type Sky = 'sun' | 'partly' | 'cloud' | 'storm';
export type Week = { start: string; end: string; low: number; lowDate: string; sky: Sky; days: FcDay[] };

export type ForecastInput = {
  today: string;
  balance: number;
  cushion: number;
  recurring: FcRecurring[];
  budgets: FcBudget[];
  events: FcEvent[];
  debts?: FcDebt[];
  days: number;
};

export type Forecast = {
  today: string;
  balance: number;
  reserved: number;
  spendable: number;
  days: FcDay[];
  low: { date: string; amount: number };
  monthlyOut: number;
  cushion: number;
};

// Months a jar pays into: from saveFrom up to the month before the event (at
// least one). The first month counts as soon as saving starts; later months
// on their 1st.
export function jarMonths(ev: Pick<FcEvent, 'date' | 'saveFrom'>): string[] {
  if (!ev.saveFrom) return [];
  const last = monthsBetween(ev.saveFrom, monthOf(ev.date)) - 1;
  const n = Math.max(1, last + 1);
  return Array.from({ length: n }, (_, i) => addMonthKey(ev.saveFrom!, i));
}

// Set aside for the event by the end of `day`.
export function jarAccrued(ev: FcEvent, day: string): number {
  if (!ev.saveMonthly || !ev.saveFrom) return 0;
  let total = 0;
  for (const [i, m] of jarMonths(ev).entries()) {
    if (i > 0 && `${m}-01` > day) break;
    if (i === 0 && m > monthOf(day)) break;
    total += ev.saveMonthly;
  }
  return Math.min(total, ev.cost);
}

// Monthly amount that pays for the event before it happens.
export function saveSuggestion(cost: number, today: string, date: string): { monthly: number; months: number } {
  const months = Math.max(1, monthsBetween(monthOf(today), monthOf(date)));
  return { monthly: Math.ceil(cost / months / 100) * 100, months };
}

export function buildForecast(input: ForecastInput): Forecast {
  const { today, balance, days: horizon } = input;
  const upcoming = input.events.filter((e) => e.date > today);
  const reserved = upcoming.reduce((sum, e) => sum + jarAccrued(e, today), 0);
  const end = addDays(today, horizon - 1);

  const flowsByDay = new Map<string, Flow[]>();
  const push = (date: string, flow: Flow) => {
    if (date <= today || date > end || flow.amount === 0) return;
    const list = flowsByDay.get(date) ?? [];
    list.push(flow);
    flowsByDay.set(date, list);
  };
  for (const r of input.recurring) {
    for (const a of r.advances ?? []) {
      if (a.arrivesOn) push(a.arrivesOn, { name: `${r.name} advance`, amount: a.amount, kind: 'income', ref: `${r.id}:advance` });
    }
    for (const d of occurrences(r.nextDate, r.cadence, addDays(today, 1), end)) {
      if (r.skips?.includes(d)) continue;
      const advanced = (r.advances ?? []).filter((a) => a.payday === d).reduce((s, a) => s + a.amount, 0);
      push(d, { name: advanced ? `${r.name} (after advance)` : r.name, amount: r.amount - advanced, kind: r.amount > 0 ? 'income' : 'bill', ref: r.id });
    }
  }
  for (const e of upcoming) {
    for (const [i, m] of jarMonths(e).entries()) {
      if (!e.saveMonthly) break;
      if (i === 0 && m <= monthOf(today)) continue;
      const on = `${m}-01`;
      const before = jarAccrued(e, addDays(on, -1));
      const add = Math.min(e.saveMonthly, e.cost - before);
      if (add > 0) push(on, { name: `Set aside · ${e.name}`, amount: -add, kind: 'jar', ref: e.id });
    }
    const unpaid = e.cost - jarAccrued(e, addDays(e.date, -1));
    push(e.date, { name: e.name, amount: -Math.max(0, unpaid), kind: 'event', ref: e.id, calendar: e.source === 'calendar' });
  }

  // Overdue debts are assumed to be paid tomorrow.
  for (const d of input.debts ?? []) {
    push(d.dueDate > today ? d.dueDate : addDays(today, 1), { name: `Pay back ${d.person}`, amount: -d.remaining, kind: 'debt', ref: d.id });
  }

  // Everyday spending: each budget spread evenly over its month. This month
  // it stops once the budget is used up.
  const dailyFor = (date: string): number => {
    const month = monthOf(date);
    const [y, m] = month.split('-').map(Number);
    const dim = daysInMonth(y!, m!);
    let total = 0;
    for (const b of input.budgets) {
      const planned = Math.max(0, b.budget - (b.cuts[month] ?? 0));
      if (month === monthOf(today)) {
        // The usual pace for the days left, but never more than is left.
        const left = dim - dayOfMonth(today) + 1;
        total += Math.min(Math.max(0, planned - b.spent), (planned / dim) * left) / left;
      } else {
        total += planned / dim;
      }
    }
    return total;
  };

  const days: FcDay[] = [];
  let spendable = balance - reserved;
  let reserve = reserved;
  for (let i = 0; i < horizon; i++) {
    const date = addDays(today, i);
    const flows = flowsByDay.get(date) ?? [];
    const daily = dailyFor(date);
    for (const f of flows) {
      spendable += f.amount;
      if (f.kind === 'jar') reserve -= f.amount;
    }
    // An event is paid partly from its jar: the jar empties that day.
    for (const e of upcoming) if (e.date === date) reserve -= jarAccrued(e, addDays(date, -1));
    spendable -= daily;
    days.push({ date, spendable: Math.round(spendable), real: Math.round(spendable + reserve), daily: Math.round(daily), flows });
  }

  let low = { date: today, amount: days[0]?.spendable ?? balance - reserved };
  for (const d of days) if (d.spendable < low.amount) low = { date: d.date, amount: d.spendable };

  const monthlyOut =
    input.recurring.filter((r) => r.amount < 0).reduce((s, r) => s - perMonth(r.amount, r.cadence), 0) + input.budgets.reduce((s, b) => s + b.budget, 0);

  return { today, balance, reserved, spendable: balance - reserved, days, low, monthlyOut, cushion: input.cushion };
}

export function skyFor(low: number, cushion: number, monthlyOut: number): Sky {
  if (low < 0) return 'storm';
  if (low < cushion + 0.1 * monthlyOut) return 'cloud';
  if (low < cushion + 0.6 * monthlyOut) return 'partly';
  return 'sun';
}

// Weeks from Monday of this week; the first one starts today.
export function weeksOf(fc: Forecast, count = 13): Week[] {
  const weeks: Week[] = [];
  let start = weekStart(fc.today);
  for (let i = 0; i < count; i++) {
    const end = addDays(start, 6);
    const days = fc.days.filter((d) => d.date >= start && d.date <= end);
    if (!days.length) break;
    let lowDay = days[0]!;
    for (const d of days) if (d.spendable < lowDay.spendable) lowDay = d;
    weeks.push({ start, end, low: lowDay.spendable, lowDate: lowDay.date, sky: skyFor(lowDay.spendable, fc.cushion, fc.monthlyOut), days });
    start = addDays(start, 7);
  }
  return weeks;
}

export function conditionOf(fc: Forecast): Sky {
  return skyFor(fc.low.amount, fc.cushion, fc.monthlyOut);
}

// Calendar months over the forecast, for the longer views; the first one
// starts today.
export function monthsOfForecast(fc: Forecast): Week[] {
  const out: Week[] = [];
  for (const d of fc.days) {
    const last = out[out.length - 1];
    if (last && monthOf(last.start) === monthOf(d.date)) {
      last.days.push(d);
      last.end = d.date;
      if (d.spendable < last.low) {
        last.low = d.spendable;
        last.lowDate = d.date;
      }
    } else {
      out.push({ start: d.date, end: d.date, low: d.spendable, lowDate: d.date, sky: 'sun', days: [d] });
    }
  }
  for (const m of out) m.sky = skyFor(m.low, fc.cushion, fc.monthlyOut);
  return out;
}

// The lowest week when it is cloudy or stormy.
export function worstWeek(weeks: Week[]): Week | null {
  let worst: Week | null = null;
  for (const w of weeks) if (!worst || w.low < worst.low) worst = w;
  return worst && worst.sky !== 'sun' && worst.sky !== 'partly' ? worst : null;
}

// Last day before the first week that is not sunny, or null if all are sunny.
export function sunnyUntil(weeks: Week[]): string | null {
  const firstBad = weeks.findIndex((w) => w.sky !== 'sun');
  if (firstBad === -1) return null;
  if (firstBad === 0) return null;
  return addDays(weeks[firstBad]!.start, -1);
}

export function nextIncomeAfter(fc: Forecast, date: string): { date: string; name: string } | null {
  for (const d of fc.days) {
    if (d.date <= date) continue;
    const income = d.flows.find((f) => f.kind === 'income');
    if (income) return { date: d.date, name: income.name };
  }
  return null;
}

// Budgets people should cut last.
const ESSENTIAL = new Set(['Groceries', 'Health', 'Transport']);

// How much to spend less, from which budget, before the week's low point so
// it stays above the cushion, with a little room to spare.
export function suggestFix(fc: Forecast, week: Week, budgets: FcBudget[]): { categoryId: string; name: string; amount: number; until: string } | null {
  const need = fc.cushion - week.low;
  if (need <= 0) return null;
  const days = fc.days.filter((d) => d.date <= week.lowDate);
  // What each budget is still expected to spend before the low point.
  const room = (b: FcBudget) =>
    days.reduce((sum, d) => {
      const [y, m] = monthOf(d.date).split('-').map(Number);
      return sum + Math.max(0, b.budget - (b.cuts[monthOf(d.date)] ?? 0)) / daysInMonth(y!, m!);
    }, 0);
  const ranked = budgets
    .map((b) => ({ b, room: room(b) }))
    .filter((x) => x.room >= 1000)
    .sort((a, b) => Number(ESSENTIAL.has(a.b.name)) - Number(ESSENTIAL.has(b.b.name)) || b.room - a.room);
  const best = ranked[0];
  if (!best) return null;
  const want = Math.ceil((need + 5000) / 5000) * 5000;
  const amount = Math.min(want, Math.floor(best.room / 1000) * 1000);
  return { categoryId: best.b.id, name: best.b.name, amount, until: week.lowDate };
}

// Spending `amount` less between today and `until`, as cuts to each month's
// budget. Budgets are spread over whole months, so a month only partly in the
// range is cut by more to save its share in time.
export function spreadCut(amount: number, today: string, until: string): Record<string, number> {
  const byMonth = new Map<string, number>();
  for (let d = today; d <= until; d = addDays(d, 1)) byMonth.set(monthOf(d), (byMonth.get(monthOf(d)) ?? 0) + 1);
  const total = [...byMonth.values()].reduce((s, n) => s + n, 0);
  const out: Record<string, number> = {};
  for (const [month, n] of byMonth) {
    const [y, m] = month.split('-').map(Number);
    out[month] = Math.round((amount * n) / total * (daysInMonth(y!, m!) / n));
  }
  return out;
}

// The flows in a week that are worth naming, biggest outgoings first.
export function weekFlows(week: Week): Flow[] {
  return week.days.flatMap((d) => d.flows).sort((a, b) => a.amount - b.amount);
}

export function everyday(week: Week): number {
  return week.days.reduce((s, d) => s + d.daily, 0);
}
