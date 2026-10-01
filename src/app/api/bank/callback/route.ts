import { redirect } from 'next/navigation';
import { db } from '../../../../prisma/db';
import { getViewer } from '../../../../lib/auth/viewer';
import { createSession } from '../../../../lib/bank/enable';
import { syncLink } from '../../../../lib/bank/sync';

// The bank sends the person back here after they approve (or cancel). The
// state ties it to the link started by this person.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get('state') ?? '';
  const code = url.searchParams.get('code');
  const viewer = await getViewer();
  if (!viewer) redirect('/login');
  const link = state ? await db.orm.public.BankLink.where({ userId: viewer.id, state, status: 'pending' }).first() : null;
  const back = (kind: 'toast' | 'error', msg: string) => redirect(`/banks?${kind}=${encodeURIComponent(msg)}`);
  if (!link) back('error', 'That bank connection was not started here. Try again.');
  if (!code) {
    await db.orm.public.BankLink.where({ id: link!.id, userId: viewer.id }).delete();
    back('error', `${link!.aspspName} was not connected. You can try again any time.`);
  }

  let session: Awaited<ReturnType<typeof createSession>>;
  try {
    session = await createSession(code!);
  } catch (e) {
    console.error('Bank session failed', e);
    await db.orm.public.BankLink.where({ id: link!.id, userId: viewer.id }).update({ status: 'error', error: 'The bank did not confirm the connection.' });
    back('error', `${link!.aspspName} did not confirm the connection. Try again.`);
  }

  // The first everyday account becomes the main one, unless one is set.
  const hasMain = Boolean(await db.orm.public.BankAccount.where({ userId: viewer.id, role: 'main' }).first());
  const accounts = session!.accounts ?? [];
  const firstCurrent = accounts.findIndex((a) => !a.cash_account_type || a.cash_account_type === 'CACC');
  await db.orm.public.BankLink.where({ id: link!.id, userId: viewer.id }).update({ sessionId: session!.session_id, status: 'active', validUntil: session!.access?.valid_until ?? null, error: null });
  // Names the person gave before ("Revolut Pro") carry over by account number and currency.
  const given = new Map((await db.orm.public.BankName.where({ userId: viewer.id }).all()).map((n) => [`${n.iban}|${n.currency}`, n.name]));
  if (accounts.length) {
    await db.orm.public.BankAccount.createAll(
      accounts.map((a, i) => ({
        userId: viewer.id,
        linkId: link!.id,
        uid: a.uid,
        name: (given.get(`${a.account_id?.iban ?? ''}|${a.currency || 'EUR'}`) ?? (a.cash_account_type === 'CARD' ? `${a.product || a.name || 'Card'} (card)` : a.product || a.name || a.details || 'Account')).slice(0, 60),
        holder: a.name ?? null,
        iban: a.account_id?.iban ?? null,
        currency: a.currency || 'EUR',
        // The first everyday account is the main one; the rest count in the forecast too
        // (savings stay out until switched on).
        role: !hasMain && i === Math.max(0, firstCurrent) ? 'main' : a.cash_account_type === 'SVGS' ? 'other' : 'counted',
      })),
    );
  }
  const res = await syncLink(viewer.id, link!.id);
  back(res.error ? 'error' : 'toast', res.error ? res.error : `${link!.aspspName} connected · ${accounts.length} ${accounts.length === 1 ? 'account' : 'accounts'}, ${res.added} transactions`);
}
