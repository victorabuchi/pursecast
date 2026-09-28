'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './app.module.css';
import I from './Icon';

type Result = { statementId: string | null; added: number; skipped: number; notes: string[]; error?: string };

// Drop or pick statements, screenshots or exports. They are read on the
// server; the page then shows what was found.
export default function Uploader({ statementId, compact, label }: { statementId?: string; compact?: boolean; label?: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const send = async (files: FileList | File[]) => {
    const list = [...files];
    if (!list.length) return;
    setResult(null);
    setBusy(list.length === 1 ? `Reading ${list[0]!.name}…` : `Reading ${list.length} files…`);
    const form = new FormData();
    for (const f of list) form.append('files', f);
    if (statementId) form.append('statementId', statementId);
    try {
      const res = await fetch('/api/statements', { method: 'POST', body: form });
      const data = (await res.json()) as Result;
      setResult(data);
      if (data.statementId && data.added) router.push(`/statements?s=${data.statementId}`, { scroll: false });
      router.refresh();
    } catch {
      setResult({ statementId: null, added: 0, skipped: 0, notes: [], error: 'The upload did not go through. Check your connection and try again.' });
    } finally {
      setBusy(null);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className={styles.stack} style={{ gap: 8 }}>
      <label
        className={`${styles.drop} ${over ? styles.dropOver : ''} ${compact ? styles.dropCompact : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!busy) void send(e.dataTransfer.files);
        }}
        aria-busy={Boolean(busy)}
      >
        <input ref={input} type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,.pdf,.csv,.tsv,.txt,.xlsx" className={styles.visuallyHidden} disabled={Boolean(busy)} onChange={(e) => e.target.files && void send(e.target.files)} />
        {busy ? (
          <>
            <span className={styles.spinner} aria-hidden="true" />
            <b>{busy}</b>
            <small>Long statements can take a minute.</small>
          </>
        ) : (
          <>
            <I d="upload" size={compact ? 18 : 26} />
            <b>{label ?? 'Drop a bank statement, screenshots or an export'}</b>
            {!compact && <small>PDF, screenshot (PNG, JPG), Excel (.xlsx) or CSV · up to 10 files, 20 MB each</small>}
          </>
        )}
      </label>
      {result && (
        <p className={result.error || (!result.added && result.notes.length) ? styles.error : styles.success} role="status">
          {result.error ?? (result.added ? `${result.added} ${result.added === 1 ? 'transaction' : 'transactions'} added${result.skipped ? `, ${result.skipped} already there` : ''}.` : '')} {result.notes.join(' ')}
        </p>
      )}
    </div>
  );
}
