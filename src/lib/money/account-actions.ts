'use server';

import { redirect } from 'next/navigation';
import { db } from '../../prisma/db';
import { destroySession } from '../auth/session';
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from '../auth/password';
import { done, str } from './act';
import { getMe } from './load';
import { normalizeCalendarUrl } from './plan';
import { syncCalendar } from './calendar';

const CURRENCIES = new Set(['EUR', 'USD', 'GBP', 'SEK', 'NOK', 'DKK', 'CHF', 'PLN', 'CAD', 'AUD', 'NGN', 'INR', 'JPY']);

function validZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function updateProfileAction(formData: FormData) {
  const me = await getMe();
  const name = str(formData, 'name', 80);
  const currency = str(formData, 'currency', 3);
  const timezone = str(formData, 'timezone', 60);
  if (!name) done('/settings', 'Enter your name.', 'error');
  await db.orm.public.User.where({ id: me.id }).update({
    name,
    currency: CURRENCIES.has(currency) ? currency : me.currency,
    timezone: validZone(timezone) ? timezone : me.timezone,
  });
  done('/settings', 'Profile saved');
}

export async function changePasswordAction(formData: FormData) {
  const me = await getMe();
  const current = String(formData.get('current') ?? '');
  const next = String(formData.get('password') ?? '');
  const identity = await db.orm.public.AuthIdentity.where({ userId: me.id, provider: 'password' }).first();
  if (identity && !(await verifyPassword(current, identity.secretHash))) done('/settings', 'Your current password is not right.', 'error');
  if (next.length < MIN_PASSWORD_LENGTH) done('/settings', `Use at least ${MIN_PASSWORD_LENGTH} characters.`, 'error');
  const secretHash = await hashPassword(next);
  if (identity) await db.orm.public.AuthIdentity.where({ id: identity.id }).update({ secretHash, subject: me.email });
  else await db.orm.public.AuthIdentity.create({ userId: me.id, provider: 'password', subject: me.email, secretHash });
  done('/settings', 'Password changed');
}

export async function deleteAccountAction(formData: FormData) {
  const me = await getMe();
  if (str(formData, 'confirm', 254).toLowerCase() !== me.email) done('/settings', 'Type your email address to confirm.', 'error');
  // Every table cascades from the user.
  await db.orm.public.LoginToken.where({ email: me.email }).deleteAll();
  await db.orm.public.User.where({ id: me.id }).delete();
  await destroySession();
  redirect('/?deleted=1');
}

export async function connectCalendarAction(formData: FormData) {
  const me = await getMe();
  const url = normalizeCalendarUrl(str(formData, 'url', 1000));
  if (!url) done('/plan', 'Paste the secret address in iCal format.', 'error');
  let found = 0;
  try {
    found = (await syncCalendar(me.id, url, me.today)).found;
  } catch {
    found = -1;
  }
  if (found < 0) done('/plan', 'Could not read that calendar. Check the address and try again.', 'error');
  await db.orm.public.User.where({ id: me.id }).update({ calendarUrl: url });
  done('/plan', found ? `Calendar connected · ${found} upcoming ${found === 1 ? 'cost' : 'costs'} found` : 'Calendar connected · no costs found in the next 6 months');
}

export async function syncCalendarAction() {
  const me = await getMe();
  if (!me.calendarUrl) done('/plan', 'Connect a calendar first.', 'error');
  let found = -1;
  try {
    found = (await syncCalendar(me.id, me.calendarUrl, me.today)).found;
  } catch {
    found = -1;
  }
  if (found < 0) done('/plan', 'Could not read your calendar right now. Try again in a moment.', 'error');
  done('/plan', `Calendar read · ${found} upcoming ${found === 1 ? 'cost' : 'costs'}`);
}

export async function disconnectCalendarAction() {
  const me = await getMe();
  const events = await db.orm.public.PlanEvent.where({ userId: me.id, source: 'calendar' }).all();
  for (const e of events) if (!e.saveMonthly) await db.orm.public.PlanEvent.where({ id: e.id, userId: me.id }).delete();
  await db.orm.public.User.where({ id: me.id }).update({ calendarUrl: null, calendarAt: null });
  done('/plan', 'Calendar disconnected');
}
