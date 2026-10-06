import 'server-only';
import { createHash, createPublicKey, verify } from 'node:crypto';

// Sign in with Apple from the iPhone app. Apple gives the app a signed identity
// token for the app itself (its audience is the bundle id, not the web's
// Services ID), which is checked here against Apple's published keys.
const APP_ID = () => process.env['APPLE_APP_ID'] || 'com.pursecast.app';

type Jwk = { kid: string; kty: string; n: string; e: string };
let keys: { at: number; list: Jwk[] } | null = null;

async function appleKeys(): Promise<Jwk[]> {
  if (keys && Date.now() - keys.at < 3_600_000) return keys.list;
  const res = await fetch('https://appleid.apple.com/auth/keys', { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error('Apple keys unavailable');
  const { keys: list } = (await res.json()) as { keys: Jwk[] };
  keys = { at: Date.now(), list };
  return list;
}

export type NativeAppleProfile = { sub: string; email: string };

// `nonce` is the raw value the app made up; Apple puts its SHA-256 in the token.
export async function appleNativeProfile(identityToken: string, nonce: string): Promise<NativeAppleProfile | null> {
  const [h, p, s] = identityToken.split('.');
  if (!h || !p || !s || !nonce) return null;
  try {
    const head = JSON.parse(Buffer.from(h, 'base64url').toString('utf8')) as { kid?: string; alg?: string };
    if (head.alg !== 'RS256') return null;
    const jwk = (await appleKeys()).find((k) => k.kid === head.kid);
    if (!jwk) return null;
    const ok = verify('RSA-SHA256', Buffer.from(`${h}.${p}`), createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(s, 'base64url'));
    if (!ok) return null;
    const c = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')) as { sub?: string; email?: string; email_verified?: boolean | string; aud?: string; iss?: string; exp?: number; nonce?: string };
    if (c.iss !== 'https://appleid.apple.com' || c.aud !== APP_ID() || !c.sub || !c.email || typeof c.exp !== 'number' || c.exp * 1000 < Date.now()) return null;
    if (c.email_verified !== true && c.email_verified !== 'true') return null;
    if (c.nonce !== createHash('sha256').update(nonce).digest('hex')) return null;
    return { sub: c.sub, email: c.email.toLowerCase() };
  } catch {
    return null;
  }
}
