import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '../../../components/app/app.module.css';
import I from '../../../components/app/Icon';
import ConfirmX from '../../../components/app/ConfirmX';
import PageHead from '../../../components/app/PageHead';
import Faces from '../../../components/app/Faces';
import Submit from '../../../components/app/Submit';
import NoteForm from '../../../components/app/NoteForm';
import { SheetButton } from '../../../components/app/Sheet';
import { deleteNoteAction } from '../../../lib/money/note-actions';
import { loadMoney } from '../../../lib/money/load';
import { db } from '../../../prisma/db';
import { addDays, isoAgo, relative, short, weekday } from '../../../lib/money/dates';
import { exact, money } from '../../../lib/money/format';
import { adviceFor, isMood, joyByCategory, RATE_AFTER_DAYS, type Rated } from '../../../lib/money/worth';
import MoodIcon from '../../../components/app/MoodIcon';
import { moveValueAction } from '../../../lib/money/actions';

export const metadata: Metadata = { title: 'Worth-It', robots: { index: false } };

export default async function WorthPage({ searchParams }: PageProps<'/worth-it'>) {
  const params = await searchParams;
  const showAll = Boolean(params['all']);
  const { me, cats, entries } = await loadMoney();
  const cur = me.currency;
  const catById = new Map(cats.map((c) => [c.id, c]));
  const rateable = (e: (typeof entries)[number]) => e.amount < 0 && !e.debtId && (!e.categoryId || catById.get(e.categoryId)?.kind === 'flex');

  const readyBy = addDays(me.today, -RATE_AFTER_DAYS);
  const window = entries.filter((e) => rateable(e) && e.date >= addDays(me.today, -30));
  const ready = window.filter((e) => e.date <= readyBy);
  const toRate = [...ready.filter((e) => !e.mood), ...ready.filter((e) => e.mood)].slice(0, showAll ? 40 : 6);
  const soon = window.filter((e) => e.date > readyBy && !e.mood);

  const rated: Rated[] = entries
    .filter((e) => rateable(e) && isMood(e.mood) && e.date >= addDays(me.today, -90))
    .map((e) => ({ categoryId: e.categoryId, categoryName: e.categoryId ? (catById.get(e.categoryId)?.name ?? 'Other') : 'No category', amount: e.amount, mood: e.mood as Rated['mood'], date: e.date }));
  const joy = joyByCategory(rated);
  const movedRecently = await db.orm.public.BudgetMove.where({ userId: me.id, reason: 'value' })
    .where((m) => m.createdAt.gte(isoAgo(30)))
    .all();
  const advice = adviceFor(
    joy,
    cats.filter((c) => c.kind === 'flex').map((c) => ({ id: c.id, name: c.name, budget: c.budget })),
    new Set(movedRecently.map((m) => m.fromCategoryId)),
  );
  const loved = rated.filter((r) => r.mood === 'love').length;
  const notes = await db.orm.public.FutureNote.where({ userId: me.id }).orderBy((n) => n.createdAt.desc()).all();
  const flexCats = cats.filter((c) => c.kind === 'flex').map((c) => ({ id: c.id, name: c.name }));

  return (
    <>
      <PageHead title="Worth-It" sub="Rated two days later" icon="heart" right={<span className={styles.pill}>Joy per euro</span>} />
      <div className={styles.split}>
        <div className={styles.stack}>
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <strong className={styles.cardTitle}>Was it worth it?</strong>
              <span className={styles.cardSub}>{ready.filter((e) => !e.mood).length} to rate</span>
            </div>
            {toRate.length === 0 && (
              <div className={styles.empty}>
                <b>Nothing to rate yet.</b>
                Purchases show up here {RATE_AFTER_DAYS} days after you log them, when you know whether they were worth it.
                <Link href="/spending?add=1" className={styles.linkBtn}>
                  Log a purchase
                </Link>
              </div>
            )}
            {toRate.map((e) => (
              <div key={e.id} className={styles.buy}>
                <span>
                  <b>{e.note}</b>
                  <small>
                    {relative(e.date, me.today).length <= 3 ? weekday(e.date) : relative(e.date, me.today)} · {e.categoryId ? (catById.get(e.categoryId)?.name ?? 'Other') : 'No category'}
                  </small>
                </span>
                <b className={styles.num}>{exact(-e.amount, cur)}</b>
                <Faces id={e.id} mood={e.mood} back="/worth-it" />
              </div>
            ))}
            {!showAll && ready.length > toRate.length && (
              <Link href="/worth-it?all=1" className={styles.linkBtn}>
                Show all {ready.length}
              </Link>
            )}
            {soon.length > 0 && (
              <p className={styles.note}>
                {soon.length} more {soon.length === 1 ? 'purchase' : 'purchases'} from the last {RATE_AFTER_DAYS} days will be ready to rate soon. The bell tells you.
              </p>
            )}
          </div>

          {advice && (
            <div className={`${styles.card} ${styles.advice}`}>
              <span className={styles.adviceIcon}>
                <I d="bulb" size={20} />
              </span>
              <div>
                <b>Budget by value</b>
                <p>
                  You regretted {advice.from.name.toLowerCase()} {advice.regrets} of your last {advice.of} times. Move {money(advice.amount, cur)} a month to {advice.to.name.toLowerCase()}?
                </p>
                <div className={styles.moves}>
                  <span>
                    {advice.from.name} <s className={styles.muted}>{money(advice.from.budget, cur)}</s> <b>{money(advice.from.budget - advice.amount, cur)}</b>
                  </span>
                  <I d="arrow" size={14} />
                  <span>
                    {advice.to.name} <s className={styles.muted}>{money(advice.to.budget, cur)}</s> <b>{money(advice.to.budget + advice.amount, cur)}</b>
                  </span>
                </div>
              </div>
              <form action={moveValueAction}>
                <input type="hidden" name="from" value={advice.from.id} />
                <input type="hidden" name="to" value={advice.to.id} />
                <input type="hidden" name="amount" value={String(advice.amount / 100)} />
                <Submit className={styles.btn} pending="Moving…">
                  Move {money(advice.amount, cur)}
                </Submit>
              </form>
            </div>
          )}
          {!advice && rated.length > 0 && (
            <div className={styles.tipCard}>
              <b>Keep rating.</b> After a few ratings in the same category, Pursecast suggests moving money from what you regret to what you love.
            </div>
          )}
        </div>

        <div className={styles.stack}>
          <div className={styles.card}>
            <strong className={styles.cardTitle}>Joy per euro · 90 days</strong>
            {joy.length === 0 && <p className={styles.note}>Rate a few purchases and your map of what is worth it appears here.</p>}
            {joy.map((j) => (
              <div key={j.categoryId ?? 'none'} className={styles.barRow}>
                <span>
                  {j.name}
                  <b className={styles.num}>{j.score.toFixed(1)}</b>
                </span>
                <div className={styles.meter}>
                  <span style={{ width: `${Math.max(3, j.score * 10)}%`, background: j.score < 4 ? '#e5484d' : j.score < 6 ? '#f5a524' : undefined }} />
                </div>
              </div>
            ))}
          </div>
          {rated.length > 0 && (
            <div className={styles.card}>
              <strong className={styles.cardTitle}>Your ratings</strong>
              <p className={styles.note}>
                {rated.length} {rated.length === 1 ? 'purchase' : 'purchases'} rated in 90 days · <MoodIcon mood="love" size={15} /> {Math.round((loved / rated.length) * 100)}% loved
              </p>
            </div>
          )}
        </div>
      </div>

      <section className={styles.card} aria-label="Future-self notes">
        <div className={styles.cardHead}>
          <span>
            <strong className={styles.cardTitle}>Future-self notes</strong>
            <span className={styles.cardSub} style={{ display: 'block' }}>
              A note to yourself, played back before you spend where you have regretted it before.
            </span>
          </span>
          <SheetButton className={`${styles.btn} ${styles.btnSmall}`} initiallyOpen={Boolean(params['note'])} label={<><I d="mic" size={14} /> New note</>} title="A note to future you" sub="Write it, or say it. You will hear it at the right moment." wide>
            <NoteForm categories={flexCats} today={me.today} />
          </SheetButton>
        </div>
        {notes.length === 0 && (
          <div className={styles.empty}>
            <b>No notes yet.</b>
            Saving for something? Tell future you, like &quot;You&apos;re saving for Japan. Is this worth 2 days there?&quot;
          </div>
        )}
        <div className={styles.split2}>
          {notes.map((n) => {
            const cat = n.categoryId ? catById.get(n.categoryId) : undefined;
            const ended = n.until && n.until < me.today;
            return (
              <div key={n.id} className={styles.noteCard} style={ended ? { opacity: 0.55 } : undefined}>
                <span className={styles.noteIcon}>
                  <I d={n.audio ? 'mic' : 'heart'} size={18} />
                </span>
                <div>
                  <q>{n.text}</q>
                  {n.audio && <audio src={n.audio} controls preload="none" style={{ width: '100%', height: 36 }} />}
                  <small>
                    Before {cat ? cat.name.toLowerCase() : 'anything you tend to regret'}
                    {n.until ? ` · ${ended ? 'ended' : 'until'} ${short(n.until)}` : ''}
                  </small>
                  <small>
                    Played {n.shown} {n.shown === 1 ? 'time' : 'times'} · skipped {n.skipped} · {money(n.saved, cur)} kept
                  </small>
                </div>
                <form action={deleteNoteAction}>
                  <input type="hidden" name="id" value={n.id} />
                  <ConfirmX label="Remove note" icon="trash" />
                </form>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
