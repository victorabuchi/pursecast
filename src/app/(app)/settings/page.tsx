import type { Metadata } from 'next';
import styles from '../../../components/app/app.module.css';
import PageHead from '../../../components/app/PageHead';
import Submit from '../../../components/app/Submit';
import PhotoInput from '../../../components/app/PhotoInput';
import ThemePicker from '../../../components/app/ThemePicker';
import NotifySettings from '../../../components/app/NotifySettings';
import { pushPublicKey } from '../../../lib/push';
import { emailConfigured } from '../../../lib/email';
import PasswordField from '../../../components/auth/PasswordField';
import { db } from '../../../prisma/db';
import { getMe } from '../../../lib/money/load';
import { MIN_PASSWORD_LENGTH } from '../../../lib/auth/password';
import { changePasswordAction, deleteAccountAction, disconnectCalendarAction, updateProfileAction } from '../../../lib/money/account-actions';
import { signOutAction } from '../../../lib/auth/actions';

export const metadata: Metadata = { title: 'Settings', robots: { index: false } };

const CURRENCIES = ['EUR', 'USD', 'GBP', 'SEK', 'NOK', 'DKK', 'CHF', 'PLN', 'CAD', 'AUD', 'NGN', 'INR', 'JPY'];
const ZONES = ['Europe/Helsinki', 'Europe/Stockholm', 'Europe/Oslo', 'Europe/Copenhagen', 'Europe/Berlin', 'Europe/Paris', 'Europe/Madrid', 'Europe/Lisbon', 'Europe/London', 'Europe/Warsaw', 'Africa/Lagos', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney'];

export default async function SettingsPage() {
  const me = await getMe();
  const [hasPassword, user] = await Promise.all([
    db.orm.public.AuthIdentity.where({ userId: me.id, provider: 'password' }).first().then(Boolean),
    db.orm.public.User.where({ id: me.id }).select('weeklyEmail').first(),
  ]);
  const zones = ZONES.includes(me.timezone) ? ZONES : [me.timezone, ...ZONES];

  return (
    <>
      <PageHead title="Settings" sub="Your account" icon="gear" />
      <div className={styles.split2}>
        <div className={styles.stack}>
          <form action={updateProfileAction} className={styles.card}>
            <strong className={styles.cardTitle}>Profile</strong>
            <PhotoInput current={me.photo} label="Profile picture" round max={240} />
            <label className={styles.field}>
              Name
              <input className={styles.input} name="name" defaultValue={me.name} required maxLength={80} />
            </label>
            <label className={styles.field}>
              Email
              <input className={styles.input} value={me.email} disabled />
            </label>
            <div className={styles.row}>
              <label className={styles.field}>
                Currency
                <select name="currency" className={styles.select} defaultValue={me.currency}>
                  {CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                Time zone
                <select name="timezone" className={styles.select} defaultValue={me.timezone}>
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {z.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <Submit className={styles.btn}>Save profile</Submit>
          </form>

          <form action={changePasswordAction} className={styles.card}>
            <strong className={styles.cardTitle}>{hasPassword ? 'Change password' : 'Set a password'}</strong>
            {!hasPassword && <p className={styles.note}>You sign in with email links. Add a password to sign in without one.</p>}
            {hasPassword && (
              <label className={styles.field}>
                Current password
                <input className={styles.input} type="password" name="current" autoComplete="current-password" required />
              </label>
            )}
            <PasswordField label="New password" hint={`At least ${MIN_PASSWORD_LENGTH} characters.`} autoComplete="new-password" required />
            <Submit className={styles.btnGhost}>{hasPassword ? 'Change password' : 'Set password'}</Submit>
          </form>
        </div>

        <div className={styles.stack}>
          <div className={styles.card}>
            <strong className={styles.cardTitle}>Notifications</strong>
            <p className={styles.note}>A nudge at 8 in the morning when pay lands with things to do, a bill or subscription is due tomorrow, a debt is due, or a storm is coming.</p>
            <NotifySettings publicKey={pushPublicKey()} weeklyEmail={Boolean(user?.weeklyEmail)} emailReady={emailConfigured()} />
          </div>
          <div className={styles.card}>
            <strong className={styles.cardTitle}>Appearance</strong>
            <p className={styles.note}>Automatic follows your phone or computer, and turns dark from 7 pm to 7 am.</p>
            <ThemePicker />
          </div>
          <div className={styles.card}>
            <strong className={styles.cardTitle}>Connected banks</strong>
            <p className={styles.note}>Your balance and transactions, updated by themselves. Read-only.</p>
            <a href="/banks" className={styles.btnGhost}>
              Manage banks
            </a>
          </div>
          <div className={styles.card}>
            <strong className={styles.cardTitle}>Your setup</strong>
            <p className={styles.note}>Balance, pay, rent, bills, subscriptions, money you owe and budgets, all on one page.</p>
            <a href="/setup" className={styles.btnGhost}>
              Edit setup
            </a>
          </div>

          <div className={styles.card}>
            <strong className={styles.cardTitle}>Calendar</strong>
            {me.calendarUrl ? (
              <>
                <p className={styles.note}>Plan ahead reads your calendar for costs.</p>
                <form action={disconnectCalendarAction}>
                  <Submit className={styles.btnGhost}>Disconnect calendar</Submit>
                </form>
              </>
            ) : (
              <>
                <p className={styles.note}>Not connected. Plan ahead can read your calendar to find costs before they happen.</p>
                <a href="/plan?calendar=1" className={styles.btnGhost}>
                  Connect calendar
                </a>
              </>
            )}
          </div>

          <div className={styles.card}>
            <strong className={styles.cardTitle}>Your data</strong>
            <p className={styles.note}>Download everything Pursecast stores about you as a JSON file.</p>
            <a href="/settings/export" className={styles.btnGhost} download>
              Export my data
            </a>
          </div>

          <div className={styles.card}>
            <strong className={styles.cardTitle}>Sign out</strong>
            <form action={signOutAction}>
              <Submit className={styles.btnGhost}>Log out</Submit>
            </form>
          </div>

          <form action={deleteAccountAction} className={styles.card} style={{ borderColor: 'var(--neg-line)' }}>
            <strong className={styles.cardTitle}>Delete account</strong>
            <p className={styles.note}>Deletes your account and everything in it right away. This cannot be undone.</p>
            <label className={styles.field}>
              Type {me.email} to confirm
              <input className={styles.input} name="confirm" autoComplete="off" required />
            </label>
            <Submit className={styles.btnDanger}>Delete my account</Submit>
          </form>
        </div>
      </div>
    </>
  );
}
