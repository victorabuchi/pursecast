import { addDays, diffDays, weekStart } from './dates';
import type { Forecast } from './forecast';

// The Life page: age and birthdays, how much can be saved safely, saving
// streaks, what saving grows into, and what the spending says.

export type Age = { years: number; daysSince: number; next: string; daysToNext: number; isBirthday: boolean };

// A date in a given year, Feb 29 falling on Feb 28 in other years.
function inYear(birthday: string, year: number): string {
  const [, m, d] = birthday.split('-');
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return `${year}-${m}-${m === '02' && d === '29' && !leap ? '28' : d}`;
}

export function ageOn(birthday: string, today: string): Age {
  const y = Number(today.slice(0, 4));
  const thisYear = inYear(birthday, y);
  const last = thisYear <= today ? thisYear : inYear(birthday, y - 1);
  const next = thisYear > today ? thisYear : inYear(birthday, y + 1);
  return {
    years: Number(last.slice(0, 4)) - Number(birthday.slice(0, 4)),
    daysSince: diffDays(last, today),
    next,
    daysToNext: diffDays(today, next),
    isBirthday: thisYear === today,
  };
}

// What can be moved to savings today without the forecast dipping below the
// cushion in the next 30 days, rounded down to €5.
export function safeToSave(fc: Forecast, days = 30): number {
  const until = addDays(fc.today, days);
  const window = fc.days.filter((d) => d.date <= until);
  if (!window.length) return 0;
  const low = Math.min(...window.map((d) => d.spendable));
  return Math.max(0, Math.floor((low - fc.cushion) / 500) * 500);
}

// Weeks in a row (Monday to Sunday) with something saved, counting this week
// when it already has a deposit, otherwise up to last week.
export function savingStreak(dates: string[], today: string): number {
  const weeks = new Set(dates.map((d) => weekStart(d)));
  let wk = weekStart(today);
  if (!weeks.has(wk)) wk = addDays(wk, -7);
  let n = 0;
  while (weeks.has(wk)) {
    n++;
    wk = addDays(wk, -7);
  }
  return n;
}

// What saving `monthly` cents every month grows to after `years`, with a
// yearly return (0.04 is a careful long-run guess for an index fund; 0 for a
// plain savings account).
export function grows(monthly: number, years: number, yearly = 0.04, start = 0): number {
  const r = yearly / 12;
  const n = Math.round(years * 12);
  if (r === 0) return start + monthly * n;
  return Math.round(start * Math.pow(1 + r, n) + monthly * ((Math.pow(1 + r, n) - 1) / r));
}

// Weekly amount that reaches a goal by its date (at least one week).
export function weeklyPace(remaining: number, today: string, byDate: string | null): number | null {
  if (!byDate || remaining <= 0) return null;
  const weeks = Math.max(1, Math.ceil(diffDays(today, byDate) / 7));
  return Math.ceil(remaining / weeks / 100) * 100;
}

type Entry = { date: string; amount: number; categoryId: string | null };
type Cat = { id: string; name: string; kind: string };

export type Habits = {
  months: number;
  inPerMonth: number;
  outPerMonth: number;
  // Share of what came in that was kept (negative when more went out).
  keptRate: number | null;
  top: Array<{ name: string; perMonth: number; share: number }>;
  subscriptionsPerYear: number;
  eatingOutPerMonth: number;
  // What one hour of the person's income is worth, when there is income.
  hourly: number | null;
};

// Money habits over the last `days` (90 by default).
export function habitsOf(entries: Entry[], cats: Cat[], today: string, days = 90): Habits {
  const from = addDays(today, -days);
  const recent = entries.filter((e) => e.date > from && e.date <= today);
  const months = days / 30.44;
  const byId = new Map(cats.map((c) => [c.id, c]));
  const out = recent.filter((e) => e.amount < 0);
  const inSum = recent.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const outSum = -out.reduce((s, e) => s + e.amount, 0);
  const perCat = new Map<string, number>();
  for (const e of out) {
    const name = (e.categoryId && byId.get(e.categoryId)?.name) || 'Other';
    perCat.set(name, (perCat.get(name) ?? 0) - e.amount);
  }
  const top = [...perCat]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, sum]) => ({ name, perMonth: Math.round(sum / months), share: outSum ? sum / outSum : 0 }));
  const sumOf = (...names: string[]) => names.reduce((s, n) => s + (perCat.get(n) ?? 0), 0);
  const inPerMonth = Math.round(inSum / months);
  return {
    months,
    inPerMonth,
    outPerMonth: Math.round(outSum / months),
    keptRate: inSum ? (inSum - outSum) / inSum : null,
    top,
    subscriptionsPerYear: Math.round((sumOf('Subscriptions') / months) * 12),
    eatingOutPerMonth: Math.round(sumOf('Eating out', 'Takeaway', 'Coffee') / months),
    // About 160 working hours a month.
    hourly: inPerMonth > 0 ? Math.round(inPerMonth / 160) : null,
  };
}
