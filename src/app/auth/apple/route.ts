import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { appleAuthUrl, appleReady } from '../../../lib/auth/apple';
import { requestOrigin } from '../../../lib/auth/origin';

// Sends the person to Apple. Apple answers with a cross-site POST, so the
// state cookie must be SameSite=None to come back with it.
export async function GET() {
  if (!appleReady()) redirect('/login?error=apple');
  const state = randomBytes(24).toString('base64url');
  (await cookies()).set('pursecast_apple', state, { httpOnly: true, secure: true, sameSite: 'none', path: '/auth/apple', maxAge: 600 });
  redirect(appleAuthUrl(await requestOrigin(), state));
}
