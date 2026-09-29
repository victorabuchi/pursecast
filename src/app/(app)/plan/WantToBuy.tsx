import Link from 'next/link';
import styles from '../../../components/app/app.module.css';
import I from '../../../components/app/Icon';
import Submit from '../../../components/app/Submit';
import PhotoInput from '../../../components/app/PhotoInput';
import { MoneyInput } from '../../../components/app/Fields';
import { CloseButton, SheetButton } from '../../../components/app/Sheet';
import { db } from '../../../prisma/db';
import type { EventRow, Me } from '../../../lib/money/load';
import { addMonths, diffDays, short } from '../../../lib/money/dates';
import { exact, money } from '../../../lib/money/format';
import { jarAccrued, type Forecast } from '../../../lib/money/forecast';
import { affordableFrom, PRIORITIES } from '../../../lib/money/wish';
import { WISH_PATHS, wishIcon } from '../../../lib/money/wish-icons';
import { addWishAction, boughtWishAction, deleteWishAction, saveForWishAction, updateWishAction } from '../../../lib/money/wish-actions';

type Wish = { id: string; name: string; price: number; url: string | null; photo: string | null; priority: number };

// The photo if there is one, otherwise an icon that fits the name.
function Thumb({ w, ok }: { w: Wish; ok: boolean }) {
  if (w.photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={styles.wishThumb} src={w.photo} alt="" />;
  }
  return (
    <span className={styles.wishThumb} style={{ background: ok ? '#dcfce7' : '#f1f5f9', color: ok ? '#15803d' : '#334155' }} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={WISH_PATHS[wishIcon(w.name)]} />
      </svg>
    </span>
  );
}

function WishForm({ w, currency }: { w?: Wish; currency: string }) {
  return (
    <form action={w ? updateWishAction : addWishAction} className={styles.form}>
      {w && <input type="hidden" name="id" value={w.id} />}
      <label className={styles.field}>
        What is it
        <input className={styles.input} name="name" defaultValue={w?.name} placeholder="Acne Studios sweater" required maxLength={80} autoFocus={!w} />
      </label>
      <div className={styles.row}>
        <label className={styles.field}>
          Price
          <MoneyInput name="price" currency={currency} value={w?.price ?? null} required />
        </label>
        <label className={styles.field}>
          How much you want it
          <select name="priority" className={styles.select} defaultValue={String(w?.priority ?? 2)}>
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
        <input className={styles.input} name="url" type="url" defaultValue={w?.url ?? ''} placeholder="https://" maxLength={500} />
      </label>
      <PhotoInput current={w?.photo} label="Photo (optional)" />
      <div className={styles.sheetActions}>
        <CloseButton className={styles.btnGhost}>Cancel</CloseButton>
        <Submit className={styles.btn}>{w ? 'Save' : 'Add to list'}</Submit>
      </div>
    </form>
  );
}

// Things the person wants to buy, each with the first day it fits the
// forecast without a storm afterwards.
export default async function WantToBuy({ me, fc, events, openNew }: { me: Me; fc: Forecast; events: EventRow[]; openNew: boolean }) {
  const cur = me.currency;
  const items = await db.orm.public.WishItem.where({ userId: me.id }).orderBy([(w) => w.priority.asc(), (w) => w.createdAt.asc()]).all();
  const wanted = items.filter((w) => !w.boughtAt);
  const bought = items.filter((w) => w.boughtAt).slice(-5);
  const total = wanted.reduce((s, w) => s + w.price, 0);
  // When nothing fits, the forecast itself is the reason: say where it dips.
  const dips = fc.low.amount < fc.cushion;

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
          <WishForm currency={cur} />
        </SheetButton>
      </div>

      {wanted.some((w) => !affordableFrom(fc, w.price)) && dips && (
        <div className={styles.suggest}>
          <I d="storm" size={18} />
          <span>
            Your forecast dips to <b>{money(fc.low.amount, cur)}</b> on {short(fc.low.date)}, so nothing extra fits until that is fixed.{' '}
            <Link href="/forecast?range=1y" className={styles.linkBtn}>
              See Money Weather
            </Link>
          </span>
        </div>
      )}

      {wanted.map((w) => {
        const from = affordableFrom(fc, w.price);
        const ev = w.eventId ? events.find((e) => e.id === w.eventId) : undefined;
        const saved = ev ? jarAccrued({ id: ev.id, name: ev.name, date: ev.date, cost: ev.cost, saveMonthly: ev.saveMonthly, saveFrom: ev.saveFrom, source: ev.source }, me.today) : 0;
        const pct = ev ? Math.round((saved / w.price) * 100) : 0;
        const now = from === me.today;
        const label = ev
          ? `Saving · ${pct}% by ${short(ev.date)}`
          : now
            ? 'You can afford it now'
            : from
              ? `Fits from ${short(from)} · in ${diffDays(me.today, from)} days`
              : dips
                ? 'After the storm on ' + short(fc.low.date) + ' is fixed'
                : 'Not within the next year';
        return (
          <div key={w.id} className={styles.debtRow}>
            <Thumb w={w} ok={now} />
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
              <SheetButton className={styles.xBtn} ariaLabel={`Edit ${w.name}`} label={<I d="edit" size={14} />} title={`Edit ${w.name}`}>
                <WishForm w={w} currency={cur} />
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
      {bought.length > 0 && <p className={styles.note}>Bought lately: {bought.map((w) => w.name).join(', ')}</p>}
    </section>
  );
}
