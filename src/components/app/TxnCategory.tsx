'use client';

import { useRef } from 'react';
import styles from './app.module.css';
import { STATEMENT_CATEGORIES } from '../../lib/statements/types';
import { setTxnCategoryAction } from '../../lib/statements/actions';

// Changing it saves right away, for every transaction at the same place.
export default function TxnCategory({ id, value, back }: { id: string; value: string; back: string }) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={setTxnCategoryAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="back" value={back} />
      <select name="category" className={styles.catSelect} defaultValue={value} onChange={() => form.current?.requestSubmit()} aria-label="Category">
        {STATEMENT_CATEGORIES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
    </form>
  );
}
