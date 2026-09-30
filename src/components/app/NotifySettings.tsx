'use client';

import { useEffect, useState, useTransition } from 'react';
import styles from './app.module.css';
import I from './Icon';
import { removePushAction, savePushAction, setWeeklyEmailAction, testPushAction } from '../../lib/money/notify-actions';

type State = 'loading' | 'unsupported' | 'ios-install' | 'blocked' | 'off' | 'on';

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function currentSub(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration('/');
  return (await reg?.pushManager.getSubscription()) ?? null;
}

// Push notifications for this device, and the Monday email.
export default function NotifySettings({ publicKey, weeklyEmail, emailReady }: { publicKey: string; weeklyEmail: boolean; emailReady: boolean }) {
  const [state, setState] = useState<State>('loading');
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();

  useEffect(() => {
    let live = true;
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const installed = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
      let next: State;
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) next = ios && !installed ? 'ios-install' : 'unsupported';
      else if (Notification.permission === 'denied') next = 'blocked';
      else next = (await currentSub()) ? 'on' : 'off';
      if (live) setState(next);
    })();
    return () => {
      live = false;
    };
  }, []);

  const turnOn = () =>
    start(async () => {
      setMsg('');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'blocked' : 'off');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
      const res = await savePushAction(sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } });
      setState(res.ok ? 'on' : 'off');
      if (!res.ok) setMsg('This device could not be set up. Try again.');
    });

  const turnOff = () =>
    start(async () => {
      const sub = await currentSub();
      if (sub) {
        await removePushAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setState('off');
    });

  const test = () =>
    start(async () => {
      const { sent } = await testPushAction();
      setMsg(sent ? 'Sent. It should show up in a few seconds.' : 'Nothing was sent. Turn notifications off and on again.');
    });

  return (
    <div className={styles.stack} style={{ gap: 12 }}>
      {!publicKey ? (
        <p className={styles.note}>Notifications are not set up on the server yet.</p>
      ) : state === 'ios-install' ? (
        <p className={styles.note}>
          On iPhone, add Pursecast to your Home Screen first: tap <b>Share</b>, then <b>Add to Home Screen</b>. Open it from there and turn notifications on here.
        </p>
      ) : state === 'unsupported' ? (
        <p className={styles.note}>This browser cannot show notifications. Try Chrome, Edge, Firefox or Safari.</p>
      ) : state === 'blocked' ? (
        <p className={styles.note}>Notifications are blocked for Pursecast in this browser. Allow them in the site settings (the icon next to the address), then come back.</p>
      ) : state === 'on' ? (
        <div className={styles.row} style={{ alignItems: 'center' }}>
          <span className={styles.pos} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, flex: 'none' }}>
            <I d="check" size={15} stroke={2.6} /> On for this device
          </span>
          <button type="button" className={`${styles.btnGhost} ${styles.btnSmall}`} style={{ flex: 'none' }} onClick={test} disabled={pending}>
            Send a test
          </button>
          <button type="button" className={styles.linkBtn} style={{ color: 'var(--muted)', fontSize: 13, flex: 'none' }} onClick={turnOff} disabled={pending}>
            Turn off
          </button>
        </div>
      ) : (
        <button type="button" className={styles.btn} onClick={turnOn} disabled={pending || state === 'loading'}>
          <I d="bell" size={15} /> {pending ? 'Asking…' : 'Turn on notifications'}
        </button>
      )}
      {msg && <small className={styles.note}>{msg}</small>}
      <label className={styles.check}>
        <input type="checkbox" defaultChecked={weeklyEmail} disabled={!emailReady} onChange={(e) => start(() => setWeeklyEmailAction(e.target.checked))} />
        Monday email: the week ahead, bills and what waits for payday
      </label>
      {!emailReady && <small className={styles.note}>Email needs Resend set up on the server.</small>}
    </div>
  );
}
