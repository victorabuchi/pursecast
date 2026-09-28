import { addMonths } from './dates';

// Plan ahead: price what is on the calendar before it happens.

export type Estimate = { tag: string; items: Array<{ name: string; amount: number }> };

// First match wins. Amounts are cents, rough and always editable.
const RULES: Array<{ re: RegExp; tag: string; items: (travel: boolean) => Array<[string, number]> }> = [
  { re: /wedding|häät|vihki/i, tag: 'Wedding', items: (t) => [...(t ? ([['Flights', 24000], ['Hotel · 2 nights', 18000]] as Array<[string, number]>) : []), ['Outfit', 12000], ['Gift', 8000]] },
  { re: /birthday|bday|b-day|synttär|syntymäpäiv/i, tag: 'Gift', items: () => [['Gift', 6000]] },
  { re: /christmas|xmas|joulu/i, tag: 'Holidays', items: () => [['Gifts', 20000]] },
  { re: /flight|fly to|trip|holiday|vacation|loma|matka|travel|getaway|weekend in/i, tag: 'Travel', items: () => [['Travel', 30000]] },
  { re: /dentist|hammaslääk|dental/i, tag: 'Health', items: () => [['Dentist', 8500]] },
  { re: /doctor|lääkäri|clinic|physio/i, tag: 'Health', items: () => [['Appointment', 4000]] },
  { re: /concert|keikka|gig|festival|show|theatre|theater|musical/i, tag: 'Fun', items: () => [['Tickets', 6000]] },
  { re: /anniversary|vuosipäivä/i, tag: 'Gift', items: () => [['Dinner and gift', 10000]] },
  { re: /graduation|valmistujai|christening|ristiäi|baby shower/i, tag: 'Gift', items: () => [['Gift', 5000]] },
  { re: /haircut|hairdresser|kampaamo|parturi|barber/i, tag: 'Personal', items: () => [['Haircut', 4500]] },
  { re: /car service|huolto|katsastus|inspection|tyre|tire/i, tag: 'Car', items: () => [['Car', 25000]] },
  { re: /moving|muutto|move out|move in/i, tag: 'Home', items: () => [['Moving costs', 40000]] },
  { re: /party|juhla|bachelor|polttarit/i, tag: 'Fun', items: () => [['Party', 4000]] },
  { re: /dinner|restaurant|ravintola/i, tag: 'Fun', items: () => [['Dinner', 5000]] },
];

export const TAGS = ['Wedding', 'Gift', 'Travel', 'Holidays', 'Health', 'Fun', 'Car', 'Home', 'Personal', 'Shopping', 'Other'];

export function estimate(name: string, location = ''): Estimate | null {
  const rule = RULES.find((r) => r.re.test(name));
  if (!rule) return null;
  return { tag: rule.tag, items: rule.items(Boolean(location.trim())).map(([n, amount]) => ({ name: n, amount })) };
}

export type IcsEvent = { uid: string; name: string; date: string; location: string };

function unescape(v: string): string {
  return v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();
}

// Reads VEVENTs from an iCal file and returns those in [from, to]. Yearly
// repeats (birthdays) are moved to their next date in the window; other
// repeating events (meetings) are skipped since they rarely cost money.
export function parseIcs(text: string, from: string, to: string): IcsEvent[] {
  const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const out: IcsEvent[] = [];
  let cur: Record<string, string> | null = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') cur = {};
    else if (line === 'END:VEVENT' && cur) {
      const raw = /(\d{8})/.exec(cur['DTSTART'] ?? '')?.[1];
      if (raw && cur['STATUS'] !== 'CANCELLED') {
        let date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
        const rrule = cur['RRULE'] ?? '';
        let ok = true;
        if (/FREQ=YEARLY/.test(rrule)) {
          for (let i = 0; i < 200 && date < from; i++) date = addMonths(date, 12);
        } else if (rrule) ok = false;
        if (ok && date >= from && date <= to) {
          out.push({ uid: `${cur['UID'] ?? `${cur['SUMMARY']}|${raw}`}|${date}`, name: unescape(cur['SUMMARY'] ?? ''), date, location: unescape(cur['LOCATION'] ?? '') });
        }
      }
      cur = null;
    } else if (cur) {
      const i = line.indexOf(':');
      if (i > 0) {
        const key = line.slice(0, i).split(';')[0]!.toUpperCase();
        if (!(key in cur)) cur[key] = line.slice(i + 1);
      }
    }
  }
  return out.filter((e) => e.name).sort((a, b) => (a.date < b.date ? -1 : 1));
}

// Google shows the secret address as https://; webcal:// is the same feed.
export function normalizeCalendarUrl(input: string): string | null {
  const s = input.trim().replace(/^webcals?:\/\//i, 'https://');
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

export const PLAN_MONTHS = 6;
export const planWindow = (today: string) => ({ from: today, to: addMonths(today, PLAN_MONTHS) });
