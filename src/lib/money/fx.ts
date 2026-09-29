import 'server-only';
import type { Rates } from './currencies';

// Rates for prices billed in another currency. Fetched at most twice a day;
// when the service is down the last good rates, then these, are used.
const FALLBACK: Rates = { USD: 1, EUR: 0.88, GBP: 0.75, SEK: 9.96, NOK: 9.53, DKK: 6.57, CHF: 0.83, PLN: 3.84, CAD: 1.42, AUD: 1.43, NGN: 1329, INR: 96.1, JPY: 157.3 };
const FRESH_MS = 12 * 60 * 60 * 1000;

let last: { rates: Rates; at: number } | null = null;
let pending: Promise<Rates> | null = null;

export async function getRates(): Promise<Rates> {
  if (last && Date.now() - last.at < FRESH_MS) return last.rates;
  pending ??= (async () => {
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(3000), cache: 'no-store' });
      const body = (await res.json()) as { result?: string; rates?: Rates };
      if (body.result !== 'success' || !body.rates?.EUR) throw new Error('bad rates');
      last = { rates: body.rates, at: Date.now() };
    } catch (e) {
      console.error('Exchange rates unavailable, using saved ones', e);
      // Try again in ten minutes rather than on every request.
      last = { rates: last?.rates ?? FALLBACK, at: Date.now() - FRESH_MS + 10 * 60 * 1000 };
    } finally {
      pending = null;
    }
    return last.rates;
  })();
  return pending;
}
