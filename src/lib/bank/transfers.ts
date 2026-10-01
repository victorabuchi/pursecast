import { diffDays } from '../money/dates';

// Which bank transactions are money moving between the person's own
// accounts, so they are neither spending nor income. Pure, so it is tested.

export type Line = { id: string; statementId: string; date: string; amount: number; value: number; place: string; description: string; category: string };

// The same money within this many days counts as the same transaction.
export const MATCH_DAYS = 3;

// Wording banks use for moving money between someone's own accounts.
const INTERNAL = /\bexchang|\btop[- ]?up\b|\bpocket\b|\bvault\b|savings account|\bto savings\b|\bfrom savings\b|own account|internal transfer|oma tili|omalle tilille|omien tilien/i;

// Money to or from the person themselves (their own name on the other side).
export function ownName(names: string[], text: string): boolean {
  const t = text.toLowerCase();
  return names.some((n) => {
    const parts = n.toLowerCase().split(/\s+/).filter((p) => p.length > 1);
    return parts.length >= 2 && parts.every((p) => t.includes(p));
  });
}

// bankOf: the bank each statement belongs to ("S-Pankki"); names: the
// person's own names (their profile, account holders).
export function findTransfers(lines: Line[], ctx: { names: string[]; bankOf: Map<string, string> }): Set<string> {
  const banks = [...new Set(ctx.bankOf.values())];
  const bankWords = [...new Set(banks.map((b) => b.toLowerCase().split(/[^\p{L}]+/u).find((w) => w.length >= 4) ?? ''))].filter(Boolean);
  const out = new Set<string>();
  for (const t of lines) {
    const text = `${t.place} ${t.description}`;
    const own = (ctx.bankOf.get(t.statementId) ?? '').toLowerCase();
    // A payment to or from another connected bank (S-Pankki paying "Revolut 1891").
    const otherBank = bankWords.some((w) => !own.includes(w) && text.toLowerCase().includes(w));
    if (t.category === 'Transfers' || INTERNAL.test(text) || ownName(ctx.names, text) || otherBank) out.add(t.id);
  }
  // The same amount out of one account and into another within a few days
  // (across currencies, within 2%).
  const pool = lines.filter((t) => t.category !== 'Transfers');
  const paired = new Set<string>();
  for (const t of pool) {
    if (t.amount >= 0 || paired.has(t.id)) continue;
    const twin = pool.find((o) => !paired.has(o.id) && o.statementId !== t.statementId && o.amount > 0 && (o.amount === -t.amount || Math.abs(o.value + t.value) <= Math.max(100, Math.abs(t.value) * 0.02)) && Math.abs(diffDays(o.date, t.date)) <= MATCH_DAYS);
    if (twin) {
      paired.add(t.id);
      paired.add(twin.id);
    }
  }
  for (const id of paired) out.add(id);
  return out;
}
