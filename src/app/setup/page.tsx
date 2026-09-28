import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import styles from '../../components/app/app.module.css';
import Mark from '../../components/Mark';
import I from '../../components/app/Icon';
import Toast from '../../components/app/Toast';
import Submit from '../../components/app/Submit';
import { MoneyInput, SignToggle } from '../../components/app/Fields';
import RepeatRows from '../../components/app/RepeatRows';
import BudgetPicker from '../../components/app/BudgetPicker';
import OwedRows from '../../components/app/OwedRows';
import Tools from '../../components/tools/Tools';
import { DraftJanitor, FormDraft } from '../../components/app/FormDraft';
import AdvanceRows from '../../components/app/AdvanceRows';
import { DRAFT_PREFIX } from '../../lib/drafts';
import { POPULAR_BILLS, POPULAR_SUBSCRIPTIONS } from '../../lib/money/presets';
import { getBalance, getCategories, getDebts, getMe, getRecurring, type RecurringRow } from '../../lib/money/load';
import { addMonths, monthStart, short } from '../../lib/money/dates';
import { DEFAULT_CATEGORIES } from '../../lib/money/categories';
import { completeSetupAction } from '../../lib/money/actions';

export const metadata: Metadata = { title: 'Set up your forecast', robots: { index: false } };

const DRAFT_FIELDS = ['balance', 'balanceSign', 'currency', 'salaryName', 'salary', 'salaryDate', 'rent', 'rentDate'];

