import 'server-only';
import { db } from '../../prisma/db';
import { addDays, todayIn } from '../money/dates';
import { convert } from '../money/currencies';
import { getRates } from '../money/fx';
import { txnKey } from '../statements/analysis';
import { categorize, tidyPlace } from '../statements/tabular';
import type { Txn } from '../statements/types';
import { BankError, balances, transactions, type BankTxn, type Money } from './enable';
import { entriesFromBank } from './entries';

export type Role = 'main' | 'counted' | 'other' | 'off';
export const ROLES: Array<[Role, string]> = [
  ['main', 'Main account'],
  ['counted', 'Other account, in forecast'],
  ['other', 'Other account, not counted'],
  ['off', 'Don’t use'],
];
export const isRole = (r: string): r is Role => ROLES.some(([x]) => x === r);

const toCents = (m: Money) => Math.round(Number(m.amount) * 100);

// The balance a person sees in their banking app: available first, then booked.
const PREFER = ['ITAV', 'CLAV', 'XPCD', 'ITBD', 'CLBD', 'OPAV', 'OPBD', 'VALU', 'OTHR'];
export function pickBalance(list: Array<{ balance_amount: Money; balance_type: string }>): Money | null {
  const sorted = [...list].sort((a, b) => (PREFER.indexOf(a.balance_type) + 100) % 100 - (PREFER.indexOf(b.balance_type) + 100) % 100);
  return sorted[0]?.balance_amount ?? null;
}

// A bank's transaction as a statement line: money out negative, the shop or
// person as the place, sorted into a category like an uploaded statement.
export function toTxn(t: BankTxn): Txn | null {
  if (t.status && !['BOOK', 'BOOKED'].includes(t.status.toUpperCase())) return null;
  const date = t.booking_date || t.value_date || t.transaction_date;
  if (!date) return null;
  const out = t.credit_debit_indicator === 'DBIT' || t.credit_debit_indicator === 'DBTR';
  const amount = Math.abs(toCents(t.transaction_amount)) * (out ? -1 : 1);
  const party = (out ? t.creditor?.name : t.debtor?.name) || '';
  const notes = (t.remittance_information ?? []).filter(Boolean).join(' ');
  const place = tidyPlace(party || notes || (out ? 'Payment' : 'Money in')).slice(0, 80);
  const description = [party, notes].filter(Boolean).join(' · ').slice(0, 200) || place;
  return { date: date.slice(0, 10), description, place, amount, category: categorize(`${place} ${description}`, amount) };
}

const masked = (iban: string | null) => (iban ? `•• ${iban.replace(/\s/g, '').slice(-4)}` : '');

// Puts each account's last known balance where it belongs: the main one is
// the balance Money Weather starts from, the others sit next to it.
export async function applyRoles(userId: string): Promise<void> {
  const [user, accounts, links] = await Promise.all([
    db.orm.public.User.where({ id: userId }).first(),
    db.orm.public.BankAccount.where({ userId }).all(),
    db.orm.public.BankLink.where({ userId }).all(),
  ]);
  if (!user) return;
  const rates = await getRates();
  const bankName = new Map(links.map((l) => [l.id, l.aspspName]));
  for (const a of accounts) {
    if (a.role === 'main' && a.balance !== null) {
      const value = convert(a.balance, a.currency, user.currency, rates);
      if (value !== null) await db.orm.public.User.where({ id: userId }).update({ balance: value, balanceSetAt: new Date().toISOString() });
    }
    const wantsRow = a.role === 'counted' || a.role === 'other';
    if (wantsRow) {
      const row = { name: `${bankName.get(a.linkId) ?? 'Bank'} · ${a.name}`.slice(0, 60), kind: 'everyday', currency: a.currency, balance: a.balance ?? 0, inForecast: a.role === 'counted', updatedAt: new Date().toISOString() };
      const existing = a.accountId ? await db.orm.public.Account.where({ id: a.accountId, userId }).first() : null;
      if (existing) await db.orm.public.Account.where({ id: existing.id, userId }).update(row);
      else {
        const created = await db.orm.public.Account.create({ userId, ...row });
        await db.orm.public.BankAccount.where({ id: a.id, userId }).update({ accountId: created.id });
      }
    } else if (a.accountId) {
      await db.orm.public.Account.where({ id: a.accountId, userId }).delete();
      await db.orm.public.BankAccount.where({ id: a.id, userId }).update({ accountId: null });
    }
  }
}

// Reads balances and new transactions for every account of a link. Returns
// how many new transactions came in.
export async function syncLink(userId: string, linkId: string): Promise<{ added: number; error?: string }> {
  const [link, user] = await Promise.all([db.orm.public.BankLink.where({ id: linkId, userId }).first(), db.orm.public.User.where({ id: userId }).first()]);
  if (!link || !user || !link.sessionId) return { added: 0, error: 'Not connected' };
  if (link.validUntil && link.validUntil < new Date().toISOString()) {
    await db.orm.public.BankLink.where({ id: link.id, userId }).update({ status: 'expired' });
    return { added: 0, error: 'The bank connection has ended. Connect again.' };
  }
  const today = todayIn(user.timezone);
  const from = link.lastSyncAt ? addDays(link.lastSyncAt.slice(0, 10), -7) : addDays(today, -365);
  const accounts = await db.orm.public.BankAccount.where({ userId, linkId }).all();
  const known = new Set((await db.orm.public.StatementTxn.where({ userId }).select('date', 'amount', 'place').all()).map(txnKey));
  let added = 0;
  try {
    for (const a of accounts) {
      if (a.role === 'off') continue;
      const bal = pickBalance(await balances(a.uid));
      if (bal) await db.orm.public.BankAccount.where({ id: a.id, userId }).update({ balance: toCents(bal), balanceAt: new Date().toISOString() });
      const fresh = (await transactions(a.uid, from)).map(toTxn).filter((t): t is Txn => t !== null && !known.has(txnKey(t)));
      if (!fresh.length) continue;
      for (const t of fresh) known.add(txnKey(t));
      let statementId = a.statementId;
      if (!statementId || !(await db.orm.public.Statement.where({ id: statementId, userId }).first())) {
        // Reconnecting the same account continues its statement.
        const name = `${link.aspspName} · ${a.name} ${masked(a.iban)}`.trim().slice(0, 80);
        const s = (await db.orm.public.Statement.where({ userId, name }).first()) ?? (await db.orm.public.Statement.create({ userId, name }));
        statementId = s.id;
        await db.orm.public.BankAccount.where({ id: a.id, userId }).update({ statementId });
      }
      await db.orm.public.StatementTxn.createAll(fresh.map((t) => ({ ...t, userId, statementId: statementId! })));
      added += fresh.length;
    }
    await db.orm.public.BankLink.where({ id: link.id, userId }).update({ status: 'active', lastSyncAt: new Date().toISOString(), error: null });
    // Spending entries first, then the balance, so the bank's balance stays the truth.
    await entriesFromBank(userId);
    await applyRoles(userId);
    return { added };
  } catch (e) {
    const expired = e instanceof BankError && (e.status === 401 || e.status === 403);
    const message = expired ? 'The bank connection has ended. Connect again.' : e instanceof Error ? e.message.slice(0, 200) : 'Sync failed';
    console.error('Bank sync failed', link.aspspName, e);
    await db.orm.public.BankLink.where({ id: link.id, userId }).update({ status: expired ? 'expired' : 'error', error: message });
    return { added, error: message };
  }
}
