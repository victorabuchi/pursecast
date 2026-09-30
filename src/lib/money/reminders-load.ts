import { db } from '../../prisma/db';
import { getDebts, getRecurring, type Me } from './load';
import { buildReminders, type Reminder } from './reminders';

// Reminders for one person. The storm needs the forecast, so callers that
// have one pass its low point.
export async function remindersFor(me: Me, low?: { date: string; amount: number } | null): Promise<Reminder[]> {
  const [todos, bills, debts] = await Promise.all([
    db.orm.public.Todo.where({ userId: me.id }).where((t) => t.doneAt.isNull()).all(),
    getRecurring(me.id),
    getDebts(me.id),
  ]);
  return buildReminders({
    today: me.today,
    currency: me.currency,
    cushion: me.cushion,
    todos: todos.map((t) => ({ text: t.text, incomeId: t.incomeId, due: t.due, doneAt: t.doneAt, priority: t.priority })),
    bills: bills.map((b) => ({ id: b.id, name: b.name, amount: b.amount, nextDate: b.nextDate, paused: b.paused, variable: b.variable })),
    debts: debts.filter((d) => !d.settledAt).map((d) => ({ id: d.id, person: d.person, direction: d.direction, left: d.left, dueDate: d.dueDate })),
    low,
  });
}
