'use server';

import { redirect } from 'next/navigation';
import { db } from '../../prisma/db';
import { cents, day, done, str } from '../money/act';
import { recurringCategory } from '../money/categories';
import { rollForward } from '../money/recurrence';
import { exact } from '../money/format';
import { ensureCategories, getMe } from '../money/load';
import { short } from '../money/dates';
import { isStatementCategory } from './types';

export async function deleteStatementAction(formData: FormData) {
  const me = await getMe();
  const row = await db.orm.public.Statement.where({ id: str(formData, 'id', 40), userId: me.id }).delete();
  done('/statements', `${row?.name ?? 'Statement'} removed`);
}

export async function deleteTxnAction(formData: FormData) {
  const me = await getMe();
  await db.orm.public.StatementTxn.where({ id: str(formData, 'id', 40), userId: me.id }).delete();
  redirect(str(formData, 'back', 300).startsWith('/statements') ? str(formData, 'back', 300) : '/statements');
}

// A new category for this transaction and every other one at the same place.
export async function setTxnCategoryAction(formData: FormData) {
  const me = await getMe();
  const category = str(formData, 'category', 40);
  const txn = await db.orm.public.StatementTxn.where({ id: str(formData, 'id', 40), userId: me.id }).first();
  if (txn && isStatementCategory(category)) {
    await db.orm.public.StatementTxn.where({ userId: me.id, place: txn.place }).updateAll({ category });
  }
  redirect(str(formData, 'back', 300).startsWith('/statements') ? str(formData, 'back', 300) : '/statements');
}

// A charge that repeats in the statement, added as a monthly bill or
// subscription in one tap. The next date follows the last one seen.
export async function trackChargeAction(formData: FormData) {
  const me = await getMe();
  const name = str(formData, 'name', 80);
  const amount = cents(formData, 'amount');
  const last = day(formData, 'last') ?? me.today;
  if (!name || !amount) done('/statements', 'That charge could not be added.', 'error');
  const existing = await db.orm.public.Recurring.where({ userId: me.id }).all();
  if (existing.some((r) => r.name.toLowerCase() === name.toLowerCase())) done('/statements', `${name} is already tracked`);
  await ensureCategories(me.id);
  const type = str(formData, 'category', 40) === 'Subscriptions' ? 'Subscriptions' : recurringCategory(name, false);
  const cat = await db.orm.public.Category.where({ userId: me.id, name: type }).first();
  const nextDate = rollForward(last, 'monthly', me.today);
  await db.orm.public.Recurring.create({ userId: me.id, name, amount: -amount, cadence: 'monthly', nextDate, categoryId: cat?.id ?? null, variable: false });
  done('/statements', `${name} added · ${exact(amount, me.currency)} a month, next on ${short(nextDate)}`);
}
