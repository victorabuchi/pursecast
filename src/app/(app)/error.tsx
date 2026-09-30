'use client';

import { useEffect } from 'react';
import styles from '../../components/app/app.module.css';
import I from '../../components/app/Icon';

// A page that could not load, inside the app frame so the menu still works.
// Most often the connection dropped for a moment: it tries again by itself
// as soon as the device is back online.
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [error, retry]);

  return (
    <div className={styles.card} style={{ maxWidth: 520, margin: '48px auto', textAlign: 'center', display: 'grid', gap: 12, justifyItems: 'center' }}>
      <span className={styles.pageIcon} style={{ width: 52, height: 52 }}>
        <I d="cloud" size={24} />
      </span>
      <strong className={styles.cardTitle} style={{ fontSize: 20 }}>This page could not load</strong>
      <p className={styles.note} style={{ margin: 0 }}>
        Usually the internet dropped for a moment. Everything already saved is safe. It tries again by itself when you are back online.
      </p>
      <button type="button" className={styles.btn} onClick={retry}>
        <I d="refresh" size={15} /> Try again
      </button>
      {error.digest && <small className={styles.note}>Code {error.digest}</small>}
    </div>
  );
}
