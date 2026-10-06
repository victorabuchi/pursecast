import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { googleAuthUrl, googleReady } from '../../../lib/auth/google';
import { requestOrigin } from '../../../lib/auth/origin';

// Sends the person to Google. The state cookie proves the answer comes back
// to the same browser.
export async function GET() {
  if (!googleReady()) redirect('/login?error=google');
  const state = randomBytes(24).toString('base64url');
  (await cookies()).set('pursecast_google', state, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/auth/google', maxAge: 600 });
  redirect(googleAuthUrl(await requestOrigin(), state));
}
