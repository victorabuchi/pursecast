import { timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '../../../../prisma/db';
import { googleProfile, googleReady } from '../../../../lib/auth/google';
import { requestOrigin } from '../../../../lib/auth/origin';
import { createSession, mintSessionToken } from '../../../../lib/auth/session';
import { HOME } from '../../../../lib/auth/constants';
import { appReturn, mintHandoff } from '../../../../lib/mobile/handoff';

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// Google sends the person back here. An account with the same verified email
// is signed in (and remembers Google from then on); otherwise one is made.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  const expected = jar.get('pursecast_google')?.value ?? '';
  const challenge = jar.get('pursecast_google_app')?.value ?? '';
  jar.delete({ name: 'pursecast_google', path: '/auth/google' });
  jar.delete({ name: 'pursecast_google_app', path: '/auth/google' });
  const state = url.searchParams.get('state') ?? '';
  const code = url.searchParams.get('code');
  // A sign-in the phone app started (state "app.…") goes back to the app.
  const fromApp = state.startsWith('app.');
  const fail = () => (fromApp ? appReturn({ error: 'Google sign-in did not finish. Try again.' }) : redirect('/login?error=google'));
  if (!googleReady() || !code || !expected || !same(state, expected)) return fail();

  const profile = await googleProfile(code, await requestOrigin());
  if (!profile) return fail();

  const now = new Date().toISOString();
  const identity = await db.orm.public.AuthIdentity.where({ provider: 'google', subject: profile.sub }).first();
  let userId = identity?.userId ?? null;
  if (!userId) {
    const existing = await db.orm.public.User.where({ email: profile.email }).first();
    userId = existing
      ? existing.id
      : (await db.transaction(async (tx) => (await tx.orm.public.User.create({ email: profile.email, name: profile.name, lastSignInAt: now })).id));
    await db.orm.public.AuthIdentity.create({ userId, provider: 'google', subject: profile.sub, lastUsedAt: now });
  } else {
    await db.orm.public.AuthIdentity.where({ id: identity!.id }).update({ lastUsedAt: now });
  }
  await db.orm.public.User.where({ id: userId }).update({ lastSignInAt: now });
  // With a challenge the app gets a short-lived code to exchange; without one, the token itself.
  if (fromApp) return appReturn(challenge ? { code: mintHandoff(userId, challenge) } : { token: mintSessionToken(userId) });
  await createSession(userId);
  redirect(HOME);
}
