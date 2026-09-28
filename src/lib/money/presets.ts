import type { Cadence } from './recurrence';

// Popular subscriptions with a typical price in euro cents, as a starting
// point people correct. Bills vary too much to guess, so they come without.
export const POPULAR_SUBSCRIPTIONS: Array<{ name: string; amount?: number; cadence?: Cadence }> = [
  { name: 'Netflix', amount: 1399 },
  { name: 'Spotify', amount: 1199 },
  { name: 'Disney+', amount: 999 },
  { name: 'HBO Max', amount: 999 },
  { name: 'YouTube Premium', amount: 1299 },
  { name: 'Apple Music', amount: 1099 },
  { name: 'iCloud+', amount: 299 },
  { name: 'Google One', amount: 199 },
  { name: 'Amazon Prime', amount: 899 },
  { name: 'Viaplay', amount: 1299 },
  { name: 'Audible', amount: 995 },
  { name: 'ChatGPT Plus', amount: 2300 },
  { name: 'PlayStation Plus', amount: 899 },
  { name: 'Xbox Game Pass', amount: 1299 },
  { name: 'Microsoft 365', amount: 9900, cadence: 'yearly' },
  { name: 'Adobe Creative Cloud', amount: 6699 },
  { name: 'Dropbox', amount: 1199 },
  { name: 'Gym', amount: 3900 },
  { name: 'Newspaper', amount: 1500 },
  { name: 'Render' },
  { name: 'Supabase' },
  { name: 'Vercel' },
  { name: 'AWS' },
  { name: 'Anthropic API' },
];

export const POPULAR_BILLS: Array<{ name: string; amount?: number; cadence?: Cadence }> = [
  { name: 'Phone' },
  { name: 'Electricity' },
  { name: 'Internet' },
  { name: 'Water' },
  { name: 'Heating' },
  { name: 'Home insurance' },
  { name: 'Car insurance', cadence: 'yearly' },
  { name: 'Travel insurance', cadence: 'yearly' },
  { name: 'Car loan' },
  { name: 'Student loan' },
  { name: 'Public transport pass' },
  { name: 'Parking' },
  { name: 'TV licence', cadence: 'yearly' },
  { name: 'Union fee' },
  { name: 'Childcare' },
];
