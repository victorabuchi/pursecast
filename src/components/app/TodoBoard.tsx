'use client';

import { useOptimistic, useRef, useState, useTransition } from 'react';
import styles from './app.module.css';
import I from './Icon';
import { addTodoAction, deleteTodoAction, setTodoDoneAction } from '../../lib/money/todo-actions';
import { amountOf } from '../../lib/money/calc';
import { currencySymbol, exact } from '../../lib/money/format';

export type TodoItem = { id: string; text: string; amount: number | null; done: boolean };
export type TodoGroup = { key: string; title: string; sub: string; landed: boolean; pay: number | null; items: TodoItem[] };
export type TodoOption = { value: string; label: string };

type Change = { kind: 'done'; id: string; done: boolean } | { kind: 'delete'; id: string } | { kind: 'add'; group: string; item: TodoItem };

// The "When money lands" list: things to do once a pay arrives, grouped by
// the payday they wait for. Ticks and additions show at once and save behind.
export default function TodoBoard({ groups, options, currency }: { groups: TodoGroup[]; options: TodoOption[]; currency: string }) {
  const [shown, change] = useOptimistic(groups, (gs: TodoGroup[], c: Change) => {
    if (c.kind === 'add') {
      const has = gs.some((g) => g.key === c.group);
      if (!has) {
        const label = options.find((o) => o.value === c.group)?.label ?? 'Right now';
        return [...gs, { key: c.group, title: label, sub: '', landed: c.group === 'now', pay: null, items: [c.item] }];
      }
      return gs.map((g) => (g.key === c.group ? { ...g, items: [...g.items, c.item] } : g));
    }
    return gs.map((g) => ({
      ...g,
      items: c.kind === 'delete' ? g.items.filter((i) => i.id !== c.id) : g.items.map((i) => (i.id === c.id ? { ...i, done: c.done } : i)),
    }));
  });
  const [, start] = useTransition();
  const [error, setError] = useState('');
  const [amount, setAmount] = useState('');
  const form = useRef<HTMLFormElement>(null);
  const sym = currencySymbol(currency);

  const toggle = (item: TodoItem) =>
    start(async () => {
      change({ kind: 'done', id: item.id, done: !item.done });
      await setTodoDoneAction(item.id, !item.done);
    });
  const remove = (item: TodoItem) =>
    start(async () => {
      change({ kind: 'delete', id: item.id });
      await deleteTodoAction(item.id);
    });

  return (
    <div className={styles.todo}>
      <form
        ref={form}
        className={styles.todoAdd}
        action={async (fd) => {
          setError('');
          const text = String(fd.get('text') ?? '').trim();
          if (!text) return setError('Write what to do.');
          const when = String(fd.get('when') ?? 'now');
          const cents = Math.round(amountOf(String(fd.get('amount') ?? '')) * 100);
          change({ kind: 'add', group: when === 'now' ? 'now' : when, item: { id: `new-${Date.now()}`, text, amount: cents || null, done: false } });
          form.current?.reset();
          setAmount('');
          const res = await addTodoAction(fd);
          if (res.error) setError(res.error);
        }}
      >
        <input className={styles.input} name="text" placeholder="Pay back Sam, book the train, buy a winter coat…" maxLength={140} aria-label="What to do" autoComplete="off" />
        <span className={styles.money}>
          <span>{sym}</span>
          <input className={styles.input} name="amount" inputMode="decimal" placeholder="Cost" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="What it costs (optional)" autoComplete="off" />
        </span>
        <select name="when" className={styles.select} defaultValue={options[0]?.value ?? 'now'} aria-label="When">
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button type="submit" className={styles.btn}>
          <I d="plus" size={15} stroke={2.6} /> Add
        </button>
      </form>
      {error && <small className={styles.neg}>{error}</small>}

      {shown.length === 0 && (
        <div className={styles.empty}>
          <b>Nothing waiting for payday.</b>
          Jot down what you will do once money lands, like paying someone back or booking a ticket. When the pay arrives, the list is ready.
        </div>
      )}

      <div className={styles.todoGroups}>
        {shown.map((g) => {
          const left = g.items.filter((i) => !i.done);
          const planned = g.items.reduce((s, i) => s + (i.amount ?? 0), 0);
          const all = g.items.length > 0 && left.length === 0;
          return (
            <section key={g.key} className={styles.todoGroup} data-landed={g.landed} data-all={all} aria-label={g.title}>
              <header>
                <span className={styles.todoBadge} aria-hidden="true">
                  <I d={g.landed ? 'check' : 'wallet'} size={15} stroke={2.4} />
                </span>
                <span>
                  <b>{g.title}</b>
                  <small>{all ? 'All done' : g.sub}</small>
                </span>
                {planned > 0 && (
                  <em className={styles.num}>
                    {exact(planned, currency)}
                    {g.pay ? <small> of {exact(g.pay, currency)}</small> : null}
                  </em>
                )}
              </header>
              {g.pay && planned > 0 && (
                <div className={styles.meter} aria-hidden="true">
                  <span style={{ width: `${Math.min(100, Math.round((planned / g.pay) * 100))}%`, background: planned > g.pay ? 'var(--neg)' : 'var(--b)' }} />
                </div>
              )}
              <ul>
                {g.items.map((i) => (
                  <li key={i.id} data-done={i.done}>
                    <button type="button" className={styles.todoCheck} role="checkbox" aria-checked={i.done} aria-label={i.text} onClick={() => toggle(i)} disabled={i.id.startsWith('new-')}>
                      <I d="check" size={13} stroke={3} />
                    </button>
                    <span className={styles.todoText}>{i.text}</span>
                    {i.amount ? <span className={`${styles.num} ${styles.todoAmt}`}>{exact(i.amount, currency)}</span> : null}
                    <button type="button" className={styles.xBtn} aria-label={`Remove ${i.text}`} onClick={() => remove(i)} disabled={i.id.startsWith('new-')}>
                      <I d="x" size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
