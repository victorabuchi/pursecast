import type { Metadata, Viewport } from 'next';
import { getMe } from '../../lib/money/load';
import NoteWindow from './NoteWindow';

export const metadata: Metadata = { title: 'Note', robots: { index: false } };
// No zooming when a field is focused: the page lives inside the app's window.
export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, viewportFit: 'cover' };

// The signed-in person's note on a page of its own, opened inside the phone
// app (signed in with its token). Anyone else is sent to the login page.
export default async function NoteWindowPage() {
  const me = await getMe();
  return <NoteWindow initial={me.notepad} savedAt={me.notepadAt} />;
}
