import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { appleAuthUrl, appleReady } from '../../../lib/auth/apple';
import { requestOrigin } from '../../../lib/auth/origin';
import { appReturn } from '../../../lib/mobile/handoff';

// Sends the person to Apple. Apple answers with a cross-site POST, so the
// state cookie must be SameSite=None to come back with it.
// The phone app (Android) opens this with ?intent=mobile and a PKCE &challenge=…
// and gets the answer back at pursecast://auth (see mobile/handoff.ts).
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const challenge = params.get('intent') === 'mobile' ? (params.get('challenge') ?? '').slice(0, 100) : null;
  if (!appleReady()) return challenge !== null ? appReturn({ error: 'Apple sign-in did not finish. Try again.' }) : redirect('/login?error=apple');
  const state = `${challenge !== null ? 'app.' : ''}${randomBytes(24).toString('base64url')}`;
  const jar = await cookies();
  const options = { httpOnly: true, secure: true, sameSite: 'none', path: '/auth/apple', maxAge: 600 } as const;
  jar.set('pursecast_apple', state, options);
  if (challenge !== null) jar.set('pursecast_apple_app', challenge, options);
  redirect(appleAuthUrl(await requestOrigin(), state));
}
