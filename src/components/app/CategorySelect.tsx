'use client';

import { useRef } from 'react';
import styles from './app.module.css';
import { setEntryCategoryAction } from '../../lib/money/actions';

// Changing the category saves right away.
export default function CategorySelect({ id, value, options, back }: { id: string; value: string | null; options: Array<{ id: string; name: string }>; back: string }) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={setEntryCategoryAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="back" value={back} />
      <select name="categoryId" className={styles.catSelect} defaultValue={value ?? ''} onChange={() => form.current?.requestSubmit()} aria-label="Category">
        <option value="">No category</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </form>
  );
}
