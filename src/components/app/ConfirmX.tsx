'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './app.module.css';
import I from './Icon';

// The × that removes something. The first tap only asks; removing needs a
// second, deliberate tap, so a brush while scrolling never deletes anything.
export default function ConfirmX({ label, question, action = 'Remove', title, icon = 'x', onConfirm, disabled }: { label: string; question?: string; action?: string; title?: string; icon?: 'x' | 'trash'; onConfirm?: () => void; disabled?: boolean }) {
  const [asking, setAsking] = useState(false);
  const box = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!asking) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setAsking(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAsking(false);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [asking]);

  return (
    <span ref={box} className={styles.confirmX}>
      <button type="button" className={styles.xBtn} aria-label={label} title={title ?? label} aria-expanded={asking} disabled={disabled} onClick={() => setAsking((a) => !a)}>
        <I d={icon} size={icon === 'x' ? 13 : 14} />
      </button>
      {asking && (
        <span className={styles.confirmPop} role="alertdialog" aria-label={question ?? `${label}?`}>
          <span>{question ?? `${label}?`}</span>
          <span className={styles.confirmBtns}>
            <button type="button" className={styles.confirmNo} onClick={() => setAsking(false)}>
              Cancel
            </button>
            <button type={onConfirm ? 'button' : 'submit'} className={styles.confirmYes} onClick={onConfirm ? () => (setAsking(false), onConfirm()) : undefined}>
              {action}
            </button>
          </span>
        </span>
      )}
    </span>
  );
}
