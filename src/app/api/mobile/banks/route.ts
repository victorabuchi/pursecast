import { db } from '../../../../prisma/db';
import { getMe } from '../../../../lib/money/load';
import { application, bankReady, bankSetupProblem } from '../../../../lib/bank/enable';
import { redirectOf, redirectResponse } from '../../../../lib/mobile/redirect';

// What the Banks screen shows: the same loads as the web page.
export async function GET() {
  try {
    const me = await getMe();
    const ready = bankReady();
    const [links, accounts, app] = await Promise.all([
      db.orm.public.BankLink.where({ userId: me.id }).where((l) => l.status.neq('pending')).orderBy((l) => l.createdAt.asc()).all(),
      db.orm.public.BankAccount.where({ userId: me.id }).orderBy((a) => a.createdAt.asc()).all(),
      ready ? application().then((a) => ({ environment: a.environment, error: '' })).catch((e: unknown) => ({ environment: null, error: e instanceof Error ? e.message : 'Enable Banking could not be reached.' })) : Promise.resolve({ environment: null, error: '' }),
    ]);
    return Response.json({
      me: { id: me.id, timezone: me.timezone, today: me.today },
      ready,
      setupProblem: ready ? '' : bankSetupProblem(),
      app,
      links: links.map((l) => ({ id: l.id, aspspName: l.aspspName, logo: l.logo, status: l.status, error: l.error, lastSyncAt: l.lastSyncAt, validUntil: l.validUntil })),
      accounts: accounts.map((a) => ({ id: a.id, linkId: a.linkId, name: a.name, iban: a.iban, currency: a.currency, balance: a.balance, role: a.role })),
    });
  } catch (error) {
    const redirected = redirectOf(error);
    if (redirected) return redirectResponse(redirected);
    throw error;
  }
}
