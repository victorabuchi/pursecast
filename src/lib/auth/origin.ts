import { headers } from 'next/headers';

// Absolute origin of the current request, for links sent by email. After a
// server action redirect Next renders through an internal request whose Host is
// the bare server address, keeping the real one in X-Forwarded-Host.
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host')?.split(',')[0]?.trim() || h.get('host') || 'localhost:3000';
  const proto = h.get('x-forwarded-proto')?.split(',')[0]?.trim() || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  return `${proto}://${host}`;
}
