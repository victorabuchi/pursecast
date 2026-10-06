import { timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { db } from '../../../../prisma/db';
import { appleProfile, appleReady } from '../../../../lib/auth/apple';
import { requestOrigin } from '../../../../lib/auth/origin';
import { createSession, mintSessionToken } from '../../../../lib/auth/session';
import { appReturn, mintHandoff } from '../../../../lib/mobile/handoff';
import { HOME } from '../../../../lib/auth/constants';

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
// After a cross-site POST, a 303 makes the browser come back with a GET.
const go = (path: string, origin: string) => Response.redirect(new URL(path, origin), 303);

// Apple posts the result here. Apple sends the person's name only the very
// first time, in the "user" field.
export async function POST(request: Request) {
  const origin = await requestOrigin();
  const form = await request.formData();
  const jar = await cookies();
  const expected = jar.get('pursecast_apple')?.value ?? '';
  const challenge = jar.get('pursecast_apple_app')?.value ?? '';
  jar.delete({ name: 'pursecast_apple', path: '/auth/apple' });
  jar.delete({ name: 'pursecast_apple_app', path: '/auth/apple' });
  const state = String(form.get('state') ?? '');
  const code = String(form.get('code') ?? '');
  // A sign-in the phone app started (state "app.…") goes back to the app.
  const fromApp = state.startsWith('app.');
  const fail = () => (fromApp ? appReturn({ error: 'Apple sign-in did not finish. Try again.' }, 303) : go('/login?error=apple', origin));
  if (!appleReady() || !code || !expected || !same(state, expected)) return fail();

  const profile = await appleProfile(code, origin);
  if (!profile) return fail();
  let name = '';
  try {
    const u = JSON.parse(String(form.get('user') ?? '{}')) as { name?: { firstName?: string; lastName?: string } };
    name = [u.name?.firstName, u.name?.lastName].filter(Boolean).join(' ').trim();
  } catch {
    name = '';
  }

  const now = new Date().toISOString();
  const identity = await db.orm.public.AuthIdentity.where({ provider: 'apple', subject: profile.sub }).first();
  let userId = identity?.userId ?? null;
  if (!userId) {
    const existing = await db.orm.public.User.where({ email: profile.email }).first();
    userId = existing ? existing.id : (await db.orm.public.User.create({ email: profile.email, name: (name || profile.email.split('@')[0] || 'You').slice(0, 80), lastSignInAt: now })).id;
    await db.orm.public.AuthIdentity.create({ userId, provider: 'apple', subject: profile.sub, lastUsedAt: now });
  } else {
    await db.orm.public.AuthIdentity.where({ id: identity!.id }).update({ lastUsedAt: now });
  }
  await db.orm.public.User.where({ id: userId }).update({ lastSignInAt: now });
  // With a challenge the app gets a short-lived code to exchange; without one, the token itself.
  if (fromApp) return appReturn(challenge ? { code: mintHandoff(userId, challenge) } : { token: mintSessionToken(userId) }, 303);
  await createSession(userId);
  return go(HOME, origin);
}
