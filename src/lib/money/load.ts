import { cache } from 'react';
import { redirect } from 'next/navigation';
import { db } from '../../prisma/db';
import { requireViewer } from '../auth/viewer';
import { addDays, diffDays, monthOf, todayIn } from './dates';
import { nextAfter, type Cadence } from './recurrence';
import { DEFAULT_CATEGORIES } from './categories';
import { buildForecast, type FcBudget, type FcEvent, type Forecast } from './forecast';
import { paidBack, remaining } from './debts';
import { convert, type Rates } from './currencies';
import { photoUrl } from '../photo-url';
import { getRates } from './fx';

// Everything a signed-in page needs about the person's money, loaded once per
// request. Every query is filtered by the signed-in user's id.

export type Me = {
  id: string;
  name: string;
  email: string;
  currency: string;
  timezone: string;
  balance: number | null;
  balanceSetAt: string | null;
  cushion: number;
  calendarUrl: string | null;
  calendarAt: string | null;
  notepad: string;
  notepadAt: string | null;
  photo: string | null;
  today: string;
};

export type Cat = { id: string; name: string; kind: string; budget: number; color: string; position: number };
export type EntryRow = { id: string; date: string; amount: number; note: string; categoryId: string | null; recurringId: string | null; debtId: string | null; mood: string | null; createdAt: string; source: string | null };
export type DebtRow = { id: string; person: string; party: string; photo: string | null; direction: string; amount: number; note: string | null; dueDate: string | null; settledAt: string | null; createdAt: string; paid: number; left: number };
export type RecurringRow = {
  id: string;
  name: string;
  amount: number;
  cadence: Cadence;
  nextDate: string;
  categoryId: string | null;
  paused: boolean;
  variable: boolean;
  skips: string[];
  // Billed in another currency: the price as billed, in its cents.
  priceCurrency: string | null;
  priceAmount: number | null;
  // pending: arrives on takenOn and is not in the balance yet.
  advances: Array<{ id: string; amount: number; payday: string; takenOn: string; pending: boolean }>;
};
export type EventRow = { id: string; date: string; name: string; tag: string; source: string; hidden: boolean; saveMonthly: number | null; saveFrom: string | null; items: Array<{ id: string; name: string; amount: number }>; cost: number };

export const getMe = cache(async (): Promise<Me> => {
  const viewer = await requireViewer();
  const u = await db.orm.public.User.where({ id: viewer.id }).first();
  if (!u) redirect('/login');
  return meFrom(u);
});

// A person as the app pages see them, from their row.
type UserRow = NonNullable<Awaited<ReturnType<ReturnType<typeof db.orm.public.User.where>['first']>>>;
export function meFrom(u: UserRow): Me {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    currency: u.currency,
    timezone: u.timezone,
    balance: u.balance,
    balanceSetAt: u.balanceSetAt,
    cushion: u.cushion,
    calendarUrl: u.calendarUrl,
    calendarAt: u.calendarAt,
    notepad: u.notepad,
    notepadAt: u.notepadAt,
    photo: photoUrl('user', u.id, u.photo),
    today: todayIn(u.timezone),
  };
}

// Pages other than setup need a balance to forecast from.
export async function requireSetUp(): Promise<Me & { balance: number; balanceSetAt: string }> {
  const me = await getMe();
  if (me.balance === null || !me.balanceSetAt) redirect('/setup');
  return me as Me & { balance: number; balanceSetAt: string };
}

export async function ensureCategories(userId: string): Promise<void> {
  if (await db.orm.public.Category.where({ userId }).first()) return;
  await db.orm.public.Category.createAll(
    DEFAULT_CATEGORIES.map((c, i) => ({ userId, name: c.name, kind: c.kind, budget: 0, color: c.color, position: i })),
  );
}

export const getCategories = cache(async (userId: string): Promise<Cat[]> => {
  // One query normally; the defaults are created only the first time.
  let rows = await db.orm.public.Category.where({ userId }).orderBy((c) => c.position.asc()).all();
  if (!rows.length) {
    await ensureCategories(userId);
    rows = await db.orm.public.Category.where({ userId }).orderBy((c) => c.position.asc()).all();
  }
  return rows.map((c) => ({ id: c.id, name: c.name, kind: c.kind, budget: c.budget, color: c.color, position: c.position }));
});

