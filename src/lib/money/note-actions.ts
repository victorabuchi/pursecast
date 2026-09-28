'use server';

import { db } from '../../prisma/db';
import { backTo, cents, day, done, str } from './act';
import { exact } from './format';
import { validAudio } from './notes';
import { getMe } from './load';

export async function createNoteAction(formData: FormData) {
  const me = await getMe();
  const text = str(formData, 'text', 280);
  const audio = String(formData.get('audio') ?? '');
  if (!text) done('/worth-it?note=1', 'Write what future you should hear.', 'error');
  if (audio && !validAudio(audio)) done('/worth-it?note=1', 'That recording is too long. Keep it under a minute.', 'error');
  const categoryId = str(formData, 'categoryId', 40);
  const cat = categoryId ? await db.orm.public.Category.where({ id: categoryId, userId: me.id }).first() : null;
  const until = day(formData, 'until');
  if (until && until < me.today) done('/worth-it?note=1', 'Pick an end date in the future.', 'error');
  if ((await db.orm.public.FutureNote.where({ userId: me.id }).all()).length >= 20) done('/worth-it', 'You have 20 notes. Remove one first.', 'error');
  await db.orm.public.FutureNote.create({ userId: me.id, text, audio: audio || null, categoryId: cat?.id ?? null, until });
  done('/worth-it', 'Note saved for future you');
}

export async function deleteNoteAction(formData: FormData) {
  const me = await getMe();
  await db.orm.public.FutureNote.where({ id: str(formData, 'id', 40), userId: me.id }).delete();
  done('/worth-it', 'Note removed');
}

// The person listened and decided not to buy.
export async function skipSpendAction(formData: FormData) {
  const me = await getMe();
  const note = await db.orm.public.FutureNote.where({ id: str(formData, 'note', 40), userId: me.id }).first();
  const amount = cents(formData, 'amount') ?? 0;
  if (note) await db.orm.public.FutureNote.where({ id: note.id, userId: me.id }).update({ skipped: note.skipped + 1, saved: note.saved + amount });
  done(backTo(formData, '/spending'), amount ? `Skipped · ${exact(amount, me.currency)} kept for future you` : 'Skipped');
}

// The floating note saves itself while typing; returns when it was saved.
export async function saveNotepadAction(text: string): Promise<string> {
  const me = await getMe();
  const notepadAt = new Date().toISOString();
  await db.orm.public.User.where({ id: me.id }).update({ notepad: String(text).slice(0, 20000), notepadAt });
  return notepadAt;
}
