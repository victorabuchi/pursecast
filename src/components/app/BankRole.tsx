'use client';

import { useTransition } from 'react';
import styles from './app.module.css';
import { setBankRoleAction } from '../../lib/bank/actions';

const ROLES: Array<[string, string]> = [
  ['main', 'Main account'],
  ['counted', 'Other account, in forecast'],
  ['other', 'Other account, not counted'],
  ['off', 'Don’t use'],
];

// What a linked bank account is for; saved as soon as it changes.
export default function BankRole({ id, role, name }: { id: string; role: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <select className={styles.select} defaultValue={role} disabled={pending} aria-label={`${name}: use as`} onChange={(e) => start(() => setBankRoleAction(id, e.target.value))} style={{ flex: '0 1 240px' }}>
      {ROLES.map(([r, label]) => (
        <option key={r} value={r}>
          {label}
        </option>
      ))}
    </select>
  );
}
