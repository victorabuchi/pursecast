import { getViewer } from '../../../../lib/auth/viewer';
import { db } from '../../../../prisma/db';

// Who the app is signed in as, and whether first-time setup is done.
export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  const user = await db.orm.public.User.where({ id: viewer.id }).first();
  if (!user) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  return Response.json({ id: user.id, name: user.name, email: user.email, currency: user.currency, setUp: user.balance !== null });
}
