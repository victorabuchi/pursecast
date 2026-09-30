'use server';

import { refresh } from 'next/cache';
import { db } from '../../prisma/db';
import { cents, day, str } from './act';
import { isDay } from './dates';
import { getMe } from './load';

// Things to do once money lands. `when` is "now", "date|<day>" (this weekend,
// next month), "pick" with a `date` field, or "<incomeId>|<payday>".
export async function addTodoAction(formData: FormData): Promise<{ error?: string }> {
  const me = await getMe();
  const text = str(formData, 'text', 140);
  if (!text) return { error: 'Write what to do.' };
  const when = str(formData, 'when', 80);
  const [head, tail] = when.split('|');
  let due = me.today;
  let incomeId: string | null = null;
  if (when === 'pick') {
    const picked = day(formData, 'date');
    if (!picked) return { error: 'Pick a date.' };
    due = picked;
  } else if (head === 'date' && tail && isDay(tail)) {
    due = tail;
  } else if (head && tail && isDay(tail)) {
    const row = await db.orm.public.Recurring.where({ id: head, userId: me.id }).first();
    if (row && row.amount > 0) {
      incomeId = row.id;
      due = tail;
    }
  }
  if (due < me.today) due = me.today;
  const priority = Math.min(3, Math.max(1, Number(str(formData, 'priority', 1)) || 2));
  await db.orm.public.Todo.create({ userId: me.id, text, amount: cents(formData, 'amount') || null, incomeId, due, priority });
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
