'use client';

import { useOptimistic, useRef, useState, useTransition } from 'react';
import styles from './app.module.css';
import I from './Icon';
import ConfirmX from './ConfirmX';
import { addTodoAction, deleteTodoAction, setTodoDoneAction } from '../../lib/money/todo-actions';
import { amountOf } from '../../lib/money/calc';
import { currencySymbol, exact } from '../../lib/money/format';

export type TodoItem = { id: string; text: string; amount: number | null; done: boolean; priority: number };
export type TodoGroup = { key: string; title: string; sub: string; landed: boolean; pay: number | null; items: TodoItem[] };
export type TodoOption = { value: string; label: string };

export const TODO_PRIORITIES: Array<[number, string]> = [
  [1, 'Must do'],
  [2, 'Should do'],
  [3, 'Nice to do'],
];

type Change = { kind: 'done'; id: string; done: boolean } | { kind: 'delete'; id: string } | { kind: 'add'; group: string; item: TodoItem };

// The "When money lands" list: things to do once a pay arrives, grouped by
// the payday they wait for. Ticks and additions show at once and save behind.
export default function TodoBoard({ groups, options, currency, today }: { groups: TodoGroup[]; options: TodoOption[]; currency: string; today: string }) {
  const [shown, change] = useOptimistic(groups, (gs: TodoGroup[], c: Change) => {
    if (c.kind === 'add') {
      const has = gs.some((g) => g.key === c.group);
      if (!has) {
        const label = options.find((o) => o.value === c.group)?.label.split(' · ')[0] ?? (c.group.startsWith('date|') ? `By ${c.group.slice(5)}` : 'Right now');
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
  const [when, setWhen] = useState(options[0]?.value ?? 'now');
  const [picked, setPicked] = useState('');
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
          if (when === 'pick' && !picked) return setError('Pick a date.');
          const cents = Math.round(amountOf(String(fd.get('amount') ?? '')) * 100);
          // The same group key the server gives it, so the row lands in place.
          const day = when === 'pick' ? picked : when.startsWith('date|') ? when.slice(5) : '';
          const group = when === 'now' || (day && day <= today) ? 'now' : day ? `date|${day}` : when;
          change({ kind: 'add', group, item: { id: `new-${Date.now()}`, text, amount: cents || null, done: false, priority: Number(fd.get('priority')) || 2 } });
          form.current?.reset();
          setAmount('');
          setWhen(options[0]?.value ?? 'now');
          setPicked('');
          const res = await addTodoAction(fd);
          if (res.error) setError(res.error);
        }}
      >
        <input className={styles.input} name="text" placeholder="Pay back Sam, book the train, buy a winter coat…" maxLength={140} aria-label="What to do" autoComplete="off" />
        <span className={styles.money}>
          <span>{sym}</span>
          <input className={styles.input} name="amount" inputMode="decimal" placeholder="Cost" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="What it costs (optional)" autoComplete="off" />
        </span>
        <select name="when" className={styles.select} value={when} onChange={(e) => setWhen(e.target.value)} aria-label="When">
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
          <option value="pick">On a date…</option>
        </select>
        <select name="priority" className={styles.select} defaultValue="2" aria-label="Priority">
          {TODO_PRIORITIES.map(([p, label]) => (
            <option key={p} value={p}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit" className={styles.btn}>
          <I d="plus" size={15} stroke={2.6} /> Add
        </button>
        {when === 'pick' && (
          <input className={`${styles.input} ${styles.todoDate}`} type="date" name="date" min={today} value={picked} onChange={(e) => setPicked(e.target.value)} aria-label="Date" autoFocus />
        )}
      </form>
      {error && <small className={styles.neg}>{error}</small>}

      {shown.length === 0 && (
        <div className={styles.empty}>
          <b>Nothing on the list yet.</b>
          Jot down what you will do once money lands, like paying someone back or booking a ticket. Pick when, and how much it matters.
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
                  <I d={g.landed ? 'check' : g.key.startsWith('date|') ? 'cal' : 'wallet'} size={15} stroke={2.4} />
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
                {[...g.items].sort((a, b) => a.priority - b.priority).map((i) => (
                  <li key={i.id} data-done={i.done}>
                    <button type="button" className={styles.todoCheck} role="checkbox" aria-checked={i.done} aria-label={i.text} onClick={() => toggle(i)} disabled={i.id.startsWith('new-')}>
                      <I d="check" size={13} stroke={3} />
                    </button>
                    <span className={styles.todoText}>
                      {i.text}
                      {i.priority !== 2 && (
                        <em className={styles.todoPri} data-p={i.priority}>
                          {i.priority === 1 ? 'Must' : 'Nice'}
                        </em>
                      )}
                    </span>
                    {i.amount ? <span className={`${styles.num} ${styles.todoAmt}`}>{exact(i.amount, currency)}</span> : null}
                    <ConfirmX label={`Remove ${i.text}`} onConfirm={() => remove(i)} disabled={i.id.startsWith('new-')} />
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
