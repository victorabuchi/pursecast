// Local calendar days as 'YYYY-MM-DD' strings. Arithmetic runs in UTC on the
// day itself, so daylight saving never shifts a date.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LONG_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function isDay(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toUtc(s));
}

function toUtc(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y!, m! - 1, d!);
}

function fromUtc(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function todayIn(timeZone: string, now = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)!.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    return fromUtc(now.getTime());
  }
}

export function addDays(day: string, n: number): string {
  return fromUtc(toUtc(day) + n * 86_400_000);
}

export function diffDays(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

// Same day of month n months later, clamped to the month's last day.
export function addMonths(day: string, n: number, dayOfMonth?: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const index = y! * 12 + (m! - 1) + n;
  const year = Math.floor(index / 12);
  const month1 = (index % 12) + 1;
  const dd = Math.min(dayOfMonth ?? d!, daysInMonth(year, month1));
  return `${year}-${String(month1).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

export const monthOf = (day: string) => day.slice(0, 7);
export const dayOfMonth = (day: string) => Number(day.slice(8, 10));
export const monthStart = (day: string) => `${day.slice(0, 7)}-01`;
export function monthEnd(day: string): string {
  const [y, m] = day.split('-').map(Number);
  return `${day.slice(0, 7)}-${String(daysInMonth(y!, m!)).padStart(2, '0')}`;
}

export function addMonthKey(month: string, n: number): string {
  return addMonths(`${month}-01`, n).slice(0, 7);
}

export function monthsBetween(fromMonth: string, toMonth: string): number {
  const [a, b] = [fromMonth, toMonth].map((m) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1);
  return b! - a!;
}

// Monday of the week the day is in.
export function weekStart(day: string): string {
  const dow = new Date(toUtc(day)).getUTCDay();
  return addDays(day, -((dow + 6) % 7));
}

export function weekday(day: string): string {
  return WEEKDAYS[new Date(toUtc(day)).getUTCDay()]!;
}

// "Nov 3"
export function short(day: string): string {
  return `${MONTHS[Number(day.slice(5, 7)) - 1]} ${Number(day.slice(8, 10))}`;
}

// "Nov 3–9" or "Oct 27–Nov 2"
export function range(from: string, to: string): string {
  return from.slice(0, 7) === to.slice(0, 7) ? `${short(from)}–${Number(to.slice(8, 10))}` : `${short(from)}–${short(to)}`;
}

export function monthName(month: string, long = false): string {
  return (long ? LONG_MONTHS : MONTHS)[Number(month.slice(5, 7)) - 1]!;
}

export function monthLabel(month: string, today: string): string {
  const name = monthName(month, true);
  return month.slice(0, 4) === today.slice(0, 4) ? name : `${name} ${month.slice(0, 4)}`;
}

// "Today", "Yesterday", "Fri", or "Sep 12" for older days.
export function relative(day: string, today: string): string {
  const d = diffDays(day, today);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d === -1) return 'Tomorrow';
  if (d > 0 && d < 7) return weekday(day);
  return short(day);
}

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
export const countWord = (n: number) => WORDS[n] ?? String(n);

const LONG_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// "yesterday's", "Friday's", or "your Sep 12" for older days.
export function possessive(day: string, today: string): string {
  const d = diffDays(day, today);
  if (d === 1) return "yesterday's";
  if (d > 1 && d < 7) return `${LONG_WEEKDAYS[new Date(toUtc(day)).getUTCDay()]}'s`;
  return `your ${short(day)}`;
}

export function ago(day: string, today: string): string {
  const d = diffDays(day, today);
  return d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
}

// The current instant, kept out of components so they stay pure.
export const nowMs = () => Date.now();
export const isoAgo = (days: number) => new Date(nowMs() - days * 86_400_000).toISOString();
