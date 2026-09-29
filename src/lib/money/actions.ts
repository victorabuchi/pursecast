'use server';

import { redirect } from 'next/navigation';
import { db } from '../../prisma/db';
import { getRates } from './fx';
import { priced } from './price';
import { backTo, cents, day, done, str } from './act';
import { addMonths, monthOf, monthStart, short } from './dates';
import { exact, money } from './format';
import { CADENCES, isCadence, rollForward, type Cadence } from './recurrence';
import { guessCategory, isKind, parseQuick, recurringCategory } from './categories';
import { buildForecast, spreadCut } from './forecast';
import { isMood } from './worth';
import { noteFor, pauseFor } from './notes';
import { estimate } from './plan';
import { addAdvance, removeAdvance } from './advance';
import { ensureCategories, forForecast, getDebts, getMe, loadMoney } from './load';

const CURRENCIES = new Set(['EUR', 'USD', 'GBP', 'SEK', 'NOK', 'DKK', 'CHF', 'PLN', 'CAD', 'AUD', 'NGN', 'INR', 'JPY']);

/* ---------- Setup ---------- */

// First-run setup, and the same page opened again later to change things.
// Rows that came with an id are updated, new rows are added, and ids the page
// listed but did not send back were removed by the person.
//
// Kept fast on purpose: everything is read in one parallel round, rows that
// did not change are skipped, and all writes then go out together.
export async function completeSetupAction(formData: FormData) {
  const me = await getMe();
  const editing = me.balance !== null;
  const balance = cents(formData, 'balance');
  const negative = str(formData, 'balanceSign') === '-';
  if (balance === null) done('/setup', 'Enter the money in your account today.', 'error');
  const currency = CURRENCIES.has(str(formData, 'currency')) ? str(formData, 'currency') : me.currency;
  const ids = (name: string) => str(formData, name, 4000).split(',').filter(Boolean);

  await ensureCategories(me.id);
  const [cats, existing, debtsBefore, openAdvances, rates] = await Promise.all([
    db.orm.public.Category.where({ userId: me.id }).all(),
    editing ? db.orm.public.Recurring.where({ userId: me.id }).all() : Promise.resolve([]),
    editing ? getDebts(me.id) : Promise.resolve([]),
    editing ? db.orm.public.SalaryAdvance.where({ userId: me.id }).where((a) => a.settledAt.isNull()).all() : Promise.resolve([]),
    getRates(),
  ]);
  const byName = new Map(cats.map((c) => [c.name, c.id]));
  const writes: Array<PromiseLike<unknown>> = [applyBudgetRows(me.id, formData, cats)];

  // Bills, subscriptions, pay and rent.
  const nextDate = (date: string, cadence: Cadence) => (date > me.today ? date : rollForward(date, cadence, me.today));
  const kept = new Set<string>();
  const creates: Array<{ userId: string; name: string; amount: number; cadence: string; nextDate: string; categoryId: string | null; variable: boolean; priceCurrency: string | null; priceAmount: number | null }> = [];
  // A row with no price or no date is saved as "varies": a date defaults to
  // the 1st of next month and nothing is posted automatically.
  const firstNext = monthStart(addMonths(me.today, 1));
  const save = (id: string, r: { name: string; amount: number; cadence: Cadence; date: string | null; category: string; variable?: boolean; priceCurrency?: string | null; priceAmount?: number | null }) => {
    const price = { priceCurrency: r.priceCurrency ?? null, priceAmount: r.priceAmount ?? null };
    const row = id ? existing.find((x) => x.id === id) : undefined;
    const variable = r.variable ?? (!r.amount || !r.date);
    if (row) {
      kept.add(row.id);
      const next = { name: r.name, amount: r.amount, cadence: r.cadence, nextDate: r.date ? nextDate(r.date, r.cadence) : row.nextDate, variable, ...price };
      if (next.name !== row.name || next.amount !== row.amount || next.cadence !== row.cadence || next.nextDate !== row.nextDate || next.variable !== row.variable || next.priceCurrency !== row.priceCurrency || next.priceAmount !== row.priceAmount) {
        writes.push(db.orm.public.Recurring.where({ id: row.id, userId: me.id }).update(next));
      }
    } else {
      creates.push({ userId: me.id, name: r.name, amount: r.amount, cadence: r.cadence, nextDate: nextDate(r.date ?? firstNext, r.cadence), categoryId: byName.get(r.category) ?? null, variable, ...price });
    }
  };
  const salary = cents(formData, 'salary');
  // Pay without a date still counts: it defaults to the 1st of next month.
  if (salary) save(str(formData, 'salaryId', 40), { name: str(formData, 'salaryName', 80) || 'Salary', amount: salary, cadence: 'monthly', date: day(formData, 'salaryDate') ?? firstNext, category: 'Income', variable: false });
  const rent = cents(formData, 'rent');
  if (rent) save(str(formData, 'rentId', 40), { name: str(formData, 'rentName', 80) || 'Rent', amount: -rent, cadence: 'monthly', date: day(formData, 'rentDate') ?? firstNext, category: 'Housing', variable: false });
  for (const [prefix, fixed] of [['bill', null], ['sub', 'Subscriptions']] as const) {
    for (let i = 0; i < 40; i++) {
      const name = str(formData, `${prefix}Name${i}`, 80);
      const amount = cents(formData, `${prefix}Amount${i}`);
      const cadence = str(formData, `${prefix}Cadence${i}`, 12);
      if (!name) continue;
      const p = priced(amount ?? 0, str(formData, `${prefix}Amount${i}Currency`, 3), currency, rates);
      save(str(formData, `${prefix}Id${i}`, 40), { name, amount: -p.amount, priceCurrency: p.priceCurrency, priceAmount: p.priceAmount, cadence: isCadence(cadence) ? cadence : 'monthly', date: day(formData, `${prefix}Date${i}`), category: fixed ?? recurringCategory(name, false) });
    }
  }
  if (creates.length) writes.push(db.orm.public.Recurring.createAll(creates));
  const gone = ids('shownRecurring').filter((id) => !kept.has(id));
  if (gone.length) writes.push(db.orm.public.Recurring.where({ userId: me.id }).where((r) => r.id.in(gone)).deleteAll());

  // The balance restarts only when it was changed; otherwise what was logged
  // since keeps counting.
  const typed = negative ? -balance : balance;
  if (!editing || String(typed) !== str(formData, 'balanceWas', 20)) {
    writes.push(db.orm.public.User.where({ id: me.id }).update({ balance: typed, balanceSetAt: new Date().toISOString(), currency }));
  } else if (currency !== me.currency) {
    writes.push(db.orm.public.User.where({ id: me.id }).update({ currency }));
  }

  // Money you owe (owed rows) and money owed to you (lent rows). It is
  // already part of the balance, so nothing moves today. Dated debts you owe
  // count in the forecast; money owed to you counts once it is paid back.
  const keptDebts = new Set<string>();
  const newDebts: Array<{ userId: string; person: string; party: string; direction: string; amount: number; dueDate: string | null }> = [];
  for (const [prefix, direction] of [['owed', 'borrowed'], ['lent', 'lent']] as const) {
    for (let i = 0; i < 30; i++) {
      const person = str(formData, `${prefix}Who${i}`, 60);
      const amount = cents(formData, `${prefix}Amount${i}`);
      if (!person || !amount) continue;
      const party = str(formData, `${prefix}Party${i}`, 12) === 'institution' ? 'institution' : 'person';
      const due = day(formData, `${prefix}Date${i}`);
      const dueDate = due && due > me.today ? due : null;
      const id = str(formData, `${prefix}Id${i}`, 40);
      const was = id ? debtsBefore.find((d) => d.id === id) : undefined;
      if (was) {
        keptDebts.add(was.id);
        // The page shows what is left; paybacks so far are added back.
        const next = { person, party, amount: amount + was.paid, dueDate };
        if (next.person !== was.person || next.party !== was.party || next.amount !== was.amount || next.dueDate !== was.dueDate) {
          writes.push(db.orm.public.Debt.where({ id: was.id, userId: me.id }).update(next));
        }
      } else {
        newDebts.push({ userId: me.id, person, party, direction, amount, dueDate });
      }
    }
  }
  if (newDebts.length) writes.push(db.orm.public.Debt.createAll(newDebts));
  const goneDebts = ids('shownDebts').filter((id) => !keptDebts.has(id));
  if (goneDebts.length) writes.push(db.orm.public.Debt.where({ userId: me.id }).where((d) => d.id.in(goneDebts)).deleteAll());

  await Promise.all(writes);

  // Salary advances, only when they changed. They come after the rest so a
  // new pay exists and the balance is set before money arriving today.
  const advRows: Array<{ id: string; amount: number; date: string }> = [];
  for (let i = 0; i < 12; i++) {
    const amount = cents(formData, `advAmount${i}`);
    if (amount) advRows.push({ id: str(formData, `advId${i}`, 40), amount, date: day(formData, `advDate${i}`) ?? me.today });
  }
  const sentIds = new Set(advRows.map((a) => a.id).filter(Boolean));
  const removed = ids('shownAdvances').filter((id) => !sentIds.has(id));
  const changed = advRows.filter((a) => {
    const was = openAdvances.find((x) => x.id === a.id);
    return !was || was.amount !== a.amount || was.takenOn !== a.date;
  });
  // An advance never stops the save.
  if (changed.length || removed.length) {
    await Promise.all([...removed, ...changed.filter((a) => a.id).map((a) => a.id)].map((id) => removeAdvance(me.id, id)));
    const pay = changed.length
      ? await db.orm.public.Recurring.where({ userId: me.id, paused: false })
          .where((r) => r.amount.gt(0))
          .orderBy((r) => r.createdAt.asc())
          .first()
      : null;
    // Always kept, pay or no pay, so it is there next time setup opens.
    for (const a of changed) await addAdvance(me.id, pay ?? null, a.amount, a.date < me.today ? me.today : a.date, me.today, currency, { keep: true });
  }
  done('/forecast?setup=saved', editing ? 'Setup saved · forecast updated' : 'Your forecast is ready');
}

