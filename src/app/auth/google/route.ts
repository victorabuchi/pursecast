import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { googleAuthUrl, googleReady } from '../../../lib/auth/google';
import { requestOrigin } from '../../../lib/auth/origin';
import { appReturn } from '../../../lib/mobile/handoff';

// Sends the person to Google. The state cookie proves the answer comes back
// to the same browser.
// The phone app opens this in its sign-in browser with ?intent=mobile (and a
// PKCE &challenge=…); the answer then goes back to the app (mobile/handoff.ts).
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const challenge = params.get('intent') === 'mobile' ? (params.get('challenge') ?? '').slice(0, 100) : null;
  if (!googleReady()) return challenge !== null ? appReturn({ error: 'Google sign-in did not finish. Try again.' }) : redirect('/login?error=google');
  const state = `${challenge !== null ? 'app.' : ''}${randomBytes(24).toString('base64url')}`;
  const jar = await cookies();
  const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/auth/google', maxAge: 600 } as const;
  jar.set('pursecast_google', state, options);
  if (challenge !== null) jar.set('pursecast_google_app', challenge, options);
  redirect(googleAuthUrl(await requestOrigin(), state));
}
