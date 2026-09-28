import { addDays, addMonths, diffDays } from './dates';

export type Cadence = 'weekly' | 'biweekly' | 'monthly' | 'yearly';
export const CADENCES: Array<[Cadence, string]> = [
  ['monthly', 'Every month'],
  ['weekly', 'Every week'],
  ['biweekly', 'Every 2 weeks'],
  ['yearly', 'Every year'],
];

export function isCadence(v: unknown): v is Cadence {
  return v === 'weekly' || v === 'biweekly' || v === 'monthly' || v === 'yearly';
}

export function nextAfter(day: string, cadence: Cadence, anchorDay?: number): string {
  if (cadence === 'weekly') return addDays(day, 7);
  if (cadence === 'biweekly') return addDays(day, 14);
  if (cadence === 'yearly') return addMonths(day, 12, anchorDay);
  return addMonths(day, 1, anchorDay);
}

// Dates the item falls on in [from, to], starting at its next date.
export function occurrences(nextDate: string, cadence: Cadence, from: string, to: string): string[] {
  const anchor = Number(nextDate.slice(8, 10));
  const out: string[] = [];
  let d = nextDate;
  for (let i = 0; i < 1000 && diffDays(d, to) >= 0; i++) {
    if (diffDays(from, d) >= 0) out.push(d);
    d = nextAfter(d, cadence, anchor);
  }
  return out;
}

// Average amount per month, for sizing thresholds.
export function perMonth(amount: number, cadence: Cadence): number {
  if (cadence === 'weekly') return (amount * 52) / 12;
  if (cadence === 'biweekly') return (amount * 26) / 12;
  if (cadence === 'yearly') return amount / 12;
  return amount;
}

// The first date strictly after today, for a new item whose date is in the past.
export function rollForward(nextDate: string, cadence: Cadence, today: string): string {
  const anchor = Number(nextDate.slice(8, 10));
  let d = nextDate;
  for (let i = 0; i < 1000 && diffDays(d, today) >= 0; i++) d = nextAfter(d, cadence, anchor);
  return d;
}
