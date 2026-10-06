import { mintSessionToken } from '../../../../lib/auth/session';
import { redeemHandoff } from '../../../../lib/mobile/handoff';
import { db } from '../../../../prisma/db';

// The app swaps the code a browser sign-in handed it (with the verifier it kept)
// for its session token.
export async function POST(request: Request) {
  const { code, verifier } = (await request.json().catch(() => ({}))) as { code?: string; verifier?: string };
  const userId = code && verifier ? redeemHandoff(String(code), String(verifier)) : null;
  if (!userId || !(await db.orm.public.User.where({ id: userId }).first())) return Response.json({ error: 'That sign-in did not finish. Try again.' }, { status: 401 });
  return Response.json({ token: mintSessionToken(userId) });
}
