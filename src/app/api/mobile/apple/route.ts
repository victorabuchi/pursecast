import { db } from '../../../../prisma/db';
import { mintSessionToken } from '../../../../lib/auth/session';
import { appleNativeProfile } from '../../../../lib/mobile/apple-native';

// Sign in with Apple from the iPhone app. An account with the same verified
// email is signed in (and remembers Apple from then on); otherwise one is made.
// Apple sends the person's name only the first time, so the app passes it on.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { identityToken?: string; nonce?: string; name?: string };
  const profile = await appleNativeProfile(String(body.identityToken ?? ''), String(body.nonce ?? ''));
  if (!profile) return Response.json({ error: 'Apple sign-in did not finish. Try again.' }, { status: 401 });

  const now = new Date().toISOString();
  const identity = await db.orm.public.AuthIdentity.where({ provider: 'apple', subject: profile.sub }).first();
  let userId = identity?.userId ?? null;
  if (!userId) {
    const existing = await db.orm.public.User.where({ email: profile.email }).first();
    const name = String(body.name ?? '').trim() || profile.email.split('@')[0] || 'You';
    userId = existing ? existing.id : (await db.orm.public.User.create({ email: profile.email, name: name.slice(0, 80), lastSignInAt: now })).id;
    await db.orm.public.AuthIdentity.create({ userId, provider: 'apple', subject: profile.sub, lastUsedAt: now });
  } else {
    await db.orm.public.AuthIdentity.where({ id: identity!.id }).update({ lastUsedAt: now });
  }
  await db.orm.public.User.where({ id: userId }).update({ lastSignInAt: now });
  return Response.json({ token: mintSessionToken(userId) });
}
