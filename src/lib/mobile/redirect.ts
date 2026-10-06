// The web's server code answers with redirect(); these helpers turn that into
// something JSON can carry.

export type Redirected = { path: string; toast?: string; error?: string; params: Record<string, string>; url: string };

export function redirectOf(error: unknown): Redirected | null {
  const digest = (error as { digest?: unknown } | null)?.digest;
  if (typeof digest !== 'string' || !digest.startsWith('NEXT_REDIRECT')) return null;
  const url = digest.split(';')[2] ?? '/';
  const [path = '/', query = ''] = url.split('#')[0]!.split('?');
  const search = new URLSearchParams(query);
  return { path, toast: search.get('toast') ?? undefined, error: search.get('error') ?? undefined, params: Object.fromEntries(search), url };
}

// A redirect to the login or setup page becomes a status the app understands.
export function redirectResponse(r: Redirected): Response {
  if (r.path === '/login') return Response.json({ error: 'Sign in first.' }, { status: 401 });
  if (r.path === '/setup' && !r.toast && !r.error) return Response.json({ setup: true }, { status: 409 });
  return Response.json({ ok: !r.error, redirect: r }, { status: r.error ? 400 : 200 });
}
