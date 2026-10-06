import 'server-only';
import { createSign } from 'node:crypto';

// Sign in with Apple for the web. Needs APPLE_CLIENT_ID (the Services ID),
// APPLE_TEAM_ID, APPLE_KEY_ID and APPLE_PRIVATE_KEY (the .p8 key text). The
// return URL registered at Apple is <APP_URL>/auth/apple/callback.
export const appleReady = () => Boolean(process.env['APPLE_CLIENT_ID'] && process.env['APPLE_TEAM_ID'] && process.env['APPLE_KEY_ID'] && process.env['APPLE_PRIVATE_KEY']);

export function appleRedirect(origin: string): string {
  return `${(process.env['APP_URL'] || origin).replace(/\/$/, '')}/auth/apple/callback`;
}

export function appleAuthUrl(origin: string, state: string): string {
  const q = new URLSearchParams({
    client_id: process.env['APPLE_CLIENT_ID']!,
    redirect_uri: appleRedirect(origin),
    response_type: 'code',
    response_mode: 'form_post',
    scope: 'name email',
    state,
  });
  return `https://appleid.apple.com/auth/authorize?${q}`;
}

// Apple's "client secret" is a short-lived token signed with the .p8 key.
function clientSecret(): string {
  const key = process.env['APPLE_PRIVATE_KEY']!.replace(/\\n/g, '\n');
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'ES256', kid: process.env['APPLE_KEY_ID'] });
  const body = b64({ iss: process.env['APPLE_TEAM_ID'], iat: now, exp: now + 300, aud: 'https://appleid.apple.com', sub: process.env['APPLE_CLIENT_ID'] });
  const sig = createSign('SHA256').update(`${head}.${body}`).sign({ key, dsaEncoding: 'ieee-p1363' }, 'base64url');
  return `${head}.${body}.${sig}`;
}

export type AppleProfile = { sub: string; email: string };

// Swaps the code for the person's Apple ID. The token comes straight from
// Apple over TLS, so its claims are read as given.
export async function appleProfile(code: string, origin: string): Promise<AppleProfile | null> {
  const res = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env['APPLE_CLIENT_ID']!, client_secret: clientSecret(), code, grant_type: 'authorization_code', redirect_uri: appleRedirect(origin) }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    console.error('Apple token exchange failed', res.status, (await res.text()).slice(0, 200));
    return null;
  }
  const { id_token } = (await res.json()) as { id_token?: string };
  const payload = id_token?.split('.')[1];
  if (!payload) return null;
  const c = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: string; email?: string; email_verified?: boolean | string; aud?: string; iss?: string };
  if (c.iss !== 'https://appleid.apple.com' || c.aud !== process.env['APPLE_CLIENT_ID'] || !c.sub || !c.email) return null;
  if (c.email_verified !== true && c.email_verified !== 'true') return null;
  return { sub: c.sub, email: c.email.toLowerCase() };
}
