'use client';

import { useEffect, useState } from 'react';
import styles from './tools.module.css';
import { evaluate, isExpression, show } from '../../lib/money/calc';

// Every amount field is also a calculator: type "200 + 10 + 45" and press
// Enter (or leave the field) and it becomes 255. A small bubble shows the
// result while typing. Amount fields are the ones with inputmode="decimal".

let lastField: HTMLInputElement | null = null;
export const lastAmountField = () => (lastField && document.contains(lastField) ? lastField : null);

export function setFieldValue(el: HTMLInputElement, value: string) {
  // Through the native setter so React sees the change in controlled inputs.
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

const isAmount = (t: EventTarget | null): t is HTMLInputElement => t instanceof HTMLInputElement && (t.inputMode === 'decimal' || t.dataset['calc'] !== undefined);

export default function CalcInputs() {
  const [bubble, setBubble] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    const solve = (el: HTMLInputElement) => {
      if (!isExpression(el.value)) return false;
      const v = evaluate(el.value);
      if (v === null) return false;
      setFieldValue(el, show(v));
      return true;
    };
    const place = (el: HTMLInputElement) => {
      const v = isExpression(el.value) ? evaluate(el.value) : null;
      if (v === null) return setBubble(null);
      const r = el.getBoundingClientRect();
      setBubble({ text: `= ${show(v)}`, x: r.right - 8, y: r.bottom + 6 });
    };
    const onFocus = (e: FocusEvent) => {
      if (isAmount(e.target)) lastField = e.target;
    };
    const onInput = (e: Event) => {
      if (isAmount(e.target)) place(e.target);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !isAmount(e.target)) return;
      // A sum is worked out first; a plain number submits as usual.
      if (solve(e.target)) {
        e.preventDefault();
        setBubble(null);
      }
    };
    const onBlur = (e: FocusEvent) => {
      if (!isAmount(e.target)) return;
      solve(e.target);
      setBubble(null);
    };
    const hide = () => setBubble(null);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('input', onInput);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('focusout', onBlur);
    window.addEventListener('scroll', hide, true);
    return () => {
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('input', onInput);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusout', onBlur);
      window.removeEventListener('scroll', hide, true);
    };
  }, []);

  if (!bubble) return null;
  return (
    <span className={styles.bubble} style={{ left: bubble.x, top: bubble.y }} aria-live="polite">
      {bubble.text} <small>Enter</small>
    </span>
  );
}