// Advances whose day has come are logged as money in, once each.
// With a connected main bank account, the bank says what happened: bills,
// income and advances are not posted by Pursecast (they stay in the forecast
// until their day, and the bank's own transactions show them).
export const bankLed = cache(async (userId: string): Promise<boolean> => Boolean(await db.orm.public.BankAccount.where({ userId, role: 'main' }).first()));

export async function postDueAdvances(userId: string, today: string): Promise<void> {
  const due = await db.orm.public.SalaryAdvance.where({ userId })
    .where((a) => a.entryId.isNull())
    .where((a) => a.takenOn.lte(today))
    .all();
  const fromBank = due.length > 0 && (await bankLed(userId));
  for (const a of due) {
    // Arrived: marked on the advance itself; the bank shows the money.
    if (fromBank) {
      await db.orm.public.SalaryAdvance.where({ id: a.id, userId, entryId: null }).update({ entryId: a.id });
      continue;
    }
    const r = a.recurringId ? await db.orm.public.Recurring.where({ id: a.recurringId, userId }).first() : null;
    await db.transaction(async (tx) => {
      const entry = await tx.orm.public.Entry.create({ userId, date: a.takenOn, amount: a.amount, note: `${r?.name ?? 'Salary'} advance`, categoryId: r?.categoryId ?? null });
      const claimed = await tx.orm.public.SalaryAdvance.where({ id: a.id, userId, entryId: null }).update({ entryId: entry.id });
      if (!claimed) throw new Error('already posted');
    }).catch(() => undefined);
  }
  // An advance with no pay to come off is done once it has come in and its
  // payday has passed.
  await db.orm.public.SalaryAdvance.where({ userId, recurringId: null })
    .where((a) => a.settledAt.isNull())
    .where((a) => a.entryId.isNotNull())
    .where((a) => a.payday.lt(today))
    .updateAll({ settledAt: new Date().toISOString() });
}

// Bills and income whose date has come are logged as entries, once each, and
// move on to their next date. Skipped dates are passed over, paused items
// wait, and salary advances come off the pay they were taken from.
// Prices billed in another currency follow the latest rate, so a $25 plan
// counts as what it costs in the account currency this week.
export async function refreshForeignPrices(userId: string, currency: string): Promise<void> {
  const rows = await db.orm.public.Recurring.where({ userId }).where((r) => r.priceCurrency.isNotNull()).all();
  if (!rows.length) return;
  const rates = await getRates();
  const writes: Array<PromiseLike<unknown>> = [];
  for (const r of rows) {
    if (r.priceAmount === null || r.priceCurrency === null) continue;
    const value = convert(r.priceAmount, r.priceCurrency, currency, rates);
    if (value === null) continue;
    const amount = r.amount > 0 ? value : -value;
    if (amount !== r.amount) writes.push(db.orm.public.Recurring.where({ id: r.id, userId }).update({ amount }));
  }
  await Promise.all(writes);
}

