import styles from '../../../components/app/app.module.css';
import I from '../../../components/app/Icon';
import Submit from '../../../components/app/Submit';
import { MoneyInput } from '../../../components/app/Fields';
import { CloseButton, SheetButton } from '../../../components/app/Sheet';
import { db } from '../../../prisma/db';
import type { EventRow, Me } from '../../../lib/money/load';
import { addMonths, diffDays, short } from '../../../lib/money/dates';
import { exact, money } from '../../../lib/money/format';
import { jarAccrued, type Forecast } from '../../../lib/money/forecast';
import { affordableFrom, PRIORITIES } from '../../../lib/money/wish';
import { addWishAction, boughtWishAction, deleteWishAction, saveForWishAction } from '../../../lib/money/wish-actions';

// Things the person wants to buy, each with the first day it fits the
// forecast without a storm afterwards.
export default async function WantToBuy({ me, fc, events, openNew }: { me: Me; fc: Forecast; events: EventRow[]; openNew: boolean }) {
  const cur = me.currency;
  const items = await db.orm.public.WishItem.where({ userId: me.id }).orderBy([(w) => w.priority.asc(), (w) => w.createdAt.asc()]).all();
  const wanted = items.filter((w) => !w.boughtAt);
  const bought = items.filter((w) => w.boughtAt).slice(-5);
  const total = wanted.reduce((s, w) => s + w.price, 0);

  return (
    <section id="want" className={styles.card} aria-label="Want to buy">
      <div className={styles.cardHead}>
        <span>
          <strong className={styles.cardTitle}>Want to buy</strong>
          <span className={styles.cardSub} style={{ display: 'block' }}>
            {wanted.length ? `${wanted.length} ${wanted.length === 1 ? 'thing' : 'things'} · ${money(total, cur)} in total` : 'Add what you want and see the first day it fits your forecast.'}
          </span>
        </span>
        <SheetButton className={`${styles.btn} ${styles.btnSmall}`} initiallyOpen={openNew} label={<><I d="plus" size={14} stroke={2.6} /> Add</>} title="Something you want to buy">
          <form action={addWishAction} className={styles.form}>
            <label className={styles.field}>
              What is it
              <input className={styles.input} name="name" placeholder="New laptop" required maxLength={80} autoFocus />
            </label>
            <div className={styles.row}>
              <label className={styles.field}>
                Price
                <MoneyInput name="price" currency={cur} required />
              </label>
              <label className={styles.field}>
                How much you want it
                <select name="priority" className={styles.select} defaultValue="2">
                  {PRIORITIES.map(([p, label]) => (
                    <option key={p} value={p}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className={styles.field}>
              Link <small>optional</small>
              <input className={styles.input} name="url" type="url" placeholder="https://" maxLength={500} />
            </label>
            <div className={styles.sheetActions}>
              <CloseButton className={styles.btnGhost}>Cancel</CloseButton>
              <Submit className={styles.btn}>Add to list</Submit>
            </div>
          </form>
        </SheetButton>
      </div>

      {wanted.map((w) => {
        const from = affordableFrom(fc, w.price);
        const ev = w.eventId ? events.find((e) => e.id === w.eventId) : undefined;
        const saved = ev ? jarAccrued({ id: ev.id, name: ev.name, date: ev.date, cost: ev.cost, saveMonthly: ev.saveMonthly, saveFrom: ev.saveFrom, source: ev.source }, me.today) : 0;
        const pct = ev ? Math.round((saved / w.price) * 100) : 0;
        const now = from === me.today;
        const label = ev ? `Saving · ${pct}% by ${short(ev.date)}` : now ? 'You can afford it now' : from ? `Fits from ${short(from)} · in ${diffDays(me.today, from)} days` : 'Not within the next year';
        return (
          <div key={w.id} className={styles.debtRow}>
            <span className={styles.catDot} style={{ background: now ? '#dcfce7' : '#fef3c7', color: now ? '#15803d' : '#b45309' }} aria-hidden="true">
              <I d={now ? 'check' : 'jar'} size={15} />
            </span>
            <span>
              <b>
                {w.url ? (
                  <a href={w.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                    {w.name}
                  </a>
                ) : (
                  w.name
                )}
                <span className={styles.tag}>{PRIORITIES.find(([p]) => p === w.priority)?.[1]}</span>
              </b>
              <small className={now ? styles.pos : undefined}>{label}</small>
              {ev && (
                <span className={styles.meter} style={{ display: 'block', marginTop: 6, maxWidth: 220 }}>
                  <span style={{ width: `${pct}%`, background: 'var(--sun)' }} />
                </span>
              )}
            </span>
            <b className={styles.num}>{exact(w.price, cur)}</b>
            <span className={styles.debtActions}>
              {!ev && !now && (
                <SheetButton className={`${styles.btnGhost} ${styles.btnSmall}`} label="Save for it" title={`Save for ${w.name}`} sub="A little each month, so it is paid before you buy it.">
                  <form action={saveForWishAction} className={styles.form}>
                    <input type="hidden" name="id" value={w.id} />
                    <label className={styles.field}>
                      Buy it by
                      <input className={styles.input} type="date" name="by" defaultValue={from && from > me.today ? from : addMonths(me.today, 3)} min={me.today} required />
                    </label>
                    <div className={styles.sheetActions}>
                      <CloseButton className={styles.btnGhost}>Cancel</CloseButton>
                      <Submit className={styles.btn}>Start saving</Submit>
                    </div>
                  </form>
                </SheetButton>
              )}
              <SheetButton className={`${styles.btnGhost} ${styles.btnSmall}`} label="Bought it" title={`You bought ${w.name}`} sub="It is logged in Spending as shopping.">
                <form action={boughtWishAction} className={styles.form}>
                  <input type="hidden" name="id" value={w.id} />
                  <label className={styles.field}>
                    What it cost
                    <MoneyInput name="price" currency={cur} value={w.price} required autoFocus />
                  </label>
                  <div className={styles.sheetActions}>
                    <CloseButton className={styles.btnGhost}>Cancel</CloseButton>
                    <Submit className={styles.btn}>Log it</Submit>
                  </div>
                </form>
              </SheetButton>
              <form action={deleteWishAction}>
                <input type="hidden" name="id" value={w.id} />
                <button type="submit" className={styles.xBtn} aria-label={`Remove ${w.name}`}>
                  <I d="trash" size={14} />
                </button>
              </form>
            </span>
          </div>
        );
      })}
      {bought.length > 0 && (
        <p className={styles.note}>
          Bought lately: {bought.map((w) => w.name).join(', ')}
        </p>
      )}
    </section>
  );
}
