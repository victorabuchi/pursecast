import { diffDays } from './dates';

// Timeline Forks: a "what if" runs next to real life from its start date, as
// real life plus a one-off amount plus its monthly differences.

export type ForkLike = { startDate: string; oneTime: number; monthly: number };

const MONTH_DAYS = 30.4375;

export function forkValue(real: number, fork: ForkLike, at: string): number | null {
  const days = diffDays(fork.startDate, at);
  if (days < 0) return null;
  return Math.round(real + fork.oneTime + (fork.monthly * days) / MONTH_DAYS);
}

export type Point = { date: string; value: number };

// Real life before today is the balance then: today's balance minus what was
// logged after that day. Null before the balance was first entered.
export function pastBalance(balanceNow: number, entries: Array<{ date: string; amount: number }>, at: string, firstDay: string): number | null {
  if (at < firstDay) return null;
  return balanceNow - entries.filter((e) => e.date > at).reduce((s, e) => s + e.amount, 0);
}

// Chart coordinates: x by date over the window, y by value over the range.
export function scale(points: Point[][], from: string, to: string, w = 600, h = 200) {
  const values = points.flat().map((p) => p.value);
  let min = Math.min(0, ...values);
  let max = Math.max(...values, 1);
  const pad = (max - min) * 0.12 || 1;
  min -= pad;
  max += pad;
  const span = Math.max(1, diffDays(from, to));
  return {
    min,
    max,
    x: (date: string) => (diffDays(from, date) / span) * w,
    y: (value: number) => h - ((value - min) / (max - min)) * h,
  };
}
