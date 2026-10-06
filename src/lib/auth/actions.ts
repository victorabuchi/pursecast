'use server';

import { redirect } from 'next/navigation';
import { db } from '../../prisma/db';
import { burnPasswordCheck, hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from './password';
import { createSession, destroySession } from './session';
import { clearFailures, isThrottled, recordFailure } from './throttle';
import { HOME } from './constants';

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

export async function signOutAction() {
  await destroySession();
  redirect('/');
}