// A short stable hash of what the page was filled from.
function fingerprint(value: unknown): string {
  const text = JSON.stringify(value);
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const CURRENCIES: Array<[string, string]> = [
  ['EUR', 'Euro (€)'],
  ['USD', 'US dollar ($)'],
  ['GBP', 'Pound (£)'],
  ['SEK', 'Swedish krona'],
  ['NOK', 'Norwegian krone'],
  ['DKK', 'Danish krone'],
  ['CHF', 'Swiss franc'],
  ['PLN', 'Polish złoty'],
  ['CAD', 'Canadian dollar'],
  ['AUD', 'Australian dollar'],
  ['NGN', 'Nigerian naira'],
  ['INR', 'Indian rupee'],
  ['JPY', 'Japanese yen'],
];

// First run: enough to draw a forecast. Opened again later, the same page
// shows everything as it is now to change, add or remove.
export default async function SetupPage() {
  const me = await getMe();
  const editing = me.balance !== null;
  const nextFirst = monthStart(addMonths(me.today, 1));
  const cur = me.currency;
  const flex = DEFAULT_CATEGORIES.filter((c) => c.kind === 'flex');

  const [cats, recurring, debts, balance] = editing ? await Promise.all([getCategories(me.id), getRecurring(me.id), getDebts(me.id), getBalance(me)]) : [[], [], [], 0];
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const salary = recurring.find((r) => r.amount > 0 && !r.paused);
  const rent = recurring.find((r) => r.amount < 0 && !r.paused && catName.get(r.categoryId ?? '') === 'Housing');
  const others = recurring.filter((r) => r.id !== salary?.id && r.id !== rent?.id && r.amount <= 0 && !r.paused);
  const toRow = (r: RecurringRow, key: number) => ({ key, id: r.id, name: r.name, amount: r.amount ? String(-r.amount / 100) : '', cadence: r.cadence, date: r.nextDate });
  const subRows = others.filter((r) => catName.get(r.categoryId ?? '') === 'Subscriptions').map(toRow);
  const billRows = others.filter((r) => catName.get(r.categoryId ?? '') !== 'Subscriptions').map(toRow);
  const open = debts.filter((d) => !d.settledAt && d.left > 0);
  const debtRow = (d: (typeof debts)[number], key: number) => ({ key, id: d.id, who: d.person, party: (d.party === 'institution' ? 'institution' : 'person') as 'person' | 'institution', amount: String(d.left / 100), date: d.dueDate ?? '' });
  const owedRows = open.filter((d) => d.direction === 'borrowed').map(debtRow);
  const lentRows = open.filter((d) => d.direction === 'lent').map(debtRow);
  const advances = salary?.advances ?? [];
  const advanceRows = advances.map((a, key) => ({ key, id: a.id, amount: String(a.amount / 100), date: a.takenOn, note: `${a.pending ? 'Arrives' : 'Arrived'} ${short(a.takenOn)} · comes off the ${short(a.payday)} pay` }));
  const suggested = new Map(flex.map((c) => [c.name, c.budget]));
  const budgetOptions = editing
    ? cats.filter((c) => c.kind === 'flex').map((c) => ({ name: c.name, amount: c.budget || (suggested.get(c.name) ?? 0) }))
    : flex.map((c) => ({ name: c.name, amount: c.budget }));
  const budgetInitial = editing ? cats.filter((c) => c.kind === 'flex' && c.budget > 0).map((c) => c.name) : ['Groceries'];

  // Everything typed is kept in this browser until it is saved, so leaving
  // the page loses nothing. When editing, the draft belongs to the data as it
  // was; if that changed since (a bill added elsewhere), the old draft is
  // left unused rather than undoing the change.
  const version = editing ? fingerprint([balance, cur, salary, rent, others, open, advances, budgetInitial, cats.map((c) => c.budget)]) : 'new';
  const draft = `${DRAFT_PREFIX}${me.id}:${version}:`;
  const k = (name: string) => `${draft}${name}`;

  return (
    <div className={styles.app}>
      <header className={styles.top}>
        <Link href={editing ? '/forecast' : '/setup'} className={styles.mark} aria-label="Pursecast">
          <Mark size={20} />
        </Link>
        <span className={styles.slash}>/</span>
        <span className={styles.orgName}>{editing ? 'Your setup' : 'Set up'}</span>
        <span className={styles.topRight}>
          <Tools notepad={me.notepad} notepadAt={me.notepadAt} buttonClass={styles.iconBtn} />
          {editing && (
            <Link href="/forecast" className={`${styles.btnGhost} ${styles.btnSmall}`}>
              <I d="left" size={14} /> Back to forecast
            </Link>
          )}
        </span>
      </header>
      <main className={styles.main} style={{ maxWidth: 760, margin: '0 auto', width: '100%' }}>
        <div className={styles.pageHead}>
          <span className={styles.pageIcon}>
            <I d="sun" size={22} />
          </span>
          <div>
            <h1>{editing ? 'Your setup' : <>Hi {me.name}, let&apos;s draw your forecast</>}</h1>
            <small>{editing ? 'Change anything, then save to redraw your forecast' : 'Two minutes · change anything later'}</small>
          </div>
        </div>

        <form action={completeSetupAction} className={styles.stack}>
          <FormDraft storageKey={`${draft}fields`} names={DRAFT_FIELDS} />
          <DraftJanitor keep={draft} userPrefix={`${DRAFT_PREFIX}${me.id}:`} />
          {editing && (
            <>
              <input type="hidden" name="balanceWas" value={String(balance)} />
              <input type="hidden" name="shownRecurring" value={[salary, rent, ...others].filter(Boolean).map((r) => r!.id).join(',')} />
              <input type="hidden" name="shownDebts" value={open.map((d) => d.id).join(',')} />
              <input type="hidden" name="shownAdvances" value={advances.map((a) => a.id).join(',')} />
              {salary && <input type="hidden" name="salaryId" value={salary.id} />}
              {rent && <input type="hidden" name="rentId" value={rent.id} />}
              {rent && <input type="hidden" name="rentName" value={rent.name} />}
            </>
          )}
          <section className={styles.card}>
            <strong className={styles.cardTitle}>1. Money in your account today</strong>
            <p className={styles.note}>{editing ? 'Your balance now, with everything logged so far. Change it only if your bank shows something else.' : 'Your main account, the one bills are paid from. No bank login needed.'}</p>
            <div className={styles.row}>
              <SignToggle name="balanceSign" value={balance < 0 ? '-' : '+'} label="Positive or overdrawn" />
              <MoneyInput name="balance" currency={cur} required autoFocus={!editing} placeholder="2,340" label="Balance today" value={editing ? balance : null} />
              <select name="currency" className={styles.select} defaultValue={cur} aria-label="Currency">
                {CURRENCIES.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <OwedRows currency={cur} today={me.today} draftKey={k('owed')} initialRows={owedRows} />
            <OwedRows currency={cur} today={me.today} draftKey={k('lent')} initialRows={lentRows} lent />
          </section>

          <section className={styles.card}>
            <strong className={styles.cardTitle}>2. Your pay</strong>
            <div className={styles.row}>
              <label className={styles.field}>
                Name
                <input className={styles.input} name="salaryName" defaultValue={salary?.name ?? 'Salary'} />
              </label>
              <label className={styles.field}>
                Amount after tax, each month
                <MoneyInput name="salary" currency={cur} placeholder="2,900" value={salary ? salary.amount : null} />
              </label>
              <label className={styles.field}>
                <span>
                  Next payday <small className={styles.muted}>empty = 1st of next month</small>
                </span>
                <input className={styles.input} type="date" name="salaryDate" min={me.today} defaultValue={salary?.nextDate} />
              </label>
            </div>
            <AdvanceRows currency={cur} today={me.today} draftKey={k('advances')} initialRows={advanceRows} />
          </section>

          <section className={styles.card}>
            <strong className={styles.cardTitle}>3. Rent and bills</strong>
            <div className={styles.row}>
              <label className={styles.field}>
                {rent?.name ?? 'Rent or mortgage'}
                <MoneyInput name="rent" currency={cur} placeholder="950" value={rent ? -rent.amount : null} />
              </label>
              <label className={styles.field}>
                Next due date
                <input className={styles.input} type="date" name="rentDate" defaultValue={rent?.nextDate ?? nextFirst} />
              </label>
            </div>
            <p className={styles.note}>Phone, electricity, insurance. Add them one at a time, each with its next due date.</p>
            <RepeatRows prefix="bill" presets={POPULAR_BILLS} currency={cur} today={me.today} addLabel="Add a bill" draftKey={k('bills')} initialRows={billRows} />
          </section>

          <section className={styles.card}>
            <strong className={styles.cardTitle}>4. Subscriptions</strong>
            <p className={styles.note}>Streaming, apps, the gym. Yearly ones too, so they never surprise you. No fixed price or date (like Render or Supabase)? Just add the name.</p>
            <RepeatRows prefix="sub" presets={POPULAR_SUBSCRIPTIONS} currency={cur} today={me.today} addLabel="Add a subscription" draftKey={k('subs')} initialRows={subRows} />
          </section>

          <section className={styles.card}>
            <strong className={styles.cardTitle}>5. Everyday spending each month</strong>
            <p className={styles.note}>Add what you spend on day to day, one at a time. Rough is fine; Worth-It will suggest better amounts as you rate what you buy.</p>
            <BudgetPicker options={budgetOptions} initial={budgetInitial} currency={cur} draftKey={k('budgets:')} />
          </section>

          <Submit className={`${styles.btn} ${styles.btnWide}`} pending={editing ? 'Saving…' : 'Drawing your forecast…'}>
            {editing ? 'Save and redraw my forecast' : 'Show my forecast'}
          </Submit>
          <p className={styles.draftNote}>
            <I d="check" size={13} /> Everything you type is kept on this device until you save, even if you leave the page.
          </p>
          {editing && (
            <p className={styles.note} style={{ textAlign: 'center' }}>
              Removing a row here removes that bill, debt or advance. Paused bills stay as they are.
            </p>
          )}
        </form>
      </main>
      <Suspense>
        <Toast />
      </Suspense>
    </div>
  );
}
