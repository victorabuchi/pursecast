import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { db } from '../../prisma/db';
import { estimate, parseIcs, planWindow } from './plan';

// Reads the person's calendar from its secret iCal address and turns events
// that cost money into Plan ahead events. The address is fetched by the
// server, so only public https hosts are allowed.

const MAX_BYTES = 3_000_000;

function privateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith('::ffff:')) return privateAddress(v.slice(7));
    return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b! >= 16 && b! <= 31) || (a === 192 && b === 168) || (a === 100 && b! >= 64 && b! <= 127) || a! >= 224;
}

async function assertPublic(url: URL): Promise<void> {
  if (url.protocol !== 'https:') throw new Error('https');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
  if (!addresses.length || addresses.some(privateAddress)) throw new Error('private');
}

export async function fetchCalendar(address: string): Promise<string> {
  let url = new URL(address);
  for (let hop = 0; hop < 4; hop++) {
    await assertPublic(url);
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10_000), headers: { Accept: 'text/calendar' } });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = new URL(res.headers.get('location')!, url);
      continue;
    }
    if (!res.ok) throw new Error(`status ${res.status}`);
    const text = await res.text();
    if (text.length > MAX_BYTES) throw new Error('too big');
    if (!text.includes('BEGIN:VCALENDAR')) throw new Error('not a calendar');
    return text;
  }
  throw new Error('redirects');
}

// New events are added with estimated costs. Events already known keep the
// person's edits; only their name and date follow the calendar. Calendar
// events that disappeared are removed unless money is being set aside.
export async function syncCalendar(userId: string, address: string, today: string): Promise<{ found: number }> {
  const text = await fetchCalendar(address);
  const { from, to } = planWindow(today);
  const costing = parseIcs(text, from, to)
    .map((e) => ({ e, est: estimate(e.name, e.location) }))
    .filter((x) => x.est);
  const existing = await db.orm.public.PlanEvent.where({ userId, source: 'calendar' }).all();
  const byExt = new Map(existing.map((e) => [e.externalId, e]));
  const seen = new Set<string>();
  for (const { e, est } of costing) {
    seen.add(e.uid);
    const known = byExt.get(e.uid);
    if (known) {
      if (known.name !== e.name || known.date !== e.date) await db.orm.public.PlanEvent.where({ id: known.id, userId }).update({ name: e.name, date: e.date });
      continue;
    }
    await db.transaction(async (tx) => {
      const ev = await tx.orm.public.PlanEvent.create({ userId, date: e.date, name: e.name, tag: est!.tag, source: 'calendar', externalId: e.uid });
      await tx.orm.public.PlanItem.createAll(est!.items.map((i) => ({ ...i, eventId: ev.id, userId })));
    });
  }
  for (const old of existing) {
    if (old.externalId && !seen.has(old.externalId) && old.date >= from && !old.saveMonthly) await db.orm.public.PlanEvent.where({ id: old.id, userId }).delete();
  }
  await db.orm.public.User.where({ id: userId }).update({ calendarAt: new Date().toISOString() });
  return { found: costing.length };
}
