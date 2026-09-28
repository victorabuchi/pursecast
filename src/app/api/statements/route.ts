import { db } from '../../../prisma/db';
import { getViewer } from '../../../lib/auth/viewer';
import { todayIn } from '../../../lib/money/dates';
import { readUpload } from '../../../lib/statements/read';
import { txnKey } from '../../../lib/statements/analysis';
import type { Txn } from '../../../lib/statements/types';

// Reading a long PDF can take a while.
export const maxDuration = 300;

const MAX_FILES = 10;
const MAX_BYTES = 20 * 1024 * 1024;

// Upload statements, screenshots or exports. Adds to an existing set when
// statementId is given, else starts a new one. Transactions already imported
// are skipped, so the same file twice does not double anything.
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  const user = await db.orm.public.User.where({ id: viewer.id }).first();
  if (!user) return Response.json({ error: 'Sign in first.' }, { status: 401 });

  const form = await request.formData();
  const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return Response.json({ error: 'Choose a file first.' }, { status: 400 });
  if (files.length > MAX_FILES) return Response.json({ error: `Up to ${MAX_FILES} files at a time.` }, { status: 400 });
  const tooBig = files.find((f) => f.size > MAX_BYTES);
  if (tooBig) return Response.json({ error: `${tooBig.name} is over 20 MB. Split it into smaller files.` }, { status: 400 });

  const today = todayIn(user.timezone);
  const notes: string[] = [];
  const read: Txn[] = [];
  for (const file of files) {
    try {
      const res = await readUpload({ name: file.name, type: file.type, bytes: Buffer.from(await file.arrayBuffer()) }, today);
      read.push(...res.txns);
      if (res.note) notes.push(res.note);
    } catch {
      notes.push(`${file.name} could not be read. Try again, or a clearer screenshot.`);
    }
  }

  const existingId = String(form.get('statementId') ?? '');
  const statement = existingId ? await db.orm.public.Statement.where({ id: existingId, userId: user.id }).first() : null;
  const known = new Set((await db.orm.public.StatementTxn.where({ userId: user.id }).select('date', 'amount', 'place').all()).map(txnKey));
  const fresh = read.filter((t) => !known.has(txnKey(t)));
  if (!fresh.length) {
    return Response.json({ statementId: statement?.id ?? null, added: 0, skipped: read.length, notes: notes.length ? notes : [read.length ? 'Everything in that file was already imported.' : 'No transactions were found in that file.'] });
  }

  const name = files.length === 1 ? files[0]!.name.replace(/\.[a-z0-9]+$/i, '') : `${files.length} files`;
  const target = statement ?? (await db.orm.public.Statement.create({ userId: user.id, name: name.slice(0, 80) }));
  await db.orm.public.StatementTxn.createAll(fresh.map((t) => ({ ...t, statementId: target.id, userId: user.id })));
  return Response.json({ statementId: target.id, added: fresh.length, skipped: read.length - fresh.length, notes });
}
