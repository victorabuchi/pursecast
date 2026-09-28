'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import styles from './app.module.css';
import I from './Icon';

// Shows ?toast= or ?error= from a redirect once, then drops it from the address.
export default function Toast() {
  const params = useSearchParams();
  const text = params.get('toast') ?? params.get('error');
  const error = !params.get('toast') && Boolean(params.get('error'));
  const [shown, setShown] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    if (!text) return;
    queueMicrotask(() => setShown({ text, error }));
    const url = new URL(window.location.href);
    url.searchParams.delete('toast');
    url.searchParams.delete('error');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    const t = window.setTimeout(() => setShown(null), error ? 5000 : 3200);
    return () => window.clearTimeout(t);
  }, [text, error]);

  if (!shown) return null;
  return (
    <div key={shown.text} className={styles.toast} role={shown.error ? 'alert' : 'status'} onClick={() => setShown(null)}>
      <span className={shown.error ? styles.toastErr : styles.toastOk}>
        <I d={shown.error ? 'x' : 'check'} size={13} stroke={3} />
      </span>
      {shown.text}
    </div>
  );
}
