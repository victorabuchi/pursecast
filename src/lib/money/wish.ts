import type { Forecast } from './forecast';

// The first day the purchase can be made without any later day of the
// forecast going below the cushion. Null when that never happens in the
// forecast window.
export function affordableFrom(fc: Forecast, price: number): string | null {
  let lowAhead = Infinity;
  let first: string | null = null;
  for (let i = fc.days.length - 1; i >= 0; i--) {
    const d = fc.days[i]!;
    lowAhead = Math.min(lowAhead, d.spendable);
    if (lowAhead - price >= fc.cushion) first = d.date;
    else break;
  }
  return first;
}

export const PRIORITIES: Array<[number, string]> = [
  [1, 'Really want'],
  [2, 'Would be nice'],
  [3, 'Someday'],
];