/* ---------- Entries ---------- */

async function ownedCategory(userId: string, id: string): Promise<string | null> {
  if (!id) return null;
  const c = await db.orm.public.Category.where({ id, userId }).first();
  return c?.id ?? null;
}

// Two-second logging: "12.50 lunch". The category comes from the same note
// before, else keywords, unless one is picked.
export async function quickAddAction(formData: FormData) {
  const me = await getMe();
  const back = backTo(formData, '/spending');
  const parsed = parseQuick(str(formData, 'text', 120));
  if (!parsed) done(back, 'Type an amount and a word, like "12.50 lunch".', 'error');
  const date = day(formData, 'date') ?? me.today;
  if (date > me.today) done(back, 'Log what already happened. Plan future costs under Plan.', 'error');

  await ensureCategories(me.id);
  let categoryId = await ownedCategory(me.id, str(formData, 'categoryId', 40));
  if (!categoryId) {
    const cats = await db.orm.public.Category.where({ userId: me.id }).all();
    const recent = await db.orm.public.Entry.where({ userId: me.id })
      .where((e) => e.categoryId.isNotNull())
      .orderBy((e) => e.createdAt.desc())
      .limit(300)
      .all();
    const history = new Map<string, string>();
    for (const e of recent.reverse()) history.set(e.note.toLowerCase(), e.categoryId!);
    categoryId = guessCategory(parsed.note, parsed.amount, history, new Map(cats.map((c) => [c.name, c.id])));
  }

  // Before a purchase future you may regret, play the note you left.
  if (!formData.get('confirm') && categoryId && parsed.amount < 0) {
    const notes = await db.orm.public.FutureNote.where({ userId: me.id }).select('id', 'categoryId', 'until', 'shown').all();
    const note = noteFor(notes, categoryId, me.today);
    if (note) {
      const [cat, rated, spent] = await Promise.all([
        db.orm.public.Category.where({ id: categoryId }).first(),
        db.orm.public.Entry.where({ userId: me.id, categoryId })
          .where((e) => e.mood.isNotNull())
          .orderBy((e) => e.date.desc())
          .limit(10)
          .all(),
        db.orm.public.Entry.where({ userId: me.id, categoryId })
          .where((e) => e.date.gte(`${monthOf(me.today)}-01`))
          .aggregate((a) => ({ total: a.sum('amount') })),
      ]);
      const budgetLeft = cat?.kind === 'flex' && cat.budget > 0 ? cat.budget + Number(spent.total ?? 0) : null;
      const pause = pauseFor({ categoryId, amount: parsed.amount }, { recentMoods: rated.map((e) => e.mood!), budgetLeft });
      if (pause) {
        await db.orm.public.FutureNote.where({ id: note.id, userId: me.id }).update({ shown: note.shown + 1 });
        const q = new URLSearchParams({ pause: note.id, text: str(formData, 'text', 120), date, categoryId, why: pause.reason === 'regret' ? `r${pause.regrets}/${pause.of}` : `b${pause.over}` });
        redirect(`${back.split('?')[0]}?${q.toString()}`);
      }
    }
  }

  await db.orm.public.Entry.create({ userId: me.id, date, amount: parsed.amount, note: parsed.note, categoryId });
  const cat = categoryId ? await db.orm.public.Category.where({ id: categoryId }).first() : null;
  done(back, `${parsed.note} ${exact(parsed.amount, me.currency)}${cat ? ` · ${cat.name}` : ''}`);
}

