// End to end setup checks against a running dev server (npm run dev): signs up
// a scratch account, saves setup through the real form, then checks what was
// stored and what the pages show. Covers the things that broke before: an
// advance bigger than the pay, a subscription billed in dollars, an extra
// account, a subscription with no price or date. Deletes the account after.
// Usage: npx tsx scripts/e2e-setup.ts
import { request } from 'node:http';
import { randomUUID } from 'node:crypto';
import { db } from '../src/prisma/db';
import { addDays, addMonths, monthStart, todayIn } from '../src/lib/money/dates';

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
        const session = (res.headers['set-cookie'] ?? []).find((c) => c.startsWith('pursecast_session='));
        resolve({ status: res.statusCode ?? 0, location: String(res.headers['location'] ?? ''), cookie: session ? session.split(';')[0]! : null, body: Buffer.concat(chunks).toString('utf8') });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// The action of the form that holds a given field.
function actionFor(html: string, field: string): string | undefined {
  const at = html.indexOf(`name="${field}"`);
  return [...html.slice(0, at).matchAll(/name="(\$ACTION_ID_[0-9a-f]+)"/g)].pop()?.[1];
}

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || !detail ? '' : `: ${detail}`}`);
  if (!ok) failures += 1;
}

const tag = randomUUID().slice(0, 8);
const email = `e2e-setup-${tag}@example.test`;
const password = `Pw-${randomUUID()}`;
const today = todayIn('Europe/Helsinki');
const payday = monthStart(addMonths(today, 1));

try {
  const signup = await http('GET', '/signup');
  const signUpAction = [...signup.body.matchAll(/name="(\$ACTION_ID_[0-9a-f]+)"/g)][0]?.[1];
  const created = await http('POST', '/signup', { form: { [signUpAction!]: '', name: 'Setup Check', email, password } });
  const cookie = created.cookie;
  check('scratch account signs up', Boolean(cookie), created.location);

  const setup = await http('GET', '/setup', { cookie });
  const save = actionFor(setup.body, 'balance');
  check('setup page has the form', Boolean(save));

  const saved = await http('POST', '/setup', {
    cookie,
    form: {
      [save!]: '',
      balance: '1000',
      balanceSign: '+',
      currency: 'EUR',
      salaryName: 'Salary',
      salary: '2000',
      salaryDate: payday,
      rent: '800',
      rentDate: payday,
      subName0: 'Render',
      subAmount0: '25',
      subAmount0Currency: 'USD',
      subCadence0: 'monthly',
      subDate0: addDays(today, 5),
      subName1: 'Supabase',
      subAmount1: '',
      subCadence1: 'monthly',
      subDate1: '',
      advAmount0: '5000',
      advDate0: addDays(today, 10),
      accName0: 'Travel card',
      accKind0: 'card',
      accAmount0: '100',
      accAmount0Currency: 'USD',
      accCount0: 'on',
      accName1: 'Savings',
      accKind1: 'savings',
      accAmount1: '3000',
    },
  });
  check('saving setup goes to the forecast', saved.location.startsWith('/forecast'), `${saved.status} ${saved.location}`);

  const user = await db.orm.public.User.where({ email }).first();
  const recurring = user ? await db.orm.public.Recurring.where({ userId: user.id }).all() : [];
  const render = recurring.find((r) => r.name === 'Render');
  check('a dollar subscription keeps its price in dollars', render?.priceCurrency === 'USD' && render.priceAmount === 2500, JSON.stringify(render));
  check('and counts in euros at today’s rate', Boolean(render && render.amount < 0 && render.amount > -2500), String(render?.amount));
  const supabase = recurring.find((r) => r.name === 'Supabase');
  check('a subscription with no price or date is kept as varies', Boolean(supabase?.variable), JSON.stringify(supabase));
  const advances = user ? await db.orm.public.SalaryAdvance.where({ userId: user.id }).all() : [];
  check('an advance bigger than the pay is still saved', advances.length === 1 && advances[0]!.amount === 500000, JSON.stringify(advances));
  const accounts = user ? await db.orm.public.Account.where({ userId: user.id }).all() : [];
  const card = accounts.find((a) => a.name === 'Travel card');
  const savings = accounts.find((a) => a.name === 'Savings');
  check('other accounts are saved in their own currency', card?.currency === 'USD' && card.balance === 10000 && card.inForecast && savings?.inForecast === false, JSON.stringify(accounts));

  const again = await http('GET', '/setup', { cookie });
  check('setup shows the advance again', again.body.includes('value="5000"'));
  check('setup shows the subscription in dollars', /name="subAmount\d"[^>]*value="25"/.test(again.body) || /value="25"[^>]*name="subAmount\d"/.test(again.body));
  check('setup shows the accounts again', again.body.includes('value="Travel card"') && again.body.includes('value="Savings"'));

  const forecast = await http('GET', '/forecast', { cookie });
  check('the forecast loads', forecast.status === 200, String(forecast.status));
  check('the forecast lists the counted card and the savings', forecast.body.includes('Travel card') && forecast.body.includes('(not counted)'));

  const plan = await http('GET', '/plan', { cookie });
  check('the plan page with the payday list loads', plan.status === 200 && plan.body.includes('When money lands'), String(plan.status));
} finally {
  await db.orm.public.User.where({ email }).delete();
}
console.log(failures ? `${failures} failed` : 'all passed');
process.exit(failures ? 1 : 0);
