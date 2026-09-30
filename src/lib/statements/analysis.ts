import type { Txn } from './types';

// Looking back over imported transactions. Transfers between the person's own
// accounts are left out of both money in and money out.

export type Story = {
  from: string;
  to: string;
  moneyIn: number;
  moneyOut: number;
  months: Array<{ month: string; in: number; out: number }>;
  categories: Array<{ name: string; out: number; share: number; count: number }>;
  places: Array<{ name: string; out: number; count: number }>;
  sources: Array<{ name: string; in: number; count: number }>;
  biggest: Txn[];
  recurring: Array<{ name: string; typical: number; months: number; yearly: number; last: string; category: string }>;
  highlights: string[];
};

const counted = (t: Txn) => t.category !== 'Transfers';

function group<T>(items: T[], key: (t: T) => string) {
  const m = new Map<string, T[]>();
  for (const t of items) m.set(key(t), [...(m.get(key(t)) ?? []), t]);
  return m;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
};

export function story(all: Txn[], fmt: (cents: number) => string, monthName: (month: string) => string): Story | null {
  const txns = all.filter(counted);
  if (!txns.length) return null;
  const sorted = [...all].sort((a, b) => (a.date < b.date ? -1 : 1));
  const out = txns.filter((t) => t.amount < 0);
  const inc = txns.filter((t) => t.amount > 0);
  const moneyOut = -out.reduce((s, t) => s + t.amount, 0);
  const moneyIn = inc.reduce((s, t) => s + t.amount, 0);

  const monthKeys = [...new Set(sorted.map((t) => t.date.slice(0, 7)))];
  const months = monthKeys.map((m) => ({
    month: m,
    in: inc.filter((t) => t.date.startsWith(m)).reduce((s, t) => s + t.amount, 0),
    out: -out.filter((t) => t.date.startsWith(m)).reduce((s, t) => s + t.amount, 0),
  }));

  const categories = [...group(out, (t) => t.category)]
    .map(([name, ts]) => ({ name, out: -ts.reduce((s, t) => s + t.amount, 0), count: ts.length, share: 0 }))
    .sort((a, b) => b.out - a.out)
    .map((c) => ({ ...c, share: moneyOut ? c.out / moneyOut : 0 }));

  const places = [...group(out, (t) => t.place.toLowerCase())]
    .map(([, ts]) => ({ name: ts[0]!.place, out: -ts.reduce((s, t) => s + t.amount, 0), count: ts.length }))
    .sort((a, b) => b.out - a.out)
    .slice(0, 10);

  const sources = [...group(inc, (t) => t.place.toLowerCase())]
    .map(([, ts]) => ({ name: ts[0]!.place, in: ts.reduce((s, t) => s + t.amount, 0), count: ts.length }))
    .sort((a, b) => b.in - a.in)
    .slice(0, 6);

  // Charged about once a month at a similar price, in most of the months:
  // rent, subscriptions, phone. Frequent shops (groceries) do not count.
  const recurringAll = [...group(out, (t) => t.place.toLowerCase())]
    .map(([key, ts]) => {
      const typical = median(ts.map((t) => -t.amount));
      const similar = ts.filter((t) => Math.abs(-t.amount - typical) <= Math.max(200, typical * 0.15));
      const months = new Set(similar.map((t) => t.date.slice(0, 7))).size;
      const last = ts.reduce((d, t) => (t.date > d ? t.date : d), '');
      return { key, name: ts[0]!.place, typical, months, perMonth: ts.length / Math.max(1, months), yearly: typical * 12, last, category: ts[0]!.category };
    })
    .filter((r) => r.months >= 3 && r.months >= monthKeys.length * 0.6 && r.perMonth <= 1.5)
    .sort((a, b) => b.yearly - a.yearly);
  const regular = new Set(recurringAll.map((r) => r.key));
  const recurring = recurringAll.slice(0, 12).map(({ name, typical, months, yearly, last, category }) => ({ name, typical, months, yearly, last, category }));

  // One-off purchases, not the monthly charges above.
  const biggest = out
    .filter((t) => !regular.has(t.place.toLowerCase()))
    .sort((a, b) => a.amount - b.amount)
    .slice(0, 8);

  const highlights: string[] = [];
  if (months.length > 1) {
    const top = [...months].sort((a, b) => b.out - a.out)[0]!;
    const low = [...months].sort((a, b) => a.out - b.out)[0]!;
    highlights.push(`You spent the most in ${monthName(top.month)} (${fmt(top.out)}) and the least in ${monthName(low.month)} (${fmt(low.out)}).`);
  }
  if (categories[0]) highlights.push(`${categories[0].name} took the biggest share: ${Math.round(categories[0].share * 100)}% of everything you spent.`);
  if (places[0]) highlights.push(`Your most-paid place was ${places[0].name}: ${fmt(places[0].out)} over ${places[0].count} ${places[0].count === 1 ? 'payment' : 'payments'}.`);
  if (recurring.length) highlights.push(`${recurring.length} regular ${recurring.length === 1 ? 'charge adds' : 'charges add'} up to about ${fmt(recurring.reduce((s, r) => s + r.typical, 0))} a month.`);
  const net = moneyIn - moneyOut;
  if (moneyIn) highlights.push(net >= 0 ? `You kept ${fmt(net)}, ${Math.round((net / moneyIn) * 100)}% of what came in.` : `You spent ${fmt(-net)} more than came in.`);

  return { from: sorted[0]!.date, to: sorted[sorted.length - 1]!.date, moneyIn, moneyOut, months, categories, places, sources, biggest, recurring, highlights };
}

// A transaction already imported from an earlier upload: same day, amount
// and place. Two identical coffees in one upload are both kept.
export const txnKey = (t: Pick<Txn, 'date' | 'amount' | 'place'>) => `${t.date}|${t.amount}|${t.place.toLowerCase().replace(/[^a-z0-9äöå]+/g, '')}`;

// A bank's name for a charge as people say it: "NETFLIX.COM" → "Netflix",
// "SPOTIFY P1A2B3C4" → "Spotify".
export function tidyName(place: string): string {
  let s = place
    .replace(/\b(www\.)/i, '')
    .replace(/\.(com|net|org|io|co|fi|de|eu|uk|se)\b.*$/i, '')
    .replace(/\s+[A-Z0-9]*\d[A-Z0-9]{3,}$/i, '')
    .replace(/[*#].*$/, '')
    .trim();
  if (s === s.toUpperCase()) s = s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
  s = s.charAt(0).toUpperCase() + s.slice(1);
  return s || place;
}
