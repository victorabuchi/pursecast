import { db } from '../../../../prisma/db';
import { getViewer } from '../../../../lib/auth/viewer';

// One of the person's own note attachments. Files never change, so they are cached.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return new Response('Sign in first', { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('Not found', { status: 404 });
  const f = await db.orm.public.NoteFile.where({ id, userId: viewer.id }).first();
  if (!f) return new Response('Not found', { status: 404 });
  const inline = ['image', 'video', 'audio', 'sketch'].includes(f.kind) && !/svg|html|xml/i.test(f.mime);
  return new Response(Buffer.from(f.data, 'base64'), {
    headers: {
      'Content-Type': inline ? f.mime : 'application/octet-stream',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(f.name)}"`,
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
