import 'server-only';
import { convert, isCurrency, type Rates } from './currencies';

export type Priced = { amount: number; priceCurrency: string | null; priceAmount: number | null };

// A price as entered (positive cents in `billed`) as the stored fields: the
// amount in the account currency, plus the billed price when it differs.
export function priced(cents: number, billed: string, account: string, rates: Rates): Priced {
  if (!cents || !isCurrency(billed) || billed === account) return { amount: cents, priceCurrency: null, priceAmount: null };
  const amount = convert(cents, billed, account, rates);
  if (amount === null) return { amount: cents, priceCurrency: null, priceAmount: null };
  return { amount, priceCurrency: billed, priceAmount: cents };
}
