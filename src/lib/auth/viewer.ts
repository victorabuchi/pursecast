import { cache } from 'react';
import { redirect } from 'next/navigation';
import { db } from '../../prisma/db';
import { readSession } from './session';

export type Viewer = { id: string; name: string; email: string; currency: string };

// Who is signed in. A session for a deleted account counts as signed out.
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await readSession();
  if (!session) return null;
  const user = await db.orm.public.User.where({ id: session.userId }).first();
  return user ? { id: user.id, name: user.name, email: user.email, currency: user.currency } : null;
});

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect('/login');
  return viewer;
}
