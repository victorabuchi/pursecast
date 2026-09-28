import styles from '../../../components/app/app.module.css';
import I from '../../../components/app/Icon';
import Submit from '../../../components/app/Submit';
import { MoneyInput, SignToggle } from '../../../components/app/Fields';
import { CloseButton, SheetButton } from '../../../components/app/Sheet';
import type { DebtRow, Money } from '../../../lib/money/load';
import { diffDays, short } from '../../../lib/money/dates';
import { exact, initials, money } from '../../../lib/money/format';
import { addDebtAction, deleteDebtAction, recordPaybackAction, reopenDebtAction, settleDebtAction, updateDebtAction } from '../../../lib/money/debt-actions';

function DebtForm({ currency }: { currency: string }) {
  return (
    <form action={addDebtAction} className={styles.form}>
      <div className={styles.row}>
        <SignToggle name="direction" value="-" minus="I lent" plus="I borrowed" label="Lent or borrowed" />
        <span className={styles.sign} role="radiogroup" aria-label="Person or institution">
          <label>
            <input type="radio" name="party" value="person" defaultChecked />
            <I d="user" size={14} /> Person
          </label>
          <label>
            <input type="radio" name="party" value="institution" />
            <I d="bank" size={14} /> Bank or institution
          </label>
        </span>
      </div>
      <div className={styles.row}>
        <label className={styles.field}>
          Who
          <input className={styles.input} name="person" placeholder="Sam, or Nordea" required maxLength={60} autoFocus autoComplete="off" />
        </label>
        <label className={styles.field}>
          How much
          <MoneyInput name="amount" currency={currency} required />
        </label>
      </div>
      <div className={styles.row}>
        <label className={styles.field}>
          Pay back by <small>optional</small>
          <input className={styles.input} type="date" name="dueDate" />
        </label>
        <label className={styles.field}>
          What for <small>optional</small>
          <input className={styles.input} name="note" placeholder="Concert tickets" maxLength={120} />
        </label>
      </div>
      <label className={styles.check}>
        <input type="checkbox" name="moved" defaultChecked />
        The money went through my account today
      </label>
      <p className={styles.note}>Money you owe with a date counts in Money Weather on that day. Money owed to you only counts once it is paid back.</p>
      <div className={styles.sheetActions}>
        <CloseButton className={styles.btnGhost}>Cancel</CloseButton>
        <Submit className={styles.btn}>Save</Submit>
      </div>
    </form>
  );
}

function EditDebt({ d, currency }: { d: DebtRow; currency: string }) {
  return (
    <form action={updateDebtAction} className={styles.form}>
      <input type="hidden" name="id" value={d.id} />
      <span className={styles.sign} role="radiogroup" aria-label="Person or institution" style={{ alignSelf: 'flex-start' }}>
        <label>
          <input type="radio" name="party" value="person" defaultChecked={d.party !== 'institution'} />
          <I d="user" size={14} /> Person
        </label>
        <label>
          <input type="radio" name="party" value="institution" defaultChecked={d.party === 'institution'} />
          <I d="bank" size={14} /> Bank or institution
        </label>
      </span>
      <div className={styles.row}>
        <label className={styles.field}>
          Name
          <input className={styles.input} name="person" defaultValue={d.person} required maxLength={60} autoFocus autoComplete="off" />
        </label>
        <label className={styles.field}>
          Amount {d.direction === 'lent' ? 'lent' : 'borrowed'}
          <MoneyInput name="amount" currency={currency} value={d.amount} required />
        </label>
      </div>
      <div className={styles.row}>
        <label className={styles.field}>
          Pay back by <small>optional</small>
          <input className={styles.input} type="date" name="dueDate" defaultValue={d.dueDate ?? ''} />
        </label>
        <label className={styles.field}>
          What for <small>optional</small>
          <input className={styles.input} name="note" defaultValue={d.note ?? ''} maxLength={120} />
        </label>
      </div>
      {d.paid > 0 && <p className={styles.note}>{exact(d.paid, currency)} is already paid back.</p>}
      <div className={styles.sheetActions}>
        <CloseButton className={styles.btnGhost}>Cancel</CloseButton>
        <Submit className={styles.btn}>Save</Submit>
      </div>
    </form>
  );
}

