import { db } from '../../prisma/db';
import { exact } from './format';
import { short } from './dates';
import { occurrences, type Cadence } from './recurrence';
import { splitSkips } from './load';

type Row = { id: string; name: string; amount: number; cadence: string; nextDate: string; skips: string; paused: boolean; categoryId: string | null };

// Records part of a pay received early, today or on a later day. It comes
// off the first pay on or after the day it arrives. Returns an error message,
// or the payday it comes off.
export async function addAdvance(userId: string, row: Row, amount: number, arrivesOn: string, today: string, currency: string): Promise<{ error: string } | { payday: string }> {
  if (row.amount <= 0 || row.paused) return { error: 'Advances come from income that is not paused.' };
  if (arrivesOn < today) return { error: 'Pick today or a day ahead for when the advance arrives.' };
  const skips = splitSkips(row.skips);
  const until = `${Number(arrivesOn.slice(0, 4)) + 2}-12-31`;
  const payday = occurrences(row.nextDate, row.cadence as Cadence, row.nextDate, until).find((d) => d >= arrivesOn && !skips.includes(d));
  if (!payday) return { error: 'There is no payday after that date.' };
  const open = await db.orm.public.SalaryAdvance.where({ userId, recurringId: row.id, payday }).where((a) => a.settledAt.isNull()).all();
  const left = row.amount - open.reduce((s, a) => s + a.amount, 0);
  if (amount > left) return { error: `Up to ${exact(left, currency)} can come from the ${short(payday)} pay.` };
  await db.transaction(async (tx) => {
    // Money that arrives today goes into the balance now; later ones on their day.
    const entry = arrivesOn <= today ? await tx.orm.public.Entry.create({ userId, date: arrivesOn, amount, note: `${row.name} advance`, categoryId: row.categoryId }) : null;
    await tx.orm.public.SalaryAdvance.create({ userId, recurringId: row.id, amount, takenOn: arrivesOn, payday, entryId: entry?.id ?? null });
  });
  return { payday };
}

// Takes back an advance that has not come off a pay yet, with the money it
// brought in.
export async function removeAdvance(userId: string, id: string): Promise<boolean> {
  const adv = await db.orm.public.SalaryAdvance.where({ id, userId }).where((a) => a.settledAt.isNull()).first();
  if (!adv) return false;
  await db.transaction(async (tx) => {
    if (adv.entryId) await tx.orm.public.Entry.where({ id: adv.entryId, userId }).delete();
    await tx.orm.public.SalaryAdvance.where({ id: adv.id, userId }).delete();
  });
  return true;
}
