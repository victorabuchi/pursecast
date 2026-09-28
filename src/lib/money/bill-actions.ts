'use server';

import { db } from '../../prisma/db';
import { cents, day, done, str } from './act';
import { monthName, short } from './dates';
import { exact } from './format';
import { occurrences, rollForward, type Cadence } from './recurrence';
import { addAdvance } from './advance';
import { getMe, splitSkips } from './load';

const BACK = '/spending?tab=bills';

async function own(userId: string, id: string) {
  return db.orm.public.Recurring.where({ id, userId }).first();
}

// Leave one date out, like a month without an electricity bill.
export async function skipOnceAction(formData: FormData) {
  const me = await getMe();
  const row = await own(me.id, str(formData, 'id', 40));
  const date = day(formData, 'date');
  if (!row || !date || date < me.today || !occurrences(row.nextDate, row.cadence as Cadence, date, date).length) done(BACK, 'That date can no longer be skipped.', 'error');
  const skips = new Set(splitSkips(row.skips));
  skips.add(date);
  await db.orm.public.Recurring.where({ id: row.id, userId: me.id }).update({ skips: [...skips].sort().join(',') });
  done(BACK, `${row.name} skipped for ${monthName(date.slice(0, 7), true)}`);
}

export async function unskipAction(formData: FormData) {
  const me = await getMe();
  const row = await own(me.id, str(formData, 'id', 40));
  const date = day(formData, 'date');
  if (!row || !date) done(BACK, 'Nothing to add back.', 'error');
  await db.orm.public.Recurring.where({ id: row.id, userId: me.id }).update({ skips: splitSkips(row.skips).filter((d) => d !== date).join(',') });
  done(BACK, `${row.name} is back for ${monthName(date.slice(0, 7), true)}`);
}

// Stop it until resumed, like a gym membership on hold.
export async function pauseAction(formData: FormData) {
  const me = await getMe();
  const row = await db.orm.public.Recurring.where({ id: str(formData, 'id', 40), userId: me.id }).update({ paused: true });
  done(BACK, `${row?.name ?? 'Item'} paused`);
}

export async function resumeAction(formData: FormData) {
  const me = await getMe();
  const row = await own(me.id, str(formData, 'id', 40));
  if (!row) done(BACK, 'That item is gone.', 'error');
  const nextDate = row.nextDate > me.today ? row.nextDate : rollForward(row.nextDate, row.cadence as Cadence, me.today);
  await db.orm.public.Recurring.where({ id: row.id, userId: me.id }).update({ paused: false, nextDate, skips: splitSkips(row.skips).filter((d) => d > me.today).join(',') });
  done(BACK, `${row.name} resumed · next ${short(nextDate)}`);
}

// Part of a pay early, now or on a later day; the same amount comes off
// the first pay after it arrives.
export async function takeAdvanceAction(formData: FormData) {
  const me = await getMe();
  const row = await own(me.id, str(formData, 'id', 40));
  const amount = cents(formData, 'amount');
  const arrivesOn = day(formData, 'date') ?? me.today;
  if (!row) done(BACK, 'That income is gone.', 'error');
  if (!amount) done(BACK, 'Enter how much the advance is.', 'error');
  const res = await addAdvance(me.id, row, amount, arrivesOn, me.today, me.currency);
  if ('error' in res) done(BACK, res.error, 'error');
  done(BACK, arrivesOn > me.today ? `${exact(amount, me.currency)} advance on ${short(arrivesOn)} · comes off your ${short(res.payday)} pay` : `${exact(amount, me.currency)} advance · comes off your ${short(res.payday)} pay`);
}

// Undo an advance entered by mistake, while it is still open.
export async function cancelAdvanceAction(formData: FormData) {
  const me = await getMe();
  const adv = await db.orm.public.SalaryAdvance.where({ id: str(formData, 'id', 40), userId: me.id }).where((a) => a.settledAt.isNull()).first();
  if (!adv) done(BACK, 'That advance is already settled.', 'error');
  await db.transaction(async (tx) => {
    if (adv.entryId) await tx.orm.public.Entry.where({ id: adv.entryId, userId: me.id }).delete();
    await tx.orm.public.SalaryAdvance.where({ id: adv.id, userId: me.id }).delete();
  });
  done(BACK, 'Advance removed');
}