export async function deleteEntryAction(formData: FormData) {
  const me = await getMe();
  await db.orm.public.Entry.where({ id: str(formData, 'id', 40), userId: me.id }).delete();
  done(backTo(formData, '/spending'), 'Entry deleted');
}

export async function setEntryCategoryAction(formData: FormData) {
  const me = await getMe();
  const categoryId = await ownedCategory(me.id, str(formData, 'categoryId', 40));
  await db.orm.public.Entry.where({ id: str(formData, 'id', 40), userId: me.id }).update({ categoryId });
  redirect(backTo(formData, '/spending'));
}

// Worth-It: 😍 😐 😩. Tapping the same face again clears it.
export async function rateAction(formData: FormData) {
  const me = await getMe();
  const mood = str(formData, 'mood', 10);
  const id = str(formData, 'id', 40);
  const entry = await db.orm.public.Entry.where({ id, userId: me.id }).first();
  if (entry && isMood(mood)) {
    const clear = entry.mood === mood;
    await db.orm.public.Entry.where({ id, userId: me.id }).update({ mood: clear ? null : mood, ratedAt: clear ? null : new Date().toISOString() });
  }
  redirect(backTo(formData, '/worth-it'));
}

/* ---------- Bills and income ---------- */

export async function addRecurringAction(formData: FormData) {
  const me = await getMe();
  const back = backTo(formData, '/spending?tab=bills');
  const name = str(formData, 'name', 80);
  const p = priced(cents(formData, 'amount') ?? 0, str(formData, 'amountCurrency', 3), me.currency, await getRates());
  const amount = p.amount;
  const cadence = str(formData, 'cadence', 12);
  const given = day(formData, 'nextDate');
  const income = str(formData, 'direction') === '+' || str(formData, 'direction') === 'in';
  // No price or no date yet (cloud bills that change monthly): saved as varies.
  const variable = Boolean(formData.get('variable')) || !amount || !given;
  const date = given ?? monthStart(addMonths(me.today, 1));
  if (!name || !isCadence(cadence)) done(back, 'Give it a name.', 'error');
  await ensureCategories(me.id);
  let categoryId = await ownedCategory(me.id, str(formData, 'categoryId', 40));
  if (!categoryId) {
    const cat = await db.orm.public.Category.where({ userId: me.id, name: recurringCategory(name, income) }).first();
    categoryId = cat?.id ?? null;
  }
  const nextDate = date > me.today ? date : rollForward(date, cadence, me.today);
  await db.orm.public.Recurring.create({ userId: me.id, name, amount: income ? amount : -amount, cadence, nextDate, categoryId, variable, priceCurrency: p.priceCurrency, priceAmount: p.priceAmount });
  const label = CADENCES.find(([c]) => c === cadence)![1].toLowerCase();
  done(back, variable ? `${name} added · price varies` : `${name} added · ${money(income ? amount : -amount, me.currency, { sign: true })} ${label}`);
}

