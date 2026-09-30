import { addDays, diffDays, short } from './dates';
import { exact } from './format';

// What Pursecast tells people, in the bell, as a push notification and in
// the weekly email. Each has a stable key so it is sent once.
export type Reminder = { key: string; title: string; body: string; href: string; kind: 'todo' | 'bill' | 'debt' | 'storm' | 'pay' };

type Todo = { text: string; incomeId: string | null; due: string; doneAt: string | null; priority: number };
type Bill = { id: string; name: string; amount: number; nextDate: string; paused: boolean; variable: boolean };
type Debt = { id: string; person: string; direction: string; left: number; dueDate: string | null };
type Low = { date: string; amount: number } | null;

const list = (items: string[]) => (items.length <= 2 ? items.join(' and ') : `${items.slice(0, 2).join(', ')} and ${items.length - 2} more`);

export function buildReminders(input: { today: string; currency: string; cushion: number; todos: Todo[]; bills: Bill[]; debts: Debt[]; low?: Low }): Reminder[] {
  const { today, currency } = input;
  const m = (c: number) => exact(Math.abs(c), currency);
  const tomorrow = addDays(today, 1);
  const byId = new Map(input.bills.map((b) => [b.id, b]));
  const out: Reminder[] = [];

  // Money landed (or the day came) and things wait to be done.
  const open = input.todos.filter((t) => !t.doneAt && t.due <= today).sort((a, b) => a.priority - b.priority);
  const groups = new Map<string, Todo[]>();
  for (const t of open) groups.set(t.incomeId ?? '', [...(groups.get(t.incomeId ?? '') ?? []), t]);
  for (const [incomeId, ts] of groups) {
    const pay = incomeId ? byId.get(incomeId) : undefined;
    const n = ts.length;
    out.push({
      key: `todo:${incomeId || 'now'}:${today}`,
      kind: 'todo',
      title: pay ? `${pay.name} landed · ${n} ${n === 1 ? 'thing' : 'things'} to do` : `${n} ${n === 1 ? 'thing' : 'things'} to do today`,
      body: list(ts.map((t) => t.text)),
      href: '/plan#todo',
    });
  }

  for (const b of input.bills) {
    if (b.paused || b.nextDate !== tomorrow) continue;
    if (b.amount > 0) {
      const waiting = input.todos.filter((t) => !t.doneAt && t.incomeId === b.id).length;
      out.push({ key: `pay:${b.id}:${b.nextDate}`, kind: 'pay', title: `${b.name} lands tomorrow`, body: waiting ? `${waiting} ${waiting === 1 ? 'thing waits' : 'things wait'} for it on your list.` : `${m(b.amount)} coming in.`, href: waiting ? '/plan#todo' : '/forecast' });
    } else {
      out.push({ key: `bill:${b.id}:${b.nextDate}`, kind: 'bill', title: `${b.name} ${b.variable ? 'is due' : 'renews'} tomorrow`, body: b.amount ? `${b.variable ? 'About ' : ''}${m(b.amount)} leaves your account.` : 'The price varies; log what it costs.', href: '/spending?tab=bills' });
    }
  }

  for (const d of input.debts) {
    if (!d.dueDate || d.left <= 0) continue;
    const days = diffDays(today, d.dueDate);
    if (days < 0 || days > 3) continue;
    const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `by ${short(d.dueDate)}`;
    out.push(
      d.direction === 'borrowed'
        ? { key: `debt:${d.id}:${d.dueDate}`, kind: 'debt', title: `Pay ${d.person} back ${when}`, body: `${m(d.left)} left to pay.`, href: '/spending?tab=owed' }
        : { key: `debt:${d.id}:${d.dueDate}`, kind: 'debt', title: `${d.person} should pay you back ${when}`, body: `${m(d.left)} is still owed to you.`, href: '/spending?tab=owed' },
    );
  }

  // A storm in the next two weeks, told once for that low point.
  const low = input.low;
  if (low && low.amount < input.cushion && diffDays(today, low.date) <= 14 && low.date >= today) {
    const days = diffDays(today, low.date);
    out.push({ key: `storm:${low.date}`, kind: 'storm', title: days <= 7 ? 'Storm this week' : 'Storm next week', body: `Your balance dips to ${low.amount < 0 ? '−' : ''}${m(low.amount)} on ${short(low.date)}. See how to fix it.`, href: '/forecast' });
  }
  return out;
}
