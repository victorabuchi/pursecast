'use server';

import { randomUUID } from 'node:crypto';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { refresh } from 'next/cache';
import { db } from '../../prisma/db';
import { done, str } from '../money/act';
import { getMe } from '../money/load';
import { bankReady, banksIn, deleteSession, startAuth } from './enable';
import { applyRoles, isRole, syncLink } from './sync';
import { entriesFromBank } from './entries';

const BACK = '/banks';

// Where the bank sends the person back to. It must be one of the redirect
// URLs registered for the Enable Banking application.
async function callbackUrl(): Promise<string> {
  const base = process.env['APP_URL'];
  if (base) return `${base.replace(/\/$/, '')}/api/bank/callback`;
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}/api/bank/callback`;
}

export async function banksAction(country: string): Promise<{ banks: Array<{ name: string; country: string; logo: string; beta: boolean }>; error?: string }> {
  await getMe();
  if (!bankReady() || !/^[A-Z]{2}$/.test(country)) return { banks: [] };
  try {
    return { banks: (await banksIn(country)).map((a) => ({ name: a.name, country: a.country, logo: a.logo, beta: Boolean(a.beta) })) };
  } catch (e) {
    console.error('Bank list failed', e);
    return { banks: [], error: e instanceof Error ? e.message : 'The bank list could not load.' };
  }
}

export async function connectBankAction(formData: FormData) {
  const me = await getMe();
  const name = str(formData, 'name', 120);
  const country = str(formData, 'country', 2);
  if (!bankReady()) done(BACK, 'Bank connections are not set up yet.', 'error');
  const bank = (await banksIn(country)).find((a) => a.name === name);
  if (!bank) done(BACK, 'Pick your bank from the list.', 'error');
  const state = randomUUID();
  const days = Math.max(1, Math.min(180, Math.floor((bank.maximum_consent_validity ?? 90 * 86400) / 86400)));
  let url: string;
  try {
    ({ url } = await startAuth({ aspsp: { name: bank.name, country: bank.country }, state, redirectUrl: await callbackUrl(), days }));
  } catch (e) {
    console.error('Bank authorisation could not start', e);
    done(BACK, `${bank.name} could not be reached. Try again in a moment.`, 'error');
  }
  // Attempts the person never finished (closed the bank's page) go after an hour.
  await db.orm.public.BankLink.where({ userId: me.id, status: 'pending' }).where((l) => l.createdAt.lt(new Date(Date.now() - 3_600_000).toISOString())).deleteAll();
  await db.orm.public.BankLink.create({ userId: me.id, aspspName: bank.name, aspspCountry: bank.country, logo: bank.logo, state, status: 'pending' });
  redirect(url);
}

export async function syncBankAction(formData: FormData) {
  const me = await getMe();
  const res = await syncLink(me.id, str(formData, 'id', 40));
  if (res.error) done(BACK, res.error, 'error');
  done(BACK, res.added ? `${res.added} new ${res.added === 1 ? 'transaction' : 'transactions'} · balances updated` : 'Up to date · balances updated');
}

// Ends the bank's access. What was already imported stays in Statements.
export async function disconnectBankAction(formData: FormData) {
  const me = await getMe();
  const link = await db.orm.public.BankLink.where({ id: str(formData, 'id', 40), userId: me.id }).first();
  if (!link) done(BACK, 'That bank is already disconnected.');
  if (link.sessionId) await deleteSession(link.sessionId).catch((e) => console.error('Could not end the bank session', e));
  const mirrored = (await db.orm.public.BankAccount.where({ userId: me.id, linkId: link.id }).all()).map((a) => a.accountId).filter((x): x is string => Boolean(x));
  if (mirrored.length) await db.orm.public.Account.where({ userId: me.id }).where((a) => a.id.in(mirrored)).deleteAll();
  await db.orm.public.BankLink.where({ id: link.id, userId: me.id }).delete();
  done(BACK, `${link.aspspName} disconnected · imported transactions are kept in Statements`);
}

// A name the person gives a linked account, like "Revolut Pro".
export async function renameBankAccountAction(id: string, name: string): Promise<void> {
  const me = await getMe();
  const clean = String(name ?? '').trim().slice(0, 60);
  if (!clean) return;
  const account = await db.orm.public.BankAccount.where({ id: String(id).slice(0, 40), userId: me.id }).update({ name: clean });
  if (account?.iban) {
    await db.orm.public.BankName.where({ userId: me.id, iban: account.iban, currency: account.currency }).deleteAll();
    await db.orm.public.BankName.create({ userId: me.id, iban: account.iban, currency: account.currency, name: clean });
  }
  await applyRoles(me.id);
  refresh();
}

// What an account is for. Only one account can be the main one.
export async function setBankRoleAction(id: string, role: string): Promise<void> {
  const me = await getMe();
  if (!isRole(role)) return;
  const account = await db.orm.public.BankAccount.where({ id: String(id).slice(0, 40), userId: me.id }).first();
  if (!account) return;
  if (role === 'main') await db.orm.public.BankAccount.where({ userId: me.id, role: 'main' }).updateAll({ role: 'counted' });
  await db.orm.public.BankAccount.where({ id: account.id, userId: me.id }).update({ role });
  if (role === 'main') await entriesFromBank(me.id);
  await applyRoles(me.id);
  refresh();
}
