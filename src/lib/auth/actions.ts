'use server';

import { redirect } from 'next/navigation';
import { db } from '../../prisma/db';
import { emailConfigured, sendEmail } from '../email';
import { burnPasswordCheck, hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from './password';
import { createSession, destroySession } from './session';
import { hashLoginToken, newLoginToken } from './token';
import { clearFailures, isThrottled, recordFailure } from './throttle';
import { requestOrigin } from './origin';
import { HOME, LOGIN_LINK_MINUTES } from './constants';

function readEmail(formData: FormData): string {
  return String(formData.get('email') ?? '').trim().toLowerCase().slice(0, 254);
}

function back(path: '/login' | '/signup', params: Record<string, string | string[]>): never {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) for (const value of Array.isArray(v) ? v : [v]) search.append(k, value);
  redirect(`${path}?${search.toString()}`);
}

export async function signUpAction(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim().slice(0, 80);
  const email = readEmail(formData);
  const password = String(formData.get('password') ?? '');
  // Bots fill every field, people never see this one.
  if (formData.get('website')) back('/signup', { error: 'missing' });
  if (!name || !email.includes('@')) back('/signup', { error: 'missing', name, email });
  if (password.length < MIN_PASSWORD_LENGTH) back('/signup', { error: 'short', name, email });
  if (await db.orm.public.User.where({ email }).first()) back('/signup', { error: 'taken', name, email });

  const secretHash = await hashPassword(password);
  const now = new Date().toISOString();
  let userId: string | null = null;
  try {
    userId = await db.transaction(async (tx) => {
      const user = await tx.orm.public.User.create({ email, name, lastSignInAt: now });
      await tx.orm.public.AuthIdentity.create({ userId: user.id, provider: 'password', subject: email, secretHash, lastUsedAt: now });
      return user.id;
    });
  } catch {
    // Most likely the same email signing up twice at once.
    userId = null;
  }
  if (!userId) back('/signup', { error: 'taken', name, email });
  await createSession(userId);
  redirect(HOME);
}

export async function passwordSignInAction(formData: FormData) {
  const email = readEmail(formData);
  const password = String(formData.get('password') ?? '');
  if (!email || !password) back('/login', { error: 'missing', email });
  if (isThrottled(email)) back('/login', { error: 'throttled', email });

  const identity = await db.orm.public.AuthIdentity.where({ provider: 'password', subject: email }).first();
  if (!identity) await burnPasswordCheck(password);
  if (identity && (await verifyPassword(password, identity.secretHash))) {
    clearFailures(email);
    const now = new Date().toISOString();
    await db.orm.public.AuthIdentity.where({ id: identity.id }).update({ lastUsedAt: now });
    await db.orm.public.User.where({ id: identity.userId }).update({ lastSignInAt: now });
    await createSession(identity.userId);
    redirect(HOME);
  }

  recordFailure(email);
  back('/login', { error: 'invalid', email });
}

// Always answers "sent" so the form does not reveal who has an account.
export async function requestLinkAction(formData: FormData) {
  const email = readEmail(formData);
  if (!email.includes('@')) back('/login', { error: 'missing', email });
  if (!(await db.orm.public.User.where({ email }).first())) back('/login', { sent: '1' });

  const { token, hash } = newLoginToken();
  await db.orm.public.LoginToken.create({
    tokenHash: hash,
    email,
    expiresAt: new Date(Date.now() + LOGIN_LINK_MINUTES * 60_000).toISOString(),
  });
  const link = `${await requestOrigin()}/auth/verify?token=${token}`;

  if (emailConfigured()) {
    const ok = await sendEmail({
      to: email,
      subject: 'Your Pursecast sign-in link',
      text: `Open this link to sign in to Pursecast:\n\n${link}\n\nIt works once and expires in ${LOGIN_LINK_MINUTES} minutes. If you did not ask for it, you can ignore this email.`,
    });
    back('/login', ok ? { sent: '1' } : { error: 'email', email });
  }
  // Development without an email provider: show the link on the page.
  if (process.env.NODE_ENV !== 'production') back('/login', { sent: '1', dev: link });
  back('/login', { error: 'email', email });
}

export async function consumeLinkAction(formData: FormData) {
  const token = String(formData.get('token') ?? '');
  const row = token ? await db.orm.public.LoginToken.where({ tokenHash: hashLoginToken(token) }).first() : null;
  if (!row || row.usedAt || new Date(row.expiresAt).getTime() < Date.now()) back('/login', { error: 'link' });
  await db.orm.public.LoginToken.where({ id: row.id }).update({ usedAt: new Date().toISOString() });

  const user = await db.orm.public.User.where({ email: row.email }).first();
  if (!user) back('/login', { error: 'link' });
  await db.orm.public.User.where({ id: user.id }).update({ lastSignInAt: new Date().toISOString() });
  await createSession(user.id);
  redirect(HOME);
}

export async function signOutAction() {
  await destroySession();
  redirect('/');
}
