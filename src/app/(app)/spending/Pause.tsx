import styles from '../../../components/app/app.module.css';
import Submit from '../../../components/app/Submit';
import { UrlSheet } from '../../../components/app/Sheet';
import { db } from '../../../prisma/db';
import type { Cat, Me } from '../../../lib/money/load';
import { short } from '../../../lib/money/dates';
import { exact, money } from '../../../lib/money/format';
import { parseQuick } from '../../../lib/money/categories';
import { quickAddAction } from '../../../lib/money/actions';
import { skipSpendAction } from '../../../lib/money/note-actions';

// Before a purchase future you may regret: the note you left, then a choice.
export default async function Pause({ me, cats, params }: { me: Me; cats: Cat[]; params: Record<string, string | string[] | undefined> }) {
  const one = (k: string) => (typeof params[k] === 'string' ? params[k] : '');
  const note = await db.orm.public.FutureNote.where({ id: one('pause'), userId: me.id }).first();
  const parsed = parseQuick(one('text'));
  if (!note || !parsed) return null;
  const cat = cats.find((c) => c.id === one('categoryId'));
  const why = one('why');
  const regret = /^r(\d+)\/(\d+)$/.exec(why);
  const over = /^b(\d+)$/.exec(why);

  return (
    <UrlSheet title="Wait. A note from past you." drop={['pause', 'text', 'date', 'categoryId', 'why']}>
      <div className={styles.playback}>
        {note.audio && <audio src={note.audio} controls autoPlay />}
        <q>{note.text}</q>
        <small>
          You wrote this on {short(note.createdAt.slice(0, 10))}
          {note.skipped > 0 ? ` · it has kept ${money(note.saved, me.currency)} for you so far` : ''}
        </small>
      </div>
      <div className={styles.details}>
        <span>
          {parsed.note} {cat && <small>{cat.name}</small>} <b>{exact(-parsed.amount, me.currency)}</b>
        </span>
      </div>
      <p className={styles.note}>
        {regret
          ? `You regretted ${cat?.name.toLowerCase() ?? 'this'} ${regret[1]} of your last ${regret[2]} times.`
          : over
            ? `This takes you ${money(Number(over[1]), me.currency)} over your ${cat?.name.toLowerCase() ?? ''} budget this month.`
            : ''}
      </p>
      <div className={styles.sheetActions}>
        <form action={quickAddAction}>
          <input type="hidden" name="text" value={one('text')} />
          <input type="hidden" name="date" value={one('date')} />
          <input type="hidden" name="categoryId" value={one('categoryId')} />
          <input type="hidden" name="confirm" value="1" />
          <input type="hidden" name="back" value="/spending" />
          <Submit className={styles.btnGhost}>Log it anyway</Submit>
        </form>
        <form action={skipSpendAction}>
          <input type="hidden" name="note" value={note.id} />
          <input type="hidden" name="amount" value={String(-parsed.amount / 100)} />
          <input type="hidden" name="back" value="/spending" />
          <Submit className={`${styles.btn} ${styles.btnWide}`}>Skip it</Submit>
        </form>
      </div>
    </UrlSheet>
  );
}
