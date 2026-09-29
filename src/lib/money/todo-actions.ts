'use server';

import { refresh } from 'next/cache';
import { db } from '../../prisma/db';
import { cents, str } from './act';
import { isDay } from './dates';
import { getMe } from './load';

// Things to do once money lands. `when` is "now" or "<incomeId>|<payday>".
export async function addTodoAction(formData: FormData): Promise<{ error?: string }> {
  const me = await getMe();
  const text = str(formData, 'text', 140);
  if (!text) return { error: 'Write what to do.' };
  const when = str(formData, 'when', 80);
  const [incomeId, payday] = when.split('|');
  let due = me.today;
  let income: string | null = null;
  if (incomeId && payday && isDay(payday)) {
    const row = await db.orm.public.Recurring.where({ id: incomeId, userId: me.id }).first();
    if (row && row.amount > 0) {
      income = row.id;
      due = payday < me.today ? me.today : payday;
    }
  }
  await db.orm.public.Todo.create({ userId: me.id, text, amount: cents(formData, 'amount') || null, incomeId: income, due });
  refresh();
  return {};
}

export async function setTodoDoneAction(id: string, done: boolean): Promise<void> {
  const me = await getMe();
  await db.orm.public.Todo.where({ id: String(id).slice(0, 40), userId: me.id }).update({ doneAt: done ? new Date().toISOString() : null });
  refresh();
}

export async function deleteTodoAction(id: string): Promise<void> {
  const me = await getMe();
  await db.orm.public.Todo.where({ id: String(id).slice(0, 40), userId: me.id }).delete();
  refresh();
}
