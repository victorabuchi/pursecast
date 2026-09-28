// A demo account filled like the landing page film: a storm the week rent,
// car insurance and a birthday land together, Worth-It ratings, a fork to
// Austin, calendar costs and a year of repeat purchases.
// Usage: npx tsx scripts/seed-demo.ts            (creates or recreates it)
//        npx tsx scripts/seed-demo.ts --delete   (removes it)
import { db } from '../src/prisma/db';
import { hashPassword } from '../src/lib/auth/password';
import { DEFAULT_CATEGORIES } from '../src/lib/money/categories';
import { addDays, addMonths, monthOf, todayIn } from '../src/lib/money/dates';
import { rollForward } from '../src/lib/money/recurrence';

const EMAIL = 'demo@pursecast.test';
const PASSWORD = 'pursecast-demo-2026';
const TZ = 'Europe/Helsinki';

const old = await db.orm.public.User.where({ email: EMAIL }).first();
if (old) await db.orm.public.User.where({ id: old.id }).delete();
if (process.argv.includes('--delete')) {
  console.log(old ? `Deleted ${EMAIL}` : `No ${EMAIL} to delete`);
  process.exit(0);
}

const today = todayIn(TZ);
const user = await db.orm.public.User.create({ email: EMAIL, name: 'Alex Lindqvist', timezone: TZ, currency: 'EUR' });
const userId = user.id;
await db.orm.public.AuthIdentity.create({ userId, provider: 'password', subject: EMAIL, secretHash: await hashPassword(PASSWORD) });

const budgets: Record<string, number> = { Groceries: 350, 'Eating out': 90, Takeaway: 120, Coffee: 40, Transport: 70, 'Fun money': 150, Shopping: 80, Health: 30, Other: 40 };
const extra = [
  { name: 'Concerts & live', color: '#f43f5e', budget: 40 },
  { name: 'Climbing', color: '#0ea5e9', budget: 50 },
];
await db.orm.public.Category.createAll([
  ...DEFAULT_CATEGORIES.map((c, i) => ({ userId, name: c.name, kind: c.kind, budget: (budgets[c.name] ?? 0) * 100, color: c.color, position: i })),
  ...extra.map((c, i) => ({ userId, name: c.name, kind: 'flex', budget: c.budget * 100, color: c.color, position: 20 + i })),
]);
const cats = new Map((await db.orm.public.Category.where({ userId }).all()).map((c) => [c.name, c.id]));
const cat = (n: string) => cats.get(n)!;

// Next dates relative to today, so the storm always lands a few weeks out.
const nextDay = (d: number) => rollForward(`${monthOf(today)}-${String(d).padStart(2, '0')}`, 'monthly', today);
// About five weeks out, like the film's week of Nov 3 seen from late September.
const stormMonth = monthOf(addDays(today, 36));
const recurring = [
  { name: 'Salary', amount: 290000, day: 9, category: 'Income' },
  { name: 'Rent', amount: -95000, day: 3, category: 'Housing' },
  { name: 'Electricity', amount: -4500, day: 12, category: 'Bills & insurance' },
  { name: 'Phone', amount: -2500, day: 15, category: 'Bills & insurance' },
  { name: 'Spotify', amount: -1199, day: 20, category: 'Subscriptions' },
  { name: 'Netflix', amount: -1399, day: 22, category: 'Subscriptions' },
  { name: 'iCloud+', amount: -299, day: 18, category: 'Subscriptions' },
  { name: 'Gym', amount: -3900, day: 1, category: 'Subscriptions' },
  { name: 'Home insurance', amount: -1850, day: 25, category: 'Bills & insurance' },
];
for (const r of recurring) {
  await db.orm.public.Recurring.create({ userId, name: r.name, amount: r.amount, cadence: 'monthly', nextDate: nextDay(r.day), categoryId: cat(r.category) });
}
await db.orm.public.Recurring.create({ userId, name: 'Car insurance', amount: -41200, cadence: 'yearly', nextDate: `${stormMonth}-05`, categoryId: cat('Bills & insurance') });

// A year of history: the same things bought then and now, at new prices.
type E = { date: string; amount: number; note: string; category: string; mood?: 'love' | 'meh' | 'regret' };
const rows: E[] = [];
const repeat = (note: string, category: string, then: number, now: number, everyDays: number) => {
  for (let back = 450; back >= 3; back -= everyDays) {
    const date = addDays(today, -back);
    rows.push({ date, amount: -(back > 200 ? then : now), note, category });
  }
};
repeat('Oat milk', 'Groceries', 199, 229, 9);
repeat('Lidl', 'Groceries', 4200, 4700, 7);
repeat('Coffee', 'Coffee', 380, 420, 6);
repeat('HSL ticket', 'Transport', 6400, 7000, 30);
repeat('Lunch', 'Eating out', 1150, 1290, 11);
rows.push({ date: addDays(today, -380), amount: -38500, note: 'Car insurance', category: 'Bills & insurance' });

