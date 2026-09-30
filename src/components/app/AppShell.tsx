import Link from 'next/link';
import { Suspense } from 'react';
import styles from './app.module.css';
import Mark from '../Mark';
import I from './Icon';
import Faces from './Faces';
import Popover from './Popover';
import Palette, { type PaletteItem } from './Palette';
import Toast from './Toast';
import Tools from '../tools/Tools';
import { ClearSetupDraft } from './FormDraft';
import { Rail, SetupButton, Tabs } from './Nav';
import { signOutAction } from '../../lib/auth/actions';
import { exact } from '../../lib/money/format';
import type { Reminder } from '../../lib/money/reminders';
import { ago, possessive } from '../../lib/money/dates';

const REMINDER_ICON = { todo: 'check', bill: 'repeat', debt: 'user', storm: 'storm', pay: 'wallet' } as const;

export type BellItem = { id: string; note: string; amount: number; date: string; category: string | null };

// The Pursecast app frame from the film: top bar, icon rail on desktop, tab
// bar on phones.
export default function AppShell({
  name,
  email,
  currency,
  today,
  bell,
  palette,
  notepad,
  notepadAt,
  photo,
  reminders,
  children,
}: {
  notepad: string;
  notepadAt: string | null;
  photo: string | null;
  reminders: Reminder[];
  name: string;
  email: string;
  currency: string;
  today: string;
  bell: BellItem[];
  palette: PaletteItem[];
  children: React.ReactNode;
}) {
  return (
    <div className={styles.app}>
      <header className={styles.top}>
        <Link href="/forecast" className={styles.mark} aria-label="Pursecast home">
          <Mark size={20} />
        </Link>
        <span className={styles.slash}>/</span>
        <span className={styles.orgName}>Personal</span>
        <span className={styles.topRight}>
          <SetupButton />
          <Tools notepad={notepad} notepadAt={notepadAt} buttonClass={styles.iconBtn} />
          <Popover
            label={reminders.length || bell.length ? `${reminders.length + bell.length} notifications` : 'Notifications'}
            className={`${styles.iconBtn} ${bell.length || reminders.length ? styles.bellRing : ''}`}
            wide
            button={
              <>
                <I d="bell" />
                {(bell.length > 0 || reminders.length > 0) && <i className={styles.bellDot} />}
              </>
            }
          >
            {reminders.length > 0 && (
              <>
                <div className={styles.popHead}>
                  <b>Reminders</b>
                  <small>For today and the next few days.</small>
                </div>
                {reminders.map((r) => (
                  <Link key={r.key} href={r.href} className={`${styles.notifRow} ${styles.notifLink}`}>
                    <span className={styles.notifIcon} data-kind={r.kind}>
                      <I d={REMINDER_ICON[r.kind]} size={16} />
                    </span>
                    <div>
                      <b>{r.title}</b>
                      <small>{r.body}</small>
                    </div>
                  </Link>
                ))}
              </>
            )}
            <div className={styles.popHead}>
              <b>Was it worth it?</b>
              <small>{bell.length ? 'Rate a purchase with one tap.' : 'Nothing to rate right now.'}</small>
            </div>
            {bell.map((b) => (
              <div key={b.id} className={styles.notifRow}>
                <span className={styles.notifIcon}>
                  <Mark size={20} />
                </span>
                <div>
                  <b>
                    Was {possessive(b.date, today)} {b.note.toLowerCase()} worth it?
                  </b>
                  <small>
                    {exact(Math.abs(b.amount), currency)}
                    {b.category ? ` · ${b.category}` : ''} · {ago(b.date, today)}
                  </small>
                  <div style={{ marginTop: 6 }}>
                    <Faces id={b.id} mood={null} back="/worth-it" small />
                  </div>
                </div>
              </div>
            ))}
            {bell.length > 0 && (
              <Link href="/worth-it" className={styles.popItem}>
                <I d="heart" />
                Open Worth-It
              </Link>
            )}
          </Popover>
          <Palette items={palette} />
          <Popover
            label="Account"
            className={styles.avatar}
            button={
              photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.avatarImg} src={photo} alt="" />
              ) : (
                <I d="user" size={17} />
              )
            }
          >
            <div className={styles.popHead}>
              <b>{name}</b>
              <small>{email}</small>
            </div>
            <Link href="/setup" className={styles.popItem}>
              <I d="edit" />
              Edit setup
            </Link>
            <Link href="/settings" className={styles.popItem}>
              <I d="gear" />
              Settings
            </Link>
            <Link href="/spending?tab=bills" className={styles.popItem}>
              <I d="repeat" />
              Bills and income
            </Link>
            <form action={signOutAction}>
              <button type="submit" className={styles.popItem}>
                <I d="out" />
                Log out
              </button>
            </form>
          </Popover>
        </span>
      </header>
      <div className={styles.body}>
        <Rail />
        <main className={styles.main}>{children}</main>
      </div>
      <Tabs />
      <Suspense>
        <Toast />
      </Suspense>
      <ClearSetupDraft />
    </div>
  );
}

