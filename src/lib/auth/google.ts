import 'server-only';

// Sign in with Google (OpenID Connect, authorization code flow). Needs
// GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET; the redirect URI registered at
// Google is <APP_URL>/auth/google/callback.
export const googleReady = () => Boolean(process.env['GOOGLE_CLIENT_ID'] && process.env['GOOGLE_CLIENT_SECRET']);

export function googleRedirect(origin: string): string {
  return `${(process.env['APP_URL'] || origin).replace(/\/$/, '')}/auth/google/callback`;
}

export function googleAuthUrl(origin: string, state: string): string {
  const q = new URLSearchParams({
    client_id: process.env['GOOGLE_CLIENT_ID']!,
    redirect_uri: googleRedirect(origin),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

export type GoogleProfile = { sub: string; email: string; name: string };

// Swaps the code for the person's verified Google profile.
export async function googleProfile(code: string, origin: string): Promise<GoogleProfile | null> {
  const token = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: process.env['GOOGLE_CLIENT_ID']!, client_secret: process.env['GOOGLE_CLIENT_SECRET']!, redirect_uri: googleRedirect(origin), grant_type: 'authorization_code' }),
    signal: AbortSignal.timeout(15000),
  });
  if (!token.ok) return null;
  const { access_token } = (await token.json()) as { access_token?: string };
  if (!access_token) return null;
  const me = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${access_token}` }, signal: AbortSignal.timeout(15000) });
  if (!me.ok) return null;
  const p = (await me.json()) as { sub?: string; email?: string; email_verified?: boolean; name?: string; given_name?: string };
  if (!p.sub || !p.email || p.email_verified !== true) return null;
  return { sub: p.sub, email: p.email.toLowerCase(), name: (p.name || p.given_name || p.email.split('@')[0] || 'You').slice(0, 80) };
}
