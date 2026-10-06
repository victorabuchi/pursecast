import { db } from '../../../../prisma/db';
import { hashPassword, MIN_PASSWORD_LENGTH } from '../../../../lib/auth/password';
import { mintSessionToken } from '../../../../lib/auth/session';

// Sign-up for the mobile app: the same rules as the signup page.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { name?: string; email?: string; password?: string };
  const name = String(body.name ?? '').trim().slice(0, 80);
  const email = String(body.email ?? '').trim().toLowerCase().slice(0, 254);
  const password = String(body.password ?? '');
  if (!name || !email.includes('@')) return Response.json({ error: 'Enter your name and email address.' }, { status: 400 });
  if (password.length < MIN_PASSWORD_LENGTH) return Response.json({ error: `Use a password of at least ${MIN_PASSWORD_LENGTH} characters.` }, { status: 400 });
  if (await db.orm.public.User.where({ email }).first()) return Response.json({ error: 'There is already an account with this email. Log in instead, or ask for a sign-in link.' }, { status: 409 });

  const secretHash = await hashPassword(password);
  const now = new Date().toISOString();
  try {
    const userId = await db.transaction(async (tx) => {
      const user = await tx.orm.public.User.create({ email, name, lastSignInAt: now });
      await tx.orm.public.AuthIdentity.create({ userId: user.id, provider: 'password', subject: email, secretHash, lastUsedAt: now });
      return user.id;
    });
    return Response.json({ token: mintSessionToken(userId) });
  } catch {
    // Most likely the same email signing up twice at once.
    return Response.json({ error: 'There is already an account with this email. Log in instead, or ask for a sign-in link.' }, { status: 409 });
  }
}