export async function updateRecurringAction(formData: FormData) {
  const me = await getMe();
  const back = backTo(formData, '/spending?tab=bills');
  const id = str(formData, 'id', 40);
  const row = await db.orm.public.Recurring.where({ id, userId: me.id }).first();
  const p = priced(cents(formData, 'amount') ?? 0, str(formData, 'amountCurrency', 3), me.currency, await getRates());
  const amount = p.amount;
  const cadence = str(formData, 'cadence', 12);
  const given = day(formData, 'nextDate');
  const date = given ?? row?.nextDate ?? me.today;
  const variable = Boolean(formData.get('variable')) || !amount || !given;
  if (!row || !isCadence(cadence)) done(back, 'That item is gone.', 'error');
  const name = str(formData, 'name', 80) || row.name;
  const nextDate = date > me.today ? date : rollForward(date, cadence, me.today);
  const categoryId = formData.has('categoryId') ? await ownedCategory(me.id, str(formData, 'categoryId', 40)) : row.categoryId;
  await db.orm.public.Recurring.where({ id, userId: me.id }).update({ name, amount: row.amount < 0 ? -amount : amount, cadence, nextDate, categoryId, variable, priceCurrency: p.priceCurrency, priceAmount: p.priceAmount });
  done(back, `${name} updated`);
}

