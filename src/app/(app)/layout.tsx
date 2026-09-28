import AppShell, { type BellItem } from '../../components/app/AppShell';
import type { PaletteItem } from '../../components/app/Palette';
import { db } from '../../prisma/db';
import { addDays, short } from '../../lib/money/dates';
import { exact, money } from '../../lib/money/format';
import { RATE_AFTER_DAYS } from '../../lib/money/worth';
import { getCategories, getMe } from '../../lib/money/load';

// Signed-in pages share the app frame. The bell lists purchases ready for a
// Worth-It rating; the palette searches pages and the person's own records.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  const cats = await getCategories(me.id);
  const catById = new Map(cats.map((c) => [c.id, c]));
  const recent = await db.orm.public.Entry.where({ userId: me.id })
    .where((e) => e.date.gte(addDays(me.today, -60)))
    .orderBy([(e) => e.date.desc(), (e) => e.createdAt.desc()])
    .limit(200)
    .all();

  const readyBy = addDays(me.today, -RATE_AFTER_DAYS);
  const bell: BellItem[] = recent
    .filter((e) => e.amount < 0 && !e.mood && !e.debtId && e.date <= readyBy && e.date >= addDays(me.today, -30) && (!e.categoryId || catById.get(e.categoryId)?.kind === 'flex'))
    .slice(0, 5)
    .map((e) => ({ id: e.id, note: e.note, amount: e.amount, date: e.date, category: e.categoryId ? (catById.get(e.categoryId)?.name ?? null) : null }));

  const [forks, events, debts, notes] = await Promise.all([
    db.orm.public.Fork.where({ userId: me.id }).all(),
    db.orm.public.PlanEvent.where({ userId: me.id, hidden: false })
      .where((e) => e.date.gte(me.today))
      .all(),
    db.orm.public.Debt.where({ userId: me.id }).where((d) => d.settledAt.isNull()).all(),
    db.orm.public.FutureNote.where({ userId: me.id }).select('id', 'text').all(),
  ]);

  const palette: PaletteItem[] = [
    { group: 'Go to', label: 'Money Weather', hint: 'Forecast for the next 90 days', href: '/forecast' },
    { group: 'Go to', label: 'Spending', hint: 'Everything you logged', href: '/spending' },
    { group: 'Go to', label: 'Worth-It', hint: 'Joy per euro', href: '/worth-it' },
    { group: 'Go to', label: 'Timeline Forks', hint: 'What if…', href: '/forks' },
    { group: 'Go to', label: 'Plan ahead', hint: 'Costs on your calendar', href: '/plan' },
    { group: 'Go to', label: 'Bills and income', href: '/spending?tab=bills' },
    { group: 'Go to', label: 'Subscriptions', hint: 'Bills and income', href: '/spending?tab=bills' },
    { group: 'Go to', label: 'Money owed', hint: 'Lent and borrowed', href: '/spending?tab=owed' },
    { group: 'Go to', label: 'Future-self notes', href: '/worth-it' },
    { group: 'Go to', label: 'Budgets', href: '/spending?tab=budgets' },
    { group: 'Go to', label: 'Settings', href: '/settings' },
    { group: 'Go to', label: 'Edit setup', hint: 'Balance, pay, bills, subscriptions, budgets', href: '/setup' },
    { group: 'Do', label: 'Log an expense', hint: 'Like "12.50 lunch"', href: '/spending?add=1' },
    { group: 'Do', label: 'New fork', hint: 'Try a decision before you make it', href: '/forks?new=1' },
    { group: 'Do', label: 'Add a planned cost', href: '/plan?new=1' },
    { group: 'Do', label: 'Add a bill or income', href: '/spending?tab=bills&new=1' },
    { group: 'Do', label: 'Add a salary advance', hint: 'Part of your pay early', href: '/spending?tab=bills&advance=1' },
    { group: 'Do', label: 'Add money owed', hint: 'Lent or borrowed', href: '/spending?tab=owed&new=1' },
    { group: 'Do', label: 'Write a note to future me', href: '/worth-it?note=1' },
    { group: 'Do', label: 'Update my balance', href: '/forecast?balance=1' },
    ...recent.slice(0, 80).map((e) => ({
      group: 'Spending',
      label: e.note,
      hint: `${exact(e.amount, me.currency)} · ${short(e.date)}${e.categoryId && catById.get(e.categoryId) ? ` · ${catById.get(e.categoryId)!.name}` : ''}`,
      href: `/spending?month=${e.date.slice(0, 7)}`,
    })),
    ...debts.map((d) => ({ group: 'Owed', label: d.person, hint: `${d.direction === 'lent' ? 'Owes you' : 'You owe'} ${exact(d.amount, me.currency)}${d.dueDate ? ` · due ${short(d.dueDate)}` : ''}`, href: '/spending?tab=owed' })),
    ...notes.map((n) => ({ group: 'Notes', label: n.text, href: '/worth-it' })),
    ...forks.map((f) => ({ group: 'Forks', label: f.name, hint: `Since ${short(f.startDate)}`, href: '/forks' })),
    ...events.map((e) => ({ group: 'Plan', label: e.name, hint: short(e.date), href: `/plan?event=${e.id}` })),
    ...cats.map((c) => ({ group: 'Categories', label: c.name, hint: c.kind === 'flex' ? `${money(c.budget, me.currency)} a month` : c.kind === 'income' ? 'Income' : 'Bills', href: '/spending?tab=budgets' })),
  ];

  return (
    <AppShell name={me.name} email={me.email} currency={me.currency} today={me.today} bell={bell} palette={palette} notepad={me.notepad} notepadAt={me.notepadAt}>
      {children}
    </AppShell>
  );
}
