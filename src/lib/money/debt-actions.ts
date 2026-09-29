'use server';

import { db } from '../../prisma/db';
import { cents, day, done, str } from './act';
import { exact } from './format';
import { isDirection } from './debts';
import { getDebts, getMe } from './load';
import { photoChange } from './wish-icons';

const BACK = '/spending?tab=owed';

// Lending moves money out today and borrowing moves it in, unless the person
// says it did not go through their account.
export async function addDebtAction(formData: FormData) {
  const me = await getMe();
  // The form's toggle sends − for lent and + for borrowed.
  const raw = str(formData, 'direction', 10);
  const direction = raw === '+' ? 'borrowed' : raw === '-' ? 'lent' : raw;
  const person = str(formData, 'person', 60);
  const amount = cents(formData, 'amount');
  const dueDate = day(formData, 'dueDate');
  if (!isDirection(direction) || !person || !amount) done(`${BACK}&new=1`, 'Add who it is with and how much.', 'error');
  await db.transaction(async (tx) => {
    const party = str(formData, 'party', 12) === 'institution' ? 'institution' : 'person';
    const debt = await tx.orm.public.Debt.create({ userId: me.id, person, party, direction, amount, note: str(formData, 'note', 120) || null, dueDate, ...photoChange(formData) });
    if (formData.get('moved')) {
      await tx.orm.public.Entry.create({ userId: me.id, date: me.today, amount: direction === 'lent' ? -amount : amount, note: direction === 'lent' ? `Lent to ${person}` : `Borrowed from ${person}`, debtId: debt.id });
    }
  });
  done(BACK, direction === 'lent' ? `${person} owes you ${exact(amount, me.currency)}` : `You owe ${person} ${exact(amount, me.currency)}`);
}

export async function recordPaybackAction(formData: FormData) {
  const me = await getMe();
  const debt = (await getDebts(me.id)).find((d) => d.id === str(formData, 'id', 40));
  const amount = cents(formData, 'amount');
  const date = day(formData, 'date') ?? me.today;
  if (!debt || !amount) done(BACK, 'Enter how much was paid back.', 'error');
  if (amount > debt.left) done(BACK, `Only ${exact(debt.left, me.currency)} is left.`, 'error');
  if (date > me.today) done(BACK, 'Record paybacks that already happened.', 'error');
  const lent = debt.direction === 'lent';
  await db.orm.public.Entry.create({ userId: me.id, date, amount: lent ? amount : -amount, note: lent ? `${debt.person} paid back` : `Paid back ${debt.person}`, debtId: debt.id });
  if (amount === debt.left) await db.orm.public.Debt.where({ id: debt.id, userId: me.id }).update({ settledAt: new Date().toISOString() });
  done(BACK, amount === debt.left ? `All settled with ${debt.person}` : `${exact(amount, me.currency)} recorded · ${exact(debt.left - amount, me.currency)} left`);
}

export async function settleDebtAction(formData: FormData) {
  const me = await getMe();
  const row = await db.orm.public.Debt.where({ id: str(formData, 'id', 40), userId: me.id }).update({ settledAt: new Date().toISOString() });
  done(BACK, `Settled with ${row?.person ?? 'them'}`);
}

export async function reopenDebtAction(formData: FormData) {
  const me = await getMe();
  const row = await db.orm.public.Debt.where({ id: str(formData, 'id', 40), userId: me.id }).update({ settledAt: null });
  done(BACK, `${row?.person ?? 'Debt'} reopened`);
}

// Entries it created stay in Spending; they just lose the link.
export async function deleteDebtAction(formData: FormData) {
  const me = await getMe();
  const row = await db.orm.public.Debt.where({ id: str(formData, 'id', 40), userId: me.id }).delete();
  done(BACK, `${row?.person ?? 'Debt'} removed`);
}

// Fully paid is settled. A changed amount that leaves money owing reopens
// it; an unchanged amount keeps a debt marked settled by hand as it was.
function settledAfterEdit(debt: { amount: number; paid: number; settledAt: string | null }, amount: number): string | null {
  if (amount <= debt.paid) return debt.settledAt ?? new Date().toISOString();
  return amount === debt.amount ? debt.settledAt : null;
}

// Fix the name, person or institution, amount, date or note later.
export async function updateDebtAction(formData: FormData) {
  const me = await getMe();
  const debt = (await getDebts(me.id)).find((d) => d.id === str(formData, 'id', 40));
  const person = str(formData, 'person', 60);
  const amount = cents(formData, 'amount');
  if (!debt || !person || !amount) done(BACK, 'Add a name and an amount.', 'error');
  if (amount < debt.paid) done(BACK, `${exact(debt.paid, me.currency)} is already paid back, so the amount cannot be less.`, 'error');
  const party = str(formData, 'party', 12) === 'institution' ? 'institution' : 'person';
  await db.orm.public.Debt.where({ id: debt.id, userId: me.id }).update({
    person,
    party,
    amount,
    dueDate: day(formData, 'dueDate'),
    note: str(formData, 'note', 120) || null,
    settledAt: settledAfterEdit(debt, amount),
    ...photoChange(formData),
  });
  done(BACK, `${person} updated`);
}