export async function postDueRecurring(userId: string, today: string): Promise<void> {
  const due = await db.orm.public.Recurring.where({ userId, paused: false })
    .where((r) => r.nextDate.lte(today))
    .all();
  // Payments the bank already showed: a bill is not posted a second time.
  const banked = due.length ? await db.orm.public.Entry.where({ userId, source: 'bank' }).where((e) => e.date.gte(addDays(today, -70))).select('date', 'amount', 'note').all() : [];
  const inBank = (date: string, amount: number) => banked.some((b) => b.amount === amount && Math.abs(diffDays(b.date, date)) <= 3);
  const fromBank = due.length > 0 && (await bankLed(userId));
  // With a bank, a due date only passes once the bank shows the payment (same
  // name or a close amount, up to a week late), or after a week without it.
  const seenInBank = (name: string, date: string, amount: number) => {
    const word = name.toLowerCase().split(/[^\p{L}\p{N}]+/u).find((w) => w.length >= 3) ?? '';
    return banked.some((b) => {
      const d = diffDays(date, b.date);
      if (d < -3 || d > 7 || Math.sign(b.amount) !== Math.sign(amount || b.amount)) return false;
      return (word && b.note.toLowerCase().includes(word)) || (amount !== 0 && Math.abs(b.amount - amount) <= Math.abs(amount) * 0.05);
    });
  };
  for (const r of due) {
    const anchor = Number(r.nextDate.slice(8, 10));
    const skips = new Set(splitSkips(r.skips));
    const advances = r.amount > 0 ? await db.orm.public.SalaryAdvance.where({ userId, recurringId: r.id }).where((a) => a.settledAt.isNull()).all() : [];
    let date = r.nextDate;
    const rows: Array<{ userId: string; date: string; amount: number; note: string; categoryId: string | null; recurringId: string }> = [];
    const settled: string[] = [];
    for (let i = 0; i < 60 && date <= today; i++) {
      if (fromBank && !skips.has(date) && diffDays(date, today) <= 7 && !seenInBank(r.name, date, r.amount)) break;
      if (skips.has(date)) {
        skips.delete(date);
      } else if (r.variable) {
        // The real price is not known ahead; the person logs it.
      } else {
        const mine = advances.filter((a) => a.payday <= date && !settled.includes(a.id));
        const taken = mine.reduce((s, a) => s + a.amount, 0);
        settled.push(...mine.map((a) => a.id));
        if (!inBank(date, r.amount - taken)) rows.push({ userId, date, amount: r.amount - taken, note: taken ? `${r.name} (advance taken off)` : r.name, categoryId: r.categoryId, recurringId: r.id });
      }
      date = nextAfter(date, r.cadence as Cadence, anchor);
    }
    if (date === r.nextDate) continue;
    // Moving the date first means a second request running at the same time
    // finds nothing due and posts nothing.
    const moved = await db.orm.public.Recurring.where({ id: r.id, nextDate: r.nextDate }).update({ nextDate: date, skips: [...skips].join(',') });
    if (!moved) continue;
    if (rows.length && !fromBank) await db.orm.public.Entry.createAll(rows);
    for (const id of settled) await db.orm.public.SalaryAdvance.where({ id, userId }).update({ settledAt: new Date().toISOString() });
  }
}

export type AccountRow = { id: string; name: string; kind: string; currency: string; balance: number; inForecast: boolean; updatedAt: string; value: number };

export const getAccounts = cache(async (userId: string) =>
  db.orm.public.Account.where({ userId }).orderBy([(a) => a.position.asc(), (a) => a.createdAt.asc()]).select('id', 'name', 'kind', 'currency', 'balance', 'inForecast', 'updatedAt').all(),
);

export type AdvanceRow = { id: string; recurringId: string | null; amount: number; payday: string; takenOn: string; pending: boolean };

// Every advance not yet taken off a pay, whichever pay (or none) it belongs to.
export const getAdvances = cache(async (userId: string): Promise<AdvanceRow[]> => {
  const rows = await db.orm.public.SalaryAdvance.where({ userId }).where((a) => a.settledAt.isNull()).orderBy((a) => a.takenOn.asc()).all();
  return rows.map((a) => ({ id: a.id, recurringId: a.recurringId, amount: a.amount, payday: a.payday, takenOn: a.takenOn, pending: !a.entryId }));
});

export const getRecurring = cache(async (userId: string): Promise<RecurringRow[]> => {
  const [rows, advances] = await Promise.all([
    db.orm.public.Recurring.where({ userId }).orderBy((r) => r.nextDate.asc()).all(),
    db.orm.public.SalaryAdvance.where({ userId }).where((a) => a.settledAt.isNull()).all(),
  ]);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    amount: r.amount,
    cadence: r.cadence as Cadence,
    nextDate: r.nextDate,
    categoryId: r.categoryId,
    paused: r.paused,
    variable: r.variable,
    skips: splitSkips(r.skips),
    priceCurrency: r.priceCurrency,
    priceAmount: r.priceAmount,
    advances: advances.filter((a) => a.recurringId === r.id).map((a) => ({ id: a.id, amount: a.amount, payday: a.payday, takenOn: a.takenOn, pending: !a.entryId })),
  }));
});

