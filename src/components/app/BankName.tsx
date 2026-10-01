'use client';

import { useState, useTransition } from 'react';
import styles from './app.module.css';
import { renameBankAccountAction } from '../../lib/bank/actions';

// A linked account's name, editable in place ("Revolut Pro").
export default function BankName({ id, name }: { id: string; name: string }) {
  const [value, setValue] = useState(name);
  const [pending, start] = useTransition();
  const save = () => {
    const v = value.trim();
    if (!v || v === name) return setValue(name);
    start(() => renameBankAccountAction(id, v));
  };
  return (
    <input
      className={styles.bankName}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') setValue(name);
      }}
      disabled={pending}
      maxLength={60}
      aria-label="Account name"
      title="Click to rename"
    />
  );
}
