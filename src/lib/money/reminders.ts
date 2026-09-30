import { addDays, diffDays, short } from './dates';
import { exact } from './format';

// What Pursecast tells people, in the bell, as a push notification and in
// the weekly email. Each has a stable key so it is sent once.
export type Reminder = { key: string; title: string; body: string; href: string; kind: 'todo' | 'bill' | 'debt' | 'storm' | 'pay' | 'bank' };

type Todo = { text: string; incomeId: string | null; due: string; doneAt: string | null; priority: number };
type Bill = { id: string; name: string; amount: number; nextDate: string; paused: boolean; variable: boolean };
type Debt = { id: string; person: string; direction: string; left: number; dueDate: string | null };
type Low = { date: string; amount: number } | null;

const list = (items: string[]) => (items.length <= 2 ? items.join(' and ') : `${items.slice(0, 2).join(', ')} and ${items.length - 2} more`);

export function buildReminders(input: { today: string; currency: string; cushion: number; todos: Todo[]; bills: Bill[]; debts: Debt[]; low?: Low; banks?: Array<{ id: string; name: string; validUntil: string | null }> }): Reminder[] {
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

  // A bank connection runs out within a week.
  for (const b of input.banks ?? []) {
    if (!b.validUntil) continue;
    const days = diffDays(today, b.validUntil.slice(0, 10));
    if (days < 0 || days > 7) continue;
    out.push({ key: `bank:${b.id}:${b.validUntil.slice(0, 10)}`, kind: 'bank', title: `Reconnect ${b.name}`, body: days === 0 ? 'Access ends today. Approve it again to keep your balance updating.' : `Access ends in ${days} ${days === 1 ? 'day' : 'days'}. Approve it again to keep your balance updating.`, href: '/banks?add=1' });
  }

  // A storm in the next two weeks, told once for that low point.
  const low = input.low;
  if (low && low.amount < input.cushion && diffDays(today, low.date) <= 14 && low.date >= today) {
    const days = diffDays(today, low.date);
    out.push({ key: `storm:${low.date}`, kind: 'storm', title: days <= 7 ? 'Storm this week' : 'Storm next week', body: `Your balance dips to ${low.amount < 0 ? '−' : ''}${m(low.amount)} on ${short(low.date)}. See how to fix it.`, href: '/forecast' });
  }
  return out;
}

// The Monday email: balance, the week's bills and income, what waits for
// payday, and the lowest point ahead.
export function weeklyDigest(input: {
  name: string;
  currency: string;
  today: string;
  balance: number;
  week: Array<{ date: string; name: string; amount: number }>;
  todos: string[];
  low: { date: string; amount: number };
  cushion: number;
  appUrl: string;
}): { subject: string; text: string } {
  const m = (c: number) => `${c < 0 ? '−' : ''}${exact(Math.abs(c), input.currency)}`;
  const first = input.name.split(/\s+/)[0] || 'there';
  const out = input.week.filter((w) => w.amount < 0);
  const inc = input.week.filter((w) => w.amount > 0);
  const stormy = input.low.amount < input.cushion;
  const lines = [
    `Hi ${first},`,
    '',
    `Your balance today: ${m(input.balance)}.`,
    stormy ? `Heads up: it dips to ${m(input.low.amount)} on ${short(input.low.date)}. Open Money Weather for a fix.` : `Lowest point ahead: ${m(input.low.amount)} on ${short(input.low.date)}. Clear skies.`,
    '',
    out.length ? 'This week, going out:' : 'Nothing goes out this week.',
    ...out.map((w) => `  ${short(w.date)}  ${w.name}  ${m(w.amount)}`),
    ...(inc.length ? ['', 'Coming in:', ...inc.map((w) => `  ${short(w.date)}  ${w.name}  +${m(w.amount)}`)] : []),
    ...(input.todos.length ? ['', 'Waiting for payday:', ...input.todos.slice(0, 8).map((t) => `  • ${t}`)] : []),
    '',
    `Open Pursecast: ${input.appUrl}/forecast`,
    '',
    `You get this because the Monday email is on. Turn it off in Settings: ${input.appUrl}/settings`,
  ];
  return { subject: stormy ? `Your week: storm on ${short(input.low.date)}` : `Your week: ${out.length} ${out.length === 1 ? 'bill' : 'bills'}, clear skies`, text: lines.join('\n') };
}