export const splitSkips = (s: string) => s.split(',').filter(Boolean);

// Entries from `since` on, newest first.
export const getEntries = cache(async (userId: string, since: string): Promise<EntryRow[]> => {
  const rows = await db.orm.public.Entry.where({ userId })
    .where((e) => e.date.gte(since))
    .orderBy([(e) => e.date.desc(), (e) => e.createdAt.desc()])
    .all();
  return rows.map((e) => ({ id: e.id, date: e.date, amount: e.amount, note: e.note, categoryId: e.categoryId, recurringId: e.recurringId, debtId: e.debtId, mood: e.mood, createdAt: e.createdAt, source: e.source }));
});

// The account balance now: what was entered plus everything logged since.
export const getBalance = cache(async (me: Me): Promise<number> => {
  if (me.balance === null || !me.balanceSetAt) return 0;
  const since = me.balanceSetAt;
  const res = await db.orm.public.Entry.where({ userId: me.id })
    .where((e) => e.createdAt.gt(since))
    .aggregate((a) => ({ total: a.sum('amount') }));
  return me.balance + Number(res.total ?? 0);
});

export const getEvents = cache(async (userId: string, from: string): Promise<EventRow[]> => {
  const events = await db.orm.public.PlanEvent.where({ userId })
    .where((e) => e.date.gte(from))
    .orderBy((e) => e.date.asc())
    .all();
  const items = events.length ? await db.orm.public.PlanItem.where({ userId }).where((i) => i.eventId.in(events.map((e) => e.id))).all() : [];
  return events.map((e) => {
    const mine = items.filter((i) => i.eventId === e.id).map((i) => ({ id: i.id, name: i.name, amount: i.amount }));
    return { id: e.id, date: e.date, name: e.name, tag: e.tag, source: e.source, hidden: e.hidden, saveMonthly: e.saveMonthly, saveFrom: e.saveFrom, items: mine, cost: mine.reduce((s, i) => s + i.amount, 0) };
  });
});

// This month's cuts per budget, from Money Weather fixes.
export const getCuts = cache(async (userId: string, fromMonth: string): Promise<Map<string, Record<string, number>>> => {
  const moves = await db.orm.public.BudgetMove.where({ userId })
    .where((m) => m.month.gte(fromMonth))
    .all();
  const out = new Map<string, Record<string, number>>();
  for (const m of moves) {
    if (!m.month) continue;
    const rec = out.get(m.fromCategoryId) ?? {};
    rec[m.month] = (rec[m.month] ?? 0) + m.amount;
    out.set(m.fromCategoryId, rec);
  }
  return out;
});

// Debts with what was paid back, from all of their entries.
export const getDebts = cache(async (userId: string): Promise<DebtRow[]> => {
  const debts = await db.orm.public.Debt.where({ userId }).orderBy((d) => d.createdAt.desc()).all();
  if (!debts.length) return [];
  const paybacks = await db.orm.public.Entry.where({ userId })
    .where((e) => e.debtId.in(debts.map((d) => d.id)))
    .all();
  return debts.map((d) => {
    const paid = paidBack(d, paybacks);
    return { id: d.id, person: d.person, party: d.party, photo: photoUrl('debt', d.id, d.photo), direction: d.direction, amount: d.amount, note: d.note, dueDate: d.dueDate, settledAt: d.settledAt, createdAt: d.createdAt, paid, left: remaining(d, paid) };
  });
});