// Recent purchases, rated like the film.
const recent: Array<[number, number, string, string, E['mood']?]> = [
  [3, -6400, 'Concert', 'Concerts & live', 'love'],
  [4, -3800, 'Thai takeaway', 'Takeaway', 'regret'],
  [5, -1600, 'Climbing gym', 'Climbing', 'love'],
  [6, -1200, 'Pizza delivery', 'Takeaway', 'regret'],
  [9, -2900, 'Wolt burger', 'Takeaway', 'regret'],
  [11, -1600, 'Climbing gym', 'Climbing', 'love'],
  [13, -3400, 'Sushi takeaway', 'Takeaway', 'meh'],
  [15, -5200, 'Festival ticket', 'Concerts & live', 'love'],
  [17, -2600, 'Wolt thai', 'Takeaway', 'regret'],
  [19, -1800, 'Friday pizza', 'Takeaway', 'regret'],
  [22, -1600, 'Climbing gym', 'Climbing', 'love'],
  [24, -3100, 'Kebab delivery', 'Takeaway', 'regret'],
  [26, -2400, 'Wolt noodles', 'Takeaway', 'regret'],
  [8, -2400, 'Drinks with Sam', 'Fun money', 'love'],
  [2, -7900, 'Running shoes', 'Shopping'],
  [3, -1490, 'Movie night', 'Fun money'],
  [4, -890, 'Pharmacy', 'Health'],
  [1, -2350, 'K-Market', 'Groceries'],
  [0, -450, 'Coffee', 'Coffee'],
];
for (const [back, amount, note, category, mood] of recent) rows.push({ date: addDays(today, -back), amount, note, category, mood });

await db.orm.public.Entry.createAll(
  rows.map((r) => ({ userId, date: r.date, amount: r.amount, note: r.note, categoryId: cat(r.category), mood: r.mood ?? null, ratedAt: r.mood ? new Date().toISOString() : null })),
);

// Calendar costs.
const events: Array<{ date: string; name: string; tag: string; items: Array<[string, number]>; save?: boolean }> = [
  { date: addDays(today, 16), name: 'Dentist check-up', tag: 'Health', items: [['Dentist', 8500]] },
  { date: `${stormMonth}-07`, name: "Maya's birthday", tag: 'Gift', items: [['Gift', 6000]] },
  { date: `${stormMonth}-04`, name: 'Winter tyres', tag: 'Car', items: [['Tyres and fitting', 42000]] },
  { date: addMonths(today, 3).slice(0, 8) + '20', name: 'Flight home for the holidays', tag: 'Travel', items: [['Flights', 31000]], save: true },
  {
    date: addMonths(today, 6).slice(0, 8) + '14',
    name: "Anna & Jon's wedding · Porto",
    tag: 'Wedding',
    items: [
      ['Flights to Porto', 24000],
      ['Hotel · 2 nights', 18000],
      ['Outfit', 12000],
      ['Gift', 8000],
    ],
  },
];
for (const [i, e] of events.entries()) {
  const ev = await db.orm.public.PlanEvent.create({
    userId,
    date: e.date,
    name: e.name,
    tag: e.tag,
    source: 'calendar',
    externalId: `demo-${i}`,
    saveMonthly: e.save ? 7800 : null,
    saveFrom: e.save ? monthOf(addMonths(today, -1)) : null,
  });
  await db.orm.public.PlanItem.createAll(e.items.map(([name, amount]) => ({ eventId: ev.id, userId, name, amount })));
}

// Money owed.
const sam = await db.orm.public.Debt.create({ userId, person: 'Sam', direction: 'lent', amount: 6400, note: 'Concert ticket', dueDate: addDays(today, 5) });
await db.orm.public.Entry.create({ userId, date: addDays(today, -3), amount: -6400, note: 'Lent to Sam', debtId: sam.id });
const mom = await db.orm.public.Debt.create({ userId, person: 'Mom', direction: 'borrowed', amount: 40000, note: 'Deposit for the flat', dueDate: addMonths(today, 2) });
await db.orm.public.Entry.createAll([
  { userId, date: addDays(today, -60), amount: 40000, note: 'Borrowed from Mom', debtId: mom.id },
  { userId, date: addDays(today, -30), amount: -10000, note: 'Paid back Mom', debtId: mom.id },
]);

// A note to future you, played before takeaway.
await db.orm.public.FutureNote.create({ userId, text: "You're saving for Porto. Is this worth a night there?", categoryId: cat('Takeaway'), until: addMonths(today, 6).slice(0, 8) + '14', shown: 3, skipped: 2, saved: 6700 });

// A fork.
const fork = await db.orm.public.Fork.create({ userId, name: 'Move to Austin', oneTime: -150000, startDate: today });
await db.orm.public.ForkEffect.createAll([
  { forkId: fork.id, userId, name: 'Salary', monthly: 78000 },
  { forkId: fork.id, userId, name: 'Rent', monthly: -52000 },
  { forkId: fork.id, userId, name: 'No car loan', monthly: 13000 },
]);

// The balance is entered last so the history above does not move it.
await db.orm.public.User.where({ id: userId }).update({ balance: Number(process.env['DEMO_BALANCE'] ?? 165000), balanceSetAt: new Date().toISOString(), calendarUrl: 'https://calendar.google.com/calendar/ical/demo/basic.ics', calendarAt: new Date().toISOString() });

console.log(`Demo account ready: ${EMAIL} / ${PASSWORD}`);
process.exit(0);
