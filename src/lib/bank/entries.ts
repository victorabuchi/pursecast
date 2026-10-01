import 'server-only';
import { db } from '../../prisma/db';
import { diffDays } from '../money/dates';
import { guessCategory } from '../money/categories';
import { findTransfers, MATCH_DAYS } from './transfers';
import { convert } from '../money/currencies';
import { getRates } from '../money/fx';

// Statement categories to the person's own spending categories. Transfers
// between their own accounts are not spending, so they are left out.
const TO_APP: Record<string, string> = {
  Income: 'Income',
  Groceries: 'Groceries',
  'Eating out': 'Eating out',
  Takeaway: 'Takeaway',
  Coffee: 'Coffee',
  Transport: 'Transport',
  Housing: 'Housing',
  'Bills & insurance': 'Bills & insurance',
  Subscriptions: 'Subscriptions',
  Shopping: 'Shopping',
  Health: 'Health',
  Fun: 'Fun money',
  Travel: 'Travel',
  Gifts: 'Gifts',
  Cash: 'Other',
  Fees: 'Bills & insurance',
  Other: 'Other',
};

// Turns the linked bank accounts' transactions into Spending entries, all of
// their history, each once. An entry already there for the same amount within
// a few days (a bill Pursecast posted, or one logged by hand) is the same
// transaction: it is matched instead of added again. Returns how many were
// added.
export async function entriesFromBank(userId: string): Promise<number> {
  // Every linked account in use. A main account is required: its balance is
  // the truth the entries are measured against.
  const accounts = (await db.orm.public.BankAccount.where({ userId }).all()).filter((a) => a.role !== 'off' && a.statementId);
  if (!accounts.some((a) => a.role === 'main')) return 0;
  const statementIds = [...new Set(accounts.map((a) => a.statementId!))];
  const currencyOf = new Map(accounts.map((a) => [a.statementId!, a.currency]));
  const [user, rates] = await Promise.all([db.orm.public.User.where({ id: userId }).first(), getRates()]);
  if (!user) return 0;
  const names = [user.name, ...accounts.map((a) => a.holder ?? '')].filter((n) => /^[\p{L}' -]+$/u.test(n));
  // Amounts in the person's own currency, at today's rate.
  const inMain = (amount: number, statementId: string) => {
    const cur = currencyOf.get(statementId) ?? user.currency;
    return cur === user.currency ? amount : (convert(amount, cur, user.currency, rates) ?? amount);
  };
  const [txnsRaw, entries, cats] = await Promise.all([
    db.orm.public.StatementTxn.where({ userId }).where((t) => t.statementId.in(statementIds)).orderBy((t) => t.date.asc()).all(),
    db.orm.public.Entry.where({ userId }).select('id', 'date', 'amount', 'note', 'categoryId', 'externalId').all(),
    db.orm.public.Category.where({ userId }).all(),
  ]);
  const links = await db.orm.public.BankLink.where({ userId }).select('id', 'aspspName').all();
  const bankOf = new Map(accounts.map((a) => [a.statementId!, links.find((l) => l.id === a.linkId)?.aspspName ?? '']));
  const txns = txnsRaw.map((t) => ({ ...t, value: inMain(t.amount, t.statementId) }));
  const notSpendingIds = findTransfers(txns, { names, bankOf });
  const done = new Set(entries.map((e) => e.externalId).filter(Boolean));
  const byName = new Map(cats.map((c) => [c.name, c.id]));
  const history = new Map(entries.filter((e) => e.categoryId).map((e) => [e.note.trim().toLowerCase(), e.categoryId!]));
  // Entries not from the bank, by amount, that a bank transaction can match once.
  const open = new Map<number, Array<{ id: string; date: string; used: boolean }>>();
  for (const e of entries) if (!e.externalId) open.set(e.amount, [...(open.get(e.amount) ?? []), { id: e.id, date: e.date, used: false }]);

  const creates: Array<{ userId: string; date: string; amount: number; note: string; categoryId: string | null; source: string; externalId: string }> = [];
  const matched: Array<{ id: string; externalId: string }> = [];
  for (const t of txns) {
    const externalId = `stx:${t.id}`;
    if (done.has(externalId) || notSpendingIds.has(t.id) || !t.amount) continue;
    const twin = open.get(t.value)?.find((e) => !e.used && Math.abs(diffDays(e.date, t.date)) <= MATCH_DAYS);
    if (twin) {
      twin.used = true;
      matched.push({ id: twin.id, externalId });
      continue;
    }
    const mapped = TO_APP[t.category];
    const categoryId = (mapped && byName.get(mapped)) ?? guessCategory(t.place, t.value, history, byName);
    creates.push({ userId, date: t.date, amount: t.value, note: t.place.slice(0, 80), categoryId, source: 'bank', externalId });
  }
  for (let i = 0; i < creates.length; i += 200) await db.orm.public.Entry.createAll(creates.slice(i, i + 200));
  // Entries imported before a transaction was recognised as a transfer go.
  const notSpending = new Set([...notSpendingIds].map((id) => `stx:${id}`));
  const stale = entries.filter((e) => e.externalId && notSpending.has(e.externalId)).map((e) => e.id);
  for (let i = 0; i < stale.length; i += 200) await db.orm.public.Entry.where({ userId, source: 'bank' }).where((e) => e.id.in(stale.slice(i, i + 200))).deleteAll();
  for (const m of matched) await db.orm.public.Entry.where({ id: m.id, userId }).update({ externalId: m.externalId });
  return creates.length;
}
