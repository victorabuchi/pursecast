// End to end sign-in checks against a running dev server (npm run dev), by
// posting the real server action forms over HTTP. Creates scratch accounts and
// deletes them afterwards.
// Usage: npx tsx scripts/e2e-auth.ts
import { request } from 'node:http';
import { randomUUID } from 'node:crypto';
import { db } from '../src/prisma/db';

type Res = { status: number; location: string; cookie: string | null; body: string };

function http(method: 'GET' | 'POST', path: string, opts: { cookie?: string | null; form?: Record<string, string> } = {}): Promise<Res> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { Host: 'localhost:3000', Origin: 'http://localhost:3000' };
    if (opts.cookie) headers['Cookie'] = opts.cookie;
    let body: Buffer | undefined;
    if (opts.form) {
      const boundary = `----pursecast${randomUUID()}`;
      body = Buffer.from(
        Object.entries(opts.form)
          .map(([k, v]) => `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`)
          .join('') + `--${boundary}--\r\n`,
      );
      headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`;
      headers['Content-Length'] = String(body.length);
    }
    const req = request({ hostname: '127.0.0.1', port: 3000, method, path, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const set = res.headers['set-cookie'] ?? [];
        const session = set.find((c) => c.startsWith('pursecast_session='));
        resolve({
          status: res.statusCode ?? 0,
          location: String(res.headers['location'] ?? ''),
          cookie: session ? session.split(';')[0]! : null,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function actionIds(html: string): string[] {
  return [...html.matchAll(/name="(\$ACTION_ID_[0-9a-f]+)"/g)].map((m) => m[1]!);
}

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || !detail ? '' : `: ${detail}`}`);
  if (!ok) failures += 1;
}

const tag = randomUUID().slice(0, 8);
const email = `e2e-${tag}@example.test`;
const password = `Pw-${randomUUID()}`;

try {
  // Sign up.
  const signup = await http('GET', '/signup');
  const [signUpAction] = actionIds(signup.body);
  check('signup page has a form', Boolean(signUpAction));
  const short = await http('POST', '/signup', { form: { [signUpAction!]: '', name: 'E2E', email, password: 'short' } });
  check('short password is refused', short.location.includes('error=short'), short.location);
  const created = await http('POST', '/signup', { form: { [signUpAction!]: '', name: 'E2E', email, password } });
  check('sign up redirects home', created.location.startsWith('/forecast'), `${created.status} ${created.location}`);
  check('sign up sets a session', Boolean(created.cookie));
  const home = await http('GET', '/forecast', { cookie: created.cookie });
  check('a new account is sent to setup', home.location.startsWith('/setup'), `${home.status} ${home.location}`);
  const setup = await http('GET', '/setup', { cookie: created.cookie });
  check('setup greets the new user', setup.status === 200 && setup.body.includes('E2E'), String(setup.status));
  const again = await http('POST', '/signup', { form: { [signUpAction!]: '', name: 'E2E', email, password } });
  check('the same email cannot sign up twice', again.location.includes('error=taken'), again.location);

  // Signed out.
  const anon = await http('GET', '/forecast');
  check('home requires sign-in', anon.location.startsWith('/login'), `${anon.status} ${anon.location}`);

  // Password sign-in.
  const login = await http('GET', '/login');
  const [passwordAction, linkAction] = actionIds(login.body);
  const wrong = await http('POST', '/login', { form: { [passwordAction!]: '', email, password: 'wrong-password' } });
  check('wrong password is refused', wrong.location.includes('error=invalid') && !wrong.cookie, wrong.location);
  const right = await http('POST', '/login', { form: { [passwordAction!]: '', email: email.toUpperCase(), password } });
  check('right password signs in (email case ignored)', right.location.startsWith('/forecast') && Boolean(right.cookie), right.location);

  // Email link.
  const unknown = await http('POST', '/login', { form: { [linkAction!]: '', email: `nobody-${tag}@example.test` } });
  check('unknown email still says sent', unknown.location.includes('sent=1') && !unknown.location.includes('dev='), unknown.location);
  const sent = await http('POST', '/login', { form: { [linkAction!]: '', email } });
  const link = new URL(sent.location, 'http://x').searchParams.get('dev');
  check('link is issued (shown in development)', Boolean(link), sent.location);
  const token = new URL(link!).searchParams.get('token')!;
  const verify = await http('GET', `/auth/verify?token=${token}`);
  const [consumeAction] = actionIds(verify.body);
  const used = await http('POST', '/auth/verify', { form: { [consumeAction!]: '', token } });
  check('link signs in', used.location.startsWith('/forecast') && Boolean(used.cookie), used.location);
  const reused = await http('POST', '/auth/verify', { form: { [consumeAction!]: '', token } });
  check('link works only once', reused.location.includes('error=link') && !reused.cookie, reused.location);

  // Sign out.
  const signed = await http('GET', '/settings', { cookie: used.cookie });
  const signOut = actionIds(signed.body).find((id, i, all) => all.indexOf(id) === i && signed.body.split(id)[1]!.slice(0, 2000).includes('Log out'));
  const out = await http('POST', '/settings', { cookie: used.cookie, form: { [signOut!]: '' } });
  check('log out clears the session', out.location === '/' && out.cookie === 'pursecast_session=', out.location);
} finally {
  await db.orm.public.LoginToken.where({ email }).deleteAll();
  await db.orm.public.User.where({ email }).delete();
}

console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
