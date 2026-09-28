import styles from './app.module.css';
import { MOODS } from '../../lib/money/worth';
import { rateAction } from '../../lib/money/actions';

// 😍 😐 😩 for one purchase. Works without JavaScript: each face submits.
export default function Faces({ id, mood, back, small }: { id: string; mood: string | null; back: string; small?: boolean }) {
  return (
    <form action={rateAction} className={`${styles.faces} ${small ? styles.faceSmall : ''}`}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="back" value={back} />
      {MOODS.map(([m, face, label]) => (
        <button key={m} type="submit" name="mood" value={m} className={styles.face} data-on={mood === m || undefined} data-dim={(mood && mood !== m) || undefined} aria-label={label} aria-pressed={mood === m} title={label}>
          {face}
        </button>
      ))}
    </form>
  );
}
