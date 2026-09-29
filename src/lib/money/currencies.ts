// The currencies an account or a single price can be in.
export const CURRENCY_CODES = ['EUR', 'USD', 'GBP', 'SEK', 'NOK', 'DKK', 'CHF', 'PLN', 'CAD', 'AUD', 'NGN', 'INR', 'JPY'] as const;

export const isCurrency = (c: string): boolean => (CURRENCY_CODES as readonly string[]).includes(c);

// Units of each currency for one US dollar.
export type Rates = Record<string, number>;

// Cents in `from` as cents in `to`. Null when a rate is missing.
export function convert(cents: number, from: string, to: string, rates: Rates): number | null {
  if (from === to) return cents;
  const a = rates[from];
  const b = rates[to];
  if (!a || !b) return null;
  return Math.round((cents / a) * b);
}
