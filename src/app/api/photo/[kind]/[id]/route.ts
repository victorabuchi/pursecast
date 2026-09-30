import { db } from '../../../../../prisma/db';
import { getViewer } from '../../../../../lib/auth/viewer';

// A person's own pictures only. Cached for a year: the link changes (?v=)
// whenever the picture does.
export async function GET(_request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return new Response('Sign in first', { status: 401 });
  const { kind, id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('Not found', { status: 404 });
  const data =
    kind === 'user'
      ? id === viewer.id
        ? (await db.orm.public.User.where({ id }).select('photo').first())?.photo
        : null
      : kind === 'wish'
        ? (await db.orm.public.WishItem.where({ id, userId: viewer.id }).select('photo').first())?.photo
        : kind === 'debt'
          ? (await db.orm.public.Debt.where({ id, userId: viewer.id }).select('photo').first())?.photo
          : null;
  const m = data ? /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(data) : null;
  if (!m) return new Response('Not found', { status: 404 });
  return new Response(Buffer.from(m[2]!, 'base64'), {
    headers: { 'Content-Type': m[1]!, 'Cache-Control': 'private, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' },
  });
}
