import 'server-only';
import { db } from '../../prisma/db';
import { diffDays } from '../money/dates';
import { guessCategory } from '../money/categories';

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

// The same money within this many days counts as the same transaction.
const MATCH_DAYS = 3;

// Turns the main bank account's transactions into Spending entries, all of
// its history, each once. An entry already there for the same amount within
// a few days (a bill Pursecast posted, or one logged by hand) is the same
// transaction: it is matched instead of added again. Returns how many were
// added.
export async function entriesFromBank(userId: string): Promise<number> {
  const main = await db.orm.public.BankAccount.where({ userId, role: 'main' }).first();
  if (!main?.statementId) return 0;
  const [txns, entries, cats] = await Promise.all([
    db.orm.public.StatementTxn.where({ userId, statementId: main.statementId }).orderBy((t) => t.date.asc()).all(),
    db.orm.public.Entry.where({ userId }).select('id', 'date', 'amount', 'note', 'categoryId', 'externalId').all(),
    db.orm.public.Category.where({ userId }).all(),
  ]);
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
    if (done.has(externalId) || t.category === 'Transfers' || !t.amount) continue;
    const twin = open.get(t.amount)?.find((e) => !e.used && Math.abs(diffDays(e.date, t.date)) <= MATCH_DAYS);
    if (twin) {
      twin.used = true;
      matched.push({ id: twin.id, externalId });
      continue;
    }
    const mapped = TO_APP[t.category];
    const categoryId = (mapped && byName.get(mapped)) ?? guessCategory(t.place, t.amount, history, byName);
    creates.push({ userId, date: t.date, amount: t.amount, note: t.place.slice(0, 80), categoryId, source: 'bank', externalId });
  }
  for (let i = 0; i < creates.length; i += 200) await db.orm.public.Entry.createAll(creates.slice(i, i + 200));
  for (const m of matched) await db.orm.public.Entry.where({ id: m.id, userId }).update({ externalId: m.externalId });
  return creates.length;
}
