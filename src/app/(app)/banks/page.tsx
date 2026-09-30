import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '../../../components/app/app.module.css';
import I from '../../../components/app/Icon';
import PageHead from '../../../components/app/PageHead';
import Submit from '../../../components/app/Submit';
import BankPicker from '../../../components/app/BankPicker';
import BankRole from '../../../components/app/BankRole';
import { db } from '../../../prisma/db';
import { getMe } from '../../../lib/money/load';
import { ago, short, todayIn } from '../../../lib/money/dates';
import { exact } from '../../../lib/money/format';
import { application, bankReady, bankSetupProblem } from '../../../lib/bank/enable';
import { disconnectBankAction, syncBankAction } from '../../../lib/bank/actions';

export const metadata: Metadata = { title: 'Banks', robots: { index: false } };

const ZONE_COUNTRY: Record<string, string> = {
  'Europe/Helsinki': 'FI',
  'Europe/Stockholm': 'SE',
  'Europe/Oslo': 'NO',
  'Europe/Copenhagen': 'DK',
  'Europe/Berlin': 'DE',
  'Europe/Paris': 'FR',
  'Europe/Madrid': 'ES',
  'Europe/Lisbon': 'PT',
  'Europe/Warsaw': 'PL',
};

// Whole days until an ISO time (negative once it has passed).
function daysUntil(iso: string): number {
  return Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000);
}

// Connected banks: balances and transactions that update by themselves.
export default async function BanksPage({ searchParams }: PageProps<'/banks'>) {
  const params = await searchParams;
  const me = await getMe();
  const ready = bankReady();
  const [links, accounts, app] = await Promise.all([
    db.orm.public.BankLink.where({ userId: me.id }).where((l) => l.status.neq('pending')).orderBy((l) => l.createdAt.asc()).all(),
    db.orm.public.BankAccount.where({ userId: me.id }).orderBy((a) => a.createdAt.asc()).all(),
    ready ? application().then((a) => ({ environment: a.environment, error: '' })).catch((e: unknown) => ({ environment: null, error: e instanceof Error ? e.message : 'Enable Banking could not be reached.' })) : Promise.resolve({ environment: null, error: '' }),
  ]);
  const adding = Boolean(params['add']) || links.length === 0;

  return (
    <>
      <PageHead
        title="Banks"
        sub="Balances and transactions, by themselves"
        icon="bank"
        right={
          links.length > 0 && !adding ? (
            <Link href="/banks?add=1" className={`${styles.btn} ${styles.btnSmall}`}>
              <I d="plus" size={14} stroke={2.6} /> Connect a bank
            </Link>
          ) : null
        }
      />

      {!ready && (
        <div className={styles.card}>
          <strong className={styles.cardTitle}>Bank connections are not set up yet</strong>
          <p className={styles.note}>{bankSetupProblem()} Until then, upload statements or exports on the Statements page.</p>
        </div>
      )}

      {ready && app.error && (
        <div className={styles.card} style={{ borderColor: 'var(--neg-line)' }}>
          <strong className={styles.cardTitle}>Enable Banking did not accept the server&rsquo;s key</strong>
          <p className={styles.note}>
            {app.error}. Check that ENABLE_BANKING_APP_ID and the private key on the server belong to the same application (the key file named after the ID).
          </p>
        </div>
      )}

      {ready && app.environment === 'SANDBOX' && (
        <p className={styles.sandboxNote}>
          <I d="bulb" size={15} /> Test mode: these are practice banks with made-up money. Try <b>S-Pankki</b> and sign in as <b>customera</b>, password <b>12345678</b>.
        </p>
      )}

      {ready && adding && (
        <section className={styles.card} aria-label="Connect a bank">
          <div className={styles.cardHead}>
            <span>
              <strong className={styles.cardTitle}>Connect your bank</strong>
              <span className={styles.cardSub} style={{ display: 'block' }}>
                Your balance and transactions come in by themselves. Read-only: Pursecast can never move money.
              </span>
            </span>
            {links.length > 0 && (
              <Link href="/banks" className={styles.linkBtn}>
                Cancel
              </Link>
            )}
          </div>
          <BankPicker country={ZONE_COUNTRY[me.timezone] ?? 'FI'} />
        </section>
      )}

      {links.map((l) => {
        const mine = accounts.filter((a) => a.linkId === l.id);
        const daysLeft = l.validUntil ? daysUntil(l.validUntil) : null;
        const expired = l.status === 'expired' || (daysLeft !== null && daysLeft <= 0);
        return (
          <section key={l.id} className={styles.card} aria-label={l.aspspName}>
            <div className={styles.bankHead}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {l.logo ? <img src={l.logo} alt="" className={styles.bankLogo} /> : <span className={styles.bankLogo} />}
              <span>
                <strong>{l.aspspName}</strong>
                <small>
                  {expired ? 'Connection ended · connect again to keep it updated' : l.status === 'error' ? (l.error ?? 'The last update failed') : l.lastSyncAt ? `Updated ${ago(todayIn(me.timezone, new Date(l.lastSyncAt)), me.today)}` : 'Connected'}
                  {!expired && daysLeft !== null ? ` · access until ${short(l.validUntil!.slice(0, 10))}${daysLeft <= 14 ? ` (${daysLeft} days)` : ''}` : ''}
                </small>
              </span>
              <span className={styles.bankActions}>
                {expired ? (
                  <Link href="/banks?add=1" className={`${styles.btn} ${styles.btnSmall}`}>
                    Connect again
                  </Link>
                ) : (
                  <form action={syncBankAction}>
                    <input type="hidden" name="id" value={l.id} />
                    <Submit className={`${styles.btnGhost} ${styles.btnSmall}`} pending="Updating…">
                      <I d="refresh" size={14} /> Update now
                    </Submit>
                  </form>
                )}
                <form action={disconnectBankAction}>
                  <input type="hidden" name="id" value={l.id} />
                  <Submit className={styles.linkBtn} pending="…">
                    Disconnect
                  </Submit>
                </form>
              </span>
            </div>
            {mine.map((a) => (
              <div key={a.id} className={styles.bankAcc} data-off={a.role === 'off' || undefined}>
                <span>
                  <b>{a.name}</b>
                  <small>
                    {a.iban ? `•• ${a.iban.replace(/\s/g, '').slice(-4)} · ` : ''}
                    {a.currency}
                  </small>
                </span>
                <b className={styles.num}>{a.balance !== null ? exact(a.balance, a.currency) : '—'}</b>
                <BankRole id={a.id} role={a.role} name={a.name} />
              </div>
            ))}
            {mine.length === 0 && <p className={styles.note}>No accounts were shared. Connect again and choose the accounts to share.</p>}
          </section>
        );
      })}

      {links.length > 0 && (
        <p className={styles.note} style={{ textAlign: 'center' }}>
          The main account sets the balance Money Weather starts from. Transactions go to <Link href="/statements">Statements</Link>, where regular charges can become subscriptions in one tap. Banks update a few times a day.
        </p>
      )}
    </>
  );
}
