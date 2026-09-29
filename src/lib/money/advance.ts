import { db } from '../../prisma/db';
import { exact } from './format';
import { addMonths, monthStart, short } from './dates';
import { occurrences, type Cadence } from './recurrence';
import { splitSkips } from './load';

type Row = { id: string; name: string; amount: number; cadence: string; nextDate: string; skips: string; paused: boolean; categoryId: string | null };

// Records part of a pay received early, today or on a later day. It comes
// off the first pay on or after the day it arrives. Returns an error message,
// or the payday it comes off. With keep (setup), it is always saved: without
// a pay to come off, or more than the pay, it still comes in on its day.
export async function addAdvance(userId: string, row: Row | null, amount: number, arrivesOn: string, today: string, currency: string, opts: { keep?: boolean } = {}): Promise<{ error: string } | { payday: string }> {
  const usable = row && row.amount > 0 && !row.paused ? row : null;
  if (!opts.keep) {
    if (!usable) return { error: 'Advances come from income that is not paused.' };
    if (arrivesOn < today) return { error: 'Pick today or a day ahead for when the advance arrives.' };
  }
  const skips = usable ? splitSkips(usable.skips) : [];
  const until = `${Number(arrivesOn.slice(0, 4)) + 2}-12-31`;
  const payday = (usable && occurrences(usable.nextDate, usable.cadence as Cadence, usable.nextDate, until).find((d) => d >= arrivesOn && !skips.includes(d))) || monthStart(addMonths(arrivesOn, 1));
  if (!opts.keep) {
    if (!usable || !payday) return { error: 'There is no payday after that date.' };
    const open = await db.orm.public.SalaryAdvance.where({ userId, recurringId: usable.id, payday }).where((a) => a.settledAt.isNull()).all();
    const left = usable.amount - open.reduce((s, a) => s + a.amount, 0);
    if (amount > left) return { error: `Up to ${exact(left, currency)} can come from the ${short(payday)} pay.` };
  }
  await db.transaction(async (tx) => {
    // Money that arrives today goes into the balance now; later ones on their day.
    const entry = arrivesOn <= today ? await tx.orm.public.Entry.create({ userId, date: arrivesOn, amount, note: `${usable?.name ?? 'Salary'} advance`, categoryId: usable?.categoryId ?? null }) : null;
    await tx.orm.public.SalaryAdvance.create({ userId, recurringId: usable?.id ?? null, amount, takenOn: arrivesOn, payday, entryId: entry?.id ?? null });
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
