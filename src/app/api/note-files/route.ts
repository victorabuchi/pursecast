import { db } from '../../../prisma/db';
import { getViewer } from '../../../lib/auth/viewer';

const MAX = 15 * 1024 * 1024;
const KINDS = ['image', 'video', 'audio', 'sketch', 'file'] as const;

// Adds a photo, video, recording, file or drawing to the person's note.
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File) || !file.size) return Response.json({ error: 'Choose a file.' }, { status: 400 });
  if (file.size > MAX) return Response.json({ error: 'That file is over 15 MB.' }, { status: 400 });
  const asked = String(form.get('kind') ?? '');
  const mime = file.type || 'application/octet-stream';
  const kind = (KINDS as readonly string[]).includes(asked) ? asked : mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : 'file';
  const row = await db.orm.public.NoteFile.create({
    userId: viewer.id,
    kind,
    name: (file.name || kind).slice(0, 120),
    mime: mime.slice(0, 100),
    data: Buffer.from(await file.arrayBuffer()).toString('base64'),
    size: file.size,
  });
  return Response.json({ id: row.id, url: `/api/note-files/${row.id}`, kind, name: row.name, size: row.size });
}
