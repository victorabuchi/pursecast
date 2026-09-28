import { addDays } from './dates';

// Personal inflation: the same things bought now and a year ago. A purchase is
// "the same thing" when its note matches. Each item's price change counts by
// how much is spent on it now.

export type Buy = { date: string; amount: number; note: string; category: string };
export type Inflation = { rate: number; items: number; drivers: string[] } | { rate: null; items: number };

const key = (note: string) => note.trim().toLowerCase().replace(/\s+/g, ' ');

export function personalInflation(buys: Buy[], today: string): Inflation {
  const recentFrom = addDays(today, -90);
  const baseFrom = addDays(today, -455);
  const baseTo = addDays(today, -275);
  const groups = new Map<string, { now: number[]; then: number[]; category: string }>();
  for (const b of buys) {
    if (b.amount >= 0) continue;
    const g = groups.get(key(b.note)) ?? { now: [], then: [], category: b.category };
    if (b.date >= recentFrom && b.date <= today) g.now.push(-b.amount);
    else if (b.date >= baseFrom && b.date <= baseTo) g.then.push(-b.amount);
    groups.set(key(b.note), g);
  }
  const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const matched = [...groups.values()].filter((g) => g.now.length && g.then.length);
  if (matched.length < 3) return { rate: null, items: matched.length };
  const weight = matched.reduce((s, g) => s + g.now.reduce((a, x) => a + x, 0), 0);
  const byCategory = new Map<string, number>();
  let rate = 0;
  for (const g of matched) {
    const w = g.now.reduce((a, x) => a + x, 0) / weight;
    const change = avg(g.now) / avg(g.then) - 1;
    rate += w * change;
    byCategory.set(g.category, (byCategory.get(g.category) ?? 0) + w * change);
  }
  const drivers = [...byCategory.entries()].filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([c]) => c);
  return { rate: rate * 100, items: matched.length, drivers };
}
