import styles from '../../../components/app/app.module.css';
import I from '../../../components/app/Icon';
import TodoBoard, { type TodoGroup, type TodoOption } from '../../../components/app/TodoBoard';
import { db } from '../../../prisma/db';
import type { Me, RecurringRow } from '../../../lib/money/load';
import { addDays, diffDays, short } from '../../../lib/money/dates';

// Done tasks stay visible (ticked) for a few days, then drop off.
const KEEP_DONE_DAYS = 3;

// "When money lands": things to do once a pay arrives, on Plan ahead.
export default async function MoneyLands({ me, recurring }: { me: Me; recurring: RecurringRow[] }) {
  const since = addDays(me.today, -KEEP_DONE_DAYS);
  const todos = (await db.orm.public.Todo.where({ userId: me.id }).orderBy((t) => t.createdAt.asc()).all()).filter((t) => !t.doneAt || t.doneAt.slice(0, 10) >= since);
  const incomes = recurring.filter((r) => r.amount > 0 && !r.paused);
  const byId = new Map(recurring.map((r) => [r.id, r]));

  const groups = new Map<string, TodoGroup & { due: string }>();
  for (const t of todos) {
    const income = t.incomeId ? byId.get(t.incomeId) : undefined;
    const key = income ? `${income.id}|${t.due}` : 'now';
    let g = groups.get(key);
    if (!g) {
      const landed = t.due <= me.today;
      const name = income?.name ?? 'Money in';
      const days = diffDays(me.today, t.due);
      g = income
        ? {
            key,
            due: t.due,
            landed,
            pay: income.amount,
            title: landed ? `${name} is in` : `When ${name} lands`,
            sub: landed ? `Landed ${short(t.due)} · time to do these` : `${short(t.due)} · ${days === 1 ? 'tomorrow' : `in ${days} days`}`,
            items: [],
          }
        : { key, due: '', landed: true, pay: null, title: 'Right now', sub: 'Money that is already here', items: [] };
      groups.set(key, g);
    }
    g.items.push({ id: t.id, text: t.text, amount: t.amount, done: Boolean(t.doneAt) });
  }
  // Money that has landed first, then the next paydays in order.
  const list = [...groups.values()].sort((a, b) => Number(b.landed) - Number(a.landed) || a.due.localeCompare(b.due));

  const options: TodoOption[] = [
    ...incomes.map((r) => ({ value: `${r.id}|${r.nextDate}`, label: `When ${r.name} lands · ${short(r.nextDate)}` })),
    { value: 'now', label: 'Right now' },
  ];
  const waiting = list.filter((g) => !g.landed).reduce((s, g) => s + g.items.filter((i) => !i.done).length, 0);

  return (
    <section id="todo" className={styles.card} style={{ scrollMarginTop: 80 }} aria-label="When money lands">
      <div className={styles.cardHead}>
        <span>
          <strong className={styles.cardTitle}>
            <I d="wallet" size={16} /> When money lands
          </strong>
          <span className={styles.cardSub} style={{ display: 'block' }}>
            A to-do list for payday. {waiting ? `${waiting} waiting · ` : ''}
            {incomes[0] ? `Next pay ${short(incomes[0].nextDate)}` : 'Add your pay in setup to plan for it.'}
          </span>
        </span>
      </div>
      <TodoBoard groups={list} options={options} currency={me.currency} />
    </section>
  );
}