export async function deleteRecurringAction(formData: FormData) {
  const me = await getMe();
  const row = await db.orm.public.Recurring.where({ id: str(formData, 'id', 40), userId: me.id }).delete();
  done(backTo(formData, '/spending?tab=bills'), `${row?.name ?? 'Item'} removed`);
}

/* ---------- Budgets, balance, cushion ---------- */

const PALETTE = ['#0f7a63', '#f97316', '#8b5cf6', '#0ea5e9', '#ec4899', '#16a34a', '#e0a526', '#6366f1'];

// Everyday budgets come as rows budgetName0 / budgetAmount0 and so on, added
// one at a time. A new name becomes a category. With budgetsAll, everyday
// categories left out were removed and go back to zero.
async function applyBudgetRows(userId: string, formData: FormData, loaded?: Awaited<ReturnType<typeof loadCats>>): Promise<void> {
  const cats = loaded ?? (await loadCats(userId));
  const byName = new Map(cats.map((c) => [c.name.toLowerCase(), c]));
  let position = Math.max(0, ...cats.map((c) => c.position));
  const kept = new Set<string>();
  const creates: Array<{ userId: string; name: string; kind: string; budget: number; color: string; position: number }> = [];
  const writes: Array<PromiseLike<unknown>> = [];
  for (let i = 0; i < 40; i++) {
    const name = str(formData, `budgetName${i}`, 40);
    if (!name) continue;
    const amount = cents(formData, `budgetAmount${i}`) ?? 0;
    const cat = byName.get(name.toLowerCase());
    if (cat && cat.kind !== 'flex') continue;
    if (!cat) {
      if (creates.some((c) => c.name.toLowerCase() === name.toLowerCase())) continue;
      position += 1;
      creates.push({ userId, name, kind: 'flex', budget: amount, color: PALETTE[position % PALETTE.length]!, position });
      continue;
    }
    kept.add(cat.id);
    if (cat.budget !== amount) writes.push(db.orm.public.Category.where({ id: cat.id, userId }).update({ budget: amount }));
  }
  if (formData.get('budgetsAll')) {
    const cleared = cats.filter((c) => c.kind === 'flex' && c.budget && !kept.has(c.id)).map((c) => c.id);
    if (cleared.length) writes.push(db.orm.public.Category.where({ userId }).where((c) => c.id.in(cleared)).updateAll({ budget: 0 }));
  }
  if (creates.length) writes.push(db.orm.public.Category.createAll(creates));
  await Promise.all(writes);
}

async function loadCats(userId: string) {
  await ensureCategories(userId);
  return db.orm.public.Category.where({ userId }).all();
}

export async function saveBudgetsAction(formData: FormData) {
  const me = await getMe();
  await applyBudgetRows(me.id, formData);
  done(backTo(formData, '/spending?tab=budgets'), 'Budgets saved');
}

export async function addCategoryAction(formData: FormData) {
  const me = await getMe();
  const back = backTo(formData, '/spending?tab=budgets');
  const name = str(formData, 'name', 40);
  const kind = str(formData, 'kind', 10) || 'flex';
  if (!name || !isKind(kind)) done(back, 'Give the category a name.', 'error');
  if (await db.orm.public.Category.where({ userId: me.id, name }).first()) done(back, `You already have ${name}.`, 'error');
  const last = await db.orm.public.Category.where({ userId: me.id }).orderBy((c) => c.position.desc()).first();
  await db.orm.public.Category.create({ userId: me.id, name, kind, budget: kind === 'flex' ? (cents(formData, 'budget') ?? 0) : 0, color: PALETTE[(last?.position ?? 0) % PALETTE.length]!, position: (last?.position ?? 0) + 1 });
  done(back, `${name} added`);
}

export async function deleteCategoryAction(formData: FormData) {
  const me = await getMe();
  const row = await db.orm.public.Category.where({ id: str(formData, 'id', 40), userId: me.id }).delete();
  done(backTo(formData, '/spending?tab=budgets'), `${row?.name ?? 'Category'} removed`);
}

