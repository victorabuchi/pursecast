import { db } from '../../../../prisma/db';
import { getViewer } from '../../../../lib/auth/viewer';
import { isExpoToken } from '../../../../lib/push';

// The phone app turns notifications on or off: it registers its Expo push
// token, which pushTo then sends to (see lib/push.ts).
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  const { token } = (await request.json().catch(() => ({}))) as { token?: string };
  if (!token || !isExpoToken(token) || token.length > 200) return Response.json({ error: 'That device could not be set up.' }, { status: 400 });
  await db.orm.public.PushSub.where({ userId: viewer.id, endpoint: token }).deleteAll();
  await db.orm.public.PushSub.create({ userId: viewer.id, endpoint: token, p256dh: 'expo', auth: 'expo' });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  const { token } = (await request.json().catch(() => ({}))) as { token?: string };
  if (token) await db.orm.public.PushSub.where({ userId: viewer.id, endpoint: String(token).slice(0, 200) }).deleteAll();
  return Response.json({ ok: true });
}