// Recurring items as the forecast wants them: paused ones left out, and
// advances that have not arrived yet coming in on their day.
export function forForecast(rows: RecurringRow[], advances: AdvanceRow[] = [], today = '0000-00-00') {
  const live = rows.filter((r) => !r.paused);
  const ids = new Set(live.map((r) => r.id));
  // Advances with no pay (or a paused one) still come in on their day.
  const loose = advances.filter((a) => a.pending && !(a.recurringId && ids.has(a.recurringId)));
  return [
    ...live.map((r) => ({ ...r, nextDate: r.nextDate < today ? today : r.nextDate, advances: r.advances.map((a) => ({ payday: a.payday, amount: a.amount, arrivesOn: a.pending ? a.takenOn : undefined })) })),
    ...(loose.length ? [{ id: 'advances', name: 'Salary', amount: 0, cadence: 'monthly' as Cadence, nextDate: '9999-12-01', advances: loose.map((a) => ({ payday: '9999-12-01', amount: a.amount, arrivesOn: a.takenOn })) }] : []),
  ];
}

export type Money = {
  me: Me & { balance: number; balanceSetAt: string };
  cats: Cat[];
  recurring: RecurringRow[];
  entries: EntryRow[];
  events: EventRow[];
  debts: DebtRow[];
  budgets: FcBudget[];
  balance: number;
  forecast: Forecast;
  rates: Rates;
  advances: AdvanceRow[];
  // The main account alone, and the other accounts with their value in the
  // main currency. balance above is main plus the ones that count.
  mainBalance: number;
  // The bank the main balance comes from, when one is connected.
  mainName: string;
  accounts: AccountRow[];
};

// The shared load for app pages: posts due bills, then builds the forecast.
export async function loadMoney(days = 91, historyDays = 460): Promise<Money> {
  return moneyFor(await requireSetUp(), days, historyDays);
}

// The same for any set-up person, signed in or not (reminders run on a timer).
export async function moneyFor(me: Me & { balance: number; balanceSetAt: string }, days = 91, historyDays = 460): Promise<Money> {
  await refreshForeignPrices(me.id, me.currency);
  await Promise.all([postDueAdvances(me.id, me.today), postDueRecurring(me.id, me.today)]);
  const [cats, recurring, entries, events, cuts, mainBalance, debts, rates, advances, accountRows] = await Promise.all([
    getCategories(me.id),
    getRecurring(me.id),
    getEntries(me.id, addDays(me.today, -historyDays)),
    getEvents(me.id, addDays(me.today, -31)),
    getCuts(me.id, monthOf(me.today)),
    getBalance(me),
    getDebts(me.id),
    getRates(),
    getAdvances(me.id),
    getAccounts(me.id),
  ]);
  const mainBank = await db.orm.public.BankAccount.where({ userId: me.id, role: 'main' }).first();
  const mainName = mainBank ? ((await db.orm.public.BankLink.where({ id: mainBank.linkId, userId: me.id }).first())?.aspspName ?? 'Main') : 'Main';
  const accounts = accountRows.map((a) => ({ ...a, value: convert(a.balance, a.currency, me.currency, rates) ?? 0 }));
  const balance = mainBalance + accounts.filter((a) => a.inForecast).reduce((s, a) => s + a.value, 0);
  const month = monthOf(me.today);
  const budgets: FcBudget[] = cats
    .filter((c) => c.kind === 'flex')
    .map((c) => ({
      id: c.id,
      name: c.name,
      budget: c.budget,
      spent: -entries.filter((e) => e.categoryId === c.id && e.amount < 0 && monthOf(e.date) === month).reduce((s, e) => s + e.amount, 0),
      cuts: cuts.get(c.id) ?? {},
    }));
  const fcEvents: FcEvent[] = events.filter((e) => !e.hidden && e.cost > 0).map((e) => ({ id: e.id, name: e.name, date: e.date, cost: e.cost, saveMonthly: e.saveMonthly, saveFrom: e.saveFrom, source: e.source }));
  const fcDebts = debts.filter((d) => d.direction === 'borrowed' && d.left > 0 && d.dueDate).map((d) => ({ id: d.id, person: d.person, remaining: d.left, dueDate: d.dueDate! }));
  const forecast = buildForecast({ today: me.today, balance, cushion: me.cushion, recurring: forForecast(recurring, advances, me.today), budgets, events: fcEvents, debts: fcDebts, days });
  return { me, cats, recurring, entries, events, debts, budgets, balance, forecast, rates, advances, mainBalance, mainName, accounts };
}
