import { evaluate, isExpression } from './calc';

// Amounts are integer cents. Whole units unless cents are asked for; the
// minus sign is U+2212 like the rest of the design.

const cache = new Map<string, Intl.NumberFormat>();
function nf(currency: string, cents: boolean): Intl.NumberFormat {
  const key = `${currency}|${cents}`;
  let f = cache.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
    } catch {
      f = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
    }
    cache.set(key, f);
  }
  return f;
}

export function money(amount: number, currency: string, opts: { cents?: boolean; sign?: boolean } = {}): string {
  const showCents = opts.cents ?? false;
  const value = showCents ? Math.abs(amount) / 100 : Math.round(Math.abs(amount) / 100);
  const body = nf(currency, showCents).format(value);
  if (amount < 0 && (showCents || Math.round(Math.abs(amount) / 100) > 0)) return `−${body}`;
  return opts.sign && amount > 0 ? `+${body}` : body;
}

// Cents with decimals only when there are any: 12 → €12, 12.5 → €12.50.
export function exact(amount: number, currency: string, opts: { sign?: boolean } = {}): string {
  return money(amount, currency, { cents: amount % 100 !== 0, sign: opts.sign });
}

export function currencySymbol(currency: string): string {
  return nf(currency, false).formatToParts(0).find((p) => p.type === 'currency')?.value ?? currency;
}

// Parses "12", "12.5", "12,50", "1 200", "€1,200.00" into cents. Null when not a number.
export function parseAmount(input: string): number | null {
  // "200 + 10 + 45" and other sums are worked out first.
  if (isExpression(input)) {
    const v = evaluate(input);
    return v === null ? null : Math.round(v * 100);
  }
  let s = input.replace(/[^\d.,-]/g, '');
  if (!s || !/\d/.test(s)) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) {
    // "12,50" decimal comma, or "1,200" thousands.
    s = s.length - lastComma === 3 || s.length - lastComma === 2 ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else {
    s = s.replace(/,/g, '');
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export const roundUp = (cents: number, step: number) => Math.ceil(cents / step) * step;

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1]![0] : (parts[0]?.[1] ?? ''))).toUpperCase() || '?';
}