export async function setBalanceAction(formData: FormData) {
  const me = await getMe();
  const v = cents(formData, 'balance');
  if (v === null) done(backTo(formData, '/forecast'), 'Enter your balance.', 'error');
  await db.orm.public.User.where({ id: me.id }).update({ balance: str(formData, 'balanceSign') === '-' ? -v : v, balanceSetAt: new Date().toISOString() });
  done(backTo(formData, '/forecast'), 'Balance updated');
}

export async function setCushionAction(formData: FormData) {
  const me = await getMe();
  const v = cents(formData, 'cushion') ?? 0;
  await db.orm.public.User.where({ id: me.id }).update({ cushion: v });
  done(backTo(formData, '/forecast'), `Cushion set to ${money(v, me.currency)}`);
}

/* ---------- Money Weather fix ---------- */

// Spends less from one budget until the storm, then reports the new low.
export async function fixStormAction(formData: FormData) {
  const m = await loadMoney();
  const categoryId = str(formData, 'categoryId', 40);
  const amount = cents(formData, 'amount');
  const until = day(formData, 'until');
  const budget = m.budgets.find((b) => b.id === categoryId);
  if (!budget || !amount || !until || until < m.me.today) done('/forecast', 'That fix is no longer available.', 'error');
  const cuts = spreadCut(amount, m.me.today, until);
  await db.orm.public.BudgetMove.createAll(Object.entries(cuts).map(([month, cut]) => ({ userId: m.me.id, fromCategoryId: budget.id, amount: cut, month, reason: 'storm' })));
  const merged = { ...budget.cuts };
  for (const [month, cut] of Object.entries(cuts)) merged[month] = (merged[month] ?? 0) + cut;
  const budgets = m.budgets.map((b) => (b.id === budget.id ? { ...b, cuts: merged } : b));
  const debts = m.debts.filter((d) => d.direction === 'borrowed' && d.left > 0 && d.dueDate).map((d) => ({ id: d.id, person: d.person, remaining: d.left, dueDate: d.dueDate! }));
  const fc = buildForecast({ today: m.me.today, balance: m.balance, cushion: m.me.cushion, recurring: forForecast(m.recurring, m.advances), budgets, events: eventsOf(m), debts, days: 91 });
  done('/forecast', fc.low.amount >= 0 ? `Storm cleared · lowest point now ${money(fc.low.amount, m.me.currency)}` : `Better · lowest point now ${money(fc.low.amount, m.me.currency)} on ${short(fc.low.date)}`);
}

function eventsOf(m: Awaited<ReturnType<typeof loadMoney>>) {
  return m.events.filter((e) => !e.hidden && e.cost > 0).map((e) => ({ id: e.id, name: e.name, date: e.date, cost: e.cost, saveMonthly: e.saveMonthly, saveFrom: e.saveFrom, source: e.source }));
}

/* ---------- Worth-It move ---------- */

export async function moveValueAction(formData: FormData) {
  const me = await getMe();
  const from = await db.orm.public.Category.where({ id: str(formData, 'from', 40), userId: me.id }).first();
  const to = await db.orm.public.Category.where({ id: str(formData, 'to', 40), userId: me.id }).first();
  const amount = Math.min(cents(formData, 'amount') ?? 0, from?.budget ?? 0);
  if (!from || !to || amount <= 0) done('/worth-it', 'That move is no longer available.', 'error');
  await db.transaction(async (tx) => {
    await tx.orm.public.Category.where({ id: from.id, userId: me.id }).update({ budget: from.budget - amount });
    await tx.orm.public.Category.where({ id: to.id, userId: me.id }).update({ budget: to.budget + amount });
    await tx.orm.public.BudgetMove.create({ userId: me.id, fromCategoryId: from.id, toCategoryId: to.id, amount, reason: 'value' });
  });
  done('/worth-it', 'Budget moved toward what you love');
}

/* ---------- Timeline Forks ---------- */