function Row({ d, currency, today }: { d: DebtRow; currency: string; today: string }) {
  const lent = d.direction === 'lent';
  const late = d.dueDate && !d.settledAt && d.left > 0 && d.dueDate < today;
  const soon = d.dueDate && !late ? diffDays(today, d.dueDate) : null;
  const pctPaid = Math.round((d.paid / d.amount) * 100);
  return (
    <div className={styles.debtRow}>
      <span className={styles.catDot} style={{ background: d.party === 'institution' ? '#e0e7ff' : lent ? '#dcfce7' : '#fee2e2', color: d.party === 'institution' ? '#4338ca' : lent ? '#15803d' : '#dc2626' }} aria-hidden="true">
        {d.party === 'institution' ? <I d="bank" size={15} /> : initials(d.person)}
      </span>
      <span>
        <b>
          {d.person}
          {d.party === 'institution' && <span className={styles.tag}>bank</span>}
        </b>
        <small>
          {d.note ? `${d.note} · ` : ''}
          {d.settledAt ? `Settled · ${exact(d.amount, currency)}` : d.paid > 0 ? `${exact(d.paid, currency)} of ${exact(d.amount, currency)} paid back` : `${lent ? 'Lent' : 'Borrowed'} ${short(d.createdAt.slice(0, 10))}`}
          {d.dueDate && !d.settledAt && (
            <span className={late ? styles.overdue : undefined}> · {late ? `was due ${short(d.dueDate)}` : soon === 0 ? 'due today' : `due ${short(d.dueDate)}`}</span>
          )}
        </small>
        {!d.settledAt && d.paid > 0 && (
          <span className={styles.meter} style={{ display: 'block', marginTop: 6, maxWidth: 220 }}>
            <span style={{ width: `${pctPaid}%`, background: lent ? '#22c55e' : undefined }} />
          </span>
        )}
      </span>
      <b className={`${styles.num} ${d.settledAt ? styles.muted : lent ? styles.pos : styles.neg}`}>{exact(d.settledAt ? d.amount : d.left, currency)}</b>
      <span className={styles.debtActions}>
        {d.settledAt ? (
          <form action={reopenDebtAction}>
            <input type="hidden" name="id" value={d.id} />
            <button type="submit" className={`${styles.btnGhost} ${styles.btnSmall}`}>
              Reopen
            </button>
          </form>
        ) : (
          <>
            <SheetButton className={`${styles.btnGhost} ${styles.btnSmall}`} label={lent ? 'Got paid' : 'Paid back'} title={lent ? `${d.person} paid you back` : `You paid ${d.person} back`} sub={`${exact(d.left, currency)} left`}>
              <form action={recordPaybackAction} className={styles.form}>
                <input type="hidden" name="id" value={d.id} />
                <div className={styles.row}>
                  <label className={styles.field}>
                    How much
                    <MoneyInput name="amount" currency={currency} value={d.left} required autoFocus />
                  </label>
                  <label className={styles.field}>
                    When
                    <input className={styles.input} type="date" name="date" defaultValue={today} max={today} />
                  </label>
                </div>
                <p className={styles.note}>This is logged in Spending and {lent ? 'adds to' : 'comes off'} your balance.</p>
                <div className={styles.sheetActions}>
                  <CloseButton className={styles.btnGhost}>Cancel</CloseButton>
                  <Submit className={styles.btn}>Record</Submit>
                </div>
              </form>
            </SheetButton>
            <form action={settleDebtAction}>
              <input type="hidden" name="id" value={d.id} />
              <button type="submit" className={styles.xBtn} aria-label={`Mark settled with ${d.person}`} title="Mark settled">
                <I d="check" size={15} />
              </button>
            </form>
          </>
        )}
        <SheetButton className={styles.xBtn} ariaLabel={`Edit ${d.person}`} label={<I d="edit" size={14} />} title={`Edit ${d.person}`}>
          <EditDebt d={d} currency={currency} />
        </SheetButton>
        <form action={deleteDebtAction}>
          <input type="hidden" name="id" value={d.id} />
          <button type="submit" className={styles.xBtn} aria-label={`Remove ${d.person}`} title="Remove">
            <I d="trash" size={14} />
          </button>
        </form>
      </span>
    </div>
  );
}

// Money owed between you and others, in separate blocks.
export default function Owed({ data, openNew }: { data: Money; openNew: boolean }) {
  const { me, debts } = data;
  const cur = me.currency;
  const open = debts.filter((d) => !d.settledAt && d.left > 0);
  const byDue = (a: DebtRow, b: DebtRow) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');
  const theyOwe = open.filter((d) => d.direction === 'lent').sort(byDue);
  const youOwe = open.filter((d) => d.direction === 'borrowed').sort(byDue);
  const settled = debts.filter((d) => d.settledAt || d.left === 0);
  const sum = (rows: DebtRow[]) => rows.reduce((s, d) => s + d.left, 0);

  const block = (title: string, sub: string, rows: DebtRow[], empty: string) => (
    <section className={styles.card} aria-label={title}>
      <div className={styles.cardHead}>
        <span>
          <strong className={styles.cardTitle}>{title}</strong>
          <span className={styles.cardSub} style={{ display: 'block' }}>
            {sub}
          </span>
        </span>
        <span className={`${styles.num} ${styles.cardSub}`}>{money(sum(rows), cur)}</span>
      </div>
      {rows.length === 0 && <p className={styles.note}>{empty}</p>}
      {rows.map((d) => (
        <Row key={d.id} d={d} currency={cur} today={me.today} />
      ))}
    </section>
  );

  return (
    <>
      <div className={styles.stats}>
        <div className={`${styles.card} ${styles.stat}`}>
          <small>People owe you</small>
          <b className={styles.pos}>{money(sum(theyOwe), cur)}</b>
        </div>
        <div className={`${styles.card} ${styles.stat}`}>
          <small>You owe</small>
          <b className={sum(youOwe) ? styles.neg : undefined}>{money(sum(youOwe), cur)}</b>
        </div>
        <div className={`${styles.card} ${styles.stat}`}>
          <small>Next due</small>
          <b style={{ fontSize: 18 }}>
            {(() => {
              const next = [...open].filter((d) => d.dueDate).sort(byDue)[0];
              return next ? `${next.person} · ${short(next.dueDate!)}` : 'Nothing due';
            })()}
          </b>
        </div>
      </div>
      <div>
        <SheetButton className={styles.btn} initiallyOpen={openNew} label={<><I d="plus" size={15} stroke={2.6} /> Add money owed</>} title="Money owed" sub="Lent to a friend, or borrowed from someone.">
          <DebtForm currency={cur} />
        </SheetButton>
      </div>
      <div className={styles.split2}>
        {block('They owe you', 'Money you lent', theyOwe, 'Nobody owes you money.')}
        {block('You owe', 'Money you borrowed', youOwe, 'You do not owe anyone.')}
      </div>
      {settled.length > 0 && (
        <details className={styles.card}>
          <summary className={styles.cardTitle} style={{ cursor: 'pointer' }}>
            Settled · {settled.length}
          </summary>
          {settled.map((d) => (
            <Row key={d.id} d={d} currency={cur} today={me.today} />
          ))}
        </details>
      )}
    </>
  );
}
