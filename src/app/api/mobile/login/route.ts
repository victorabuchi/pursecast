import { db } from '../../../../prisma/db';
import { burnPasswordCheck, verifyPassword } from '../../../../lib/auth/password';
import { mintSessionToken } from '../../../../lib/auth/session';
import { clearFailures, isThrottled, recordFailure } from '../../../../lib/auth/throttle';

// Password sign-in for the mobile app: the same checks as the login page,
// answering with a bearer token instead of setting a cookie.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = String(body.email ?? '').trim().toLowerCase().slice(0, 254);
  const password = String(body.password ?? '');
  if (!email || !password) return Response.json({ error: 'Enter your email address, and your password to sign in with one.' }, { status: 400 });
  if (isThrottled(email)) return Response.json({ error: 'Too many attempts. Wait a few minutes, or sign in with an email link.' }, { status: 429 });

  const identity = await db.orm.public.AuthIdentity.where({ provider: 'password', subject: email }).first();
  if (!identity) await burnPasswordCheck(password);
  if (identity && (await verifyPassword(password, identity.secretHash))) {
    clearFailures(email);
    const now = new Date().toISOString();
    await db.orm.public.AuthIdentity.where({ id: identity.id }).update({ lastUsedAt: now });
    await db.orm.public.User.where({ id: identity.userId }).update({ lastSignInAt: now });
    return Response.json({ token: mintSessionToken(identity.userId) });
  }

  recordFailure(email);
  return Response.json({ error: 'That email and password do not match.' }, { status: 401 });
}