export async function createForkAction(formData: FormData) {
  const me = await getMe();
  const name = str(formData, 'name', 80);
  if (!name) done('/forks', 'Name the fork, for example "Move to Austin".', 'error');
  const effects: Array<{ name: string; monthly: number }> = [];
  for (let i = 0; i < 8; i++) {
    const n = str(formData, `effName${i}`, 60);
    const a = cents(formData, `effAmount${i}`);
    if (n && a) effects.push({ name: n, monthly: str(formData, `effSign${i}`) === '-' ? -a : a });
  }
  const one = cents(formData, 'oneTime') ?? 0;
  const oneTime = str(formData, 'oneTimeSign') === '+' ? one : -one;
  if (!effects.length && !oneTime) done('/forks', 'Add at least one change, like a new salary or rent.', 'error');
  await db.transaction(async (tx) => {
    const fork = await tx.orm.public.Fork.create({ userId: me.id, name, oneTime, startDate: me.today });
    if (effects.length) await tx.orm.public.ForkEffect.createAll(effects.map((e) => ({ ...e, forkId: fork.id, userId: me.id })));
  });
  done('/forks', `Fork created · ${name}`);
}

export async function deleteForkAction(formData: FormData) {
  const me = await getMe();
  const row = await db.orm.public.Fork.where({ id: str(formData, 'id', 40), userId: me.id }).delete();
  done('/forks', `${row?.name ?? 'Fork'} removed`);
}

/* ---------- Plan ahead ---------- */

export async function startSavingAction(formData: FormData) {
  const me = await getMe();
  const event = await db.orm.public.PlanEvent.where({ id: str(formData, 'id', 40), userId: me.id }).first();
  const monthly = cents(formData, 'monthly');
  if (!event || !monthly || event.date <= me.today) done('/plan', 'That event can no longer be saved for.', 'error');
  await db.orm.public.PlanEvent.where({ id: event.id, userId: me.id }).update({ saveMonthly: monthly, saveFrom: monthOf(me.today) });
  done('/plan', `${money(monthly, me.currency)} a month set aside for ${event.name}`);
}

export async function stopSavingAction(formData: FormData) {
  const me = await getMe();
  await db.orm.public.PlanEvent.where({ id: str(formData, 'id', 40), userId: me.id }).update({ saveMonthly: null, saveFrom: null });
  done('/plan', 'Stopped setting money aside');
}

export async function hideEventAction(formData: FormData) {
  const me = await getMe();
  const row = await db.orm.public.PlanEvent.where({ id: str(formData, 'id', 40), userId: me.id }).update({ hidden: true, saveMonthly: null, saveFrom: null });
  done('/plan', `${row?.name ?? 'Event'} removed from your plan`);
}

// Manual event, or the edit form of any event: name, date, tag and items.
export async function saveEventAction(formData: FormData) {
  const me = await getMe();
  const id = str(formData, 'id', 40);
  const name = str(formData, 'name', 120);
  const date = day(formData, 'date');
  const tag = str(formData, 'tag', 20) || 'Other';
  const items: Array<{ name: string; amount: number }> = [];
  for (let i = 0; i < 8; i++) {
    const n = str(formData, `itemName${i}`, 60);
    const a = cents(formData, `itemAmount${i}`);
    if (n && a) items.push({ name: n, amount: a });
  }
  const back = id ? `/plan?event=${id}&edit=1` : '/plan?new=1';
  if (!name || !date) done(back, 'Give the event a name and a date.', 'error');
  if (date <= me.today) done(back, 'Pick a date in the future.', 'error');
  if (date > addMonths(me.today, 24)) done(back, 'Plan up to two years ahead.', 'error');
  // No prices typed: estimate from the name, like calendar events.
  let tagged = tag;
  if (!items.length) {
    const est = estimate(name, str(formData, 'location', 120));
    if (!est) done(back, 'Add what it will cost.', 'error');
    items.push(...est.items);
    if (tag === 'Other') tagged = est.tag;
  }

  let eventId = id;
  if (id) {
    const row = await db.orm.public.PlanEvent.where({ id, userId: me.id }).update({ name, date, tag: tagged, hidden: false });
    if (!row) done('/plan', 'That event is gone.', 'error');
  } else {
    eventId = (await db.orm.public.PlanEvent.create({ userId: me.id, name, date, tag: tagged, source: 'manual' })).id;
  }
  await db.transaction(async (tx) => {
    await tx.orm.public.PlanItem.where({ eventId, userId: me.id }).deleteAll();
    await tx.orm.public.PlanItem.createAll(items.map((i) => ({ ...i, eventId, userId: me.id })));
  });
  done('/plan', id ? `${name} updated` : `${name} added · ~${money(items.reduce((s, i) => s + i.amount, 0), me.currency)}`);
}
