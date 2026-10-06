import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

// How a phone app finishes a sign-in made in the browser. The browser flow ends
// by handing the app a short-lived code; the app swaps it for its session
// token. The code is bound to a challenge the app made up front (PKCE), so
// another app that catches the pursecast:// address cannot use it.

const MINUTES = 2;

function secret(): string {
  const value = process.env['SESSION_SECRET'];
  if (!value || value.length < 32) throw new Error('SESSION_SECRET must be set (32+ characters)');
  return value;
}

const sign = (data: string) => createHmac('sha256', secret()).update(`handoff.${data}`).digest('base64url');

export function mintHandoff(userId: string, challenge: string): string {
  const data = Buffer.from(JSON.stringify({ u: userId, c: challenge, e: Date.now() + MINUTES * 60_000 })).toString('base64url');
  return `${data}.${sign(data)}`;
}

// The person the code was made for, when the verifier matches the challenge.
export function redeemHandoff(code: string, verifier: string): string | null {
  const [data, signature] = code.split('.');
  if (!data || !signature || verifier.length < 32) return null;
  const a = Buffer.from(signature);
  const b = Buffer.from(sign(data));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as { u?: string; c?: string; e?: number };
    if (typeof payload.u !== 'string' || typeof payload.c !== 'string' || typeof payload.e !== 'number' || payload.e < Date.now()) return null;
    const expected = createHash('sha256').update(verifier).digest('base64url');
    const x = Buffer.from(expected);
    const y = Buffer.from(payload.c);
    return x.length === y.length && timingSafeEqual(x, y) ? payload.u : null;
  } catch {
    return null;
  }
}

// Where the browser sends the person back to the app.
// (A 303 after Apple's cross-site POST, so the browser follows with a GET.)
export function appReturn(params: Record<string, string>, status: 302 | 303 = 302): Response {
  return new Response(null, { status, headers: { Location: `pursecast://auth?${new URLSearchParams(params)}` } });
}
