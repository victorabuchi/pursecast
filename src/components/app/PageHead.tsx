import styles from './app.module.css';
import I, { type IconName } from './Icon';

export default function PageHead({ title, sub, icon, right }: { title: string; sub: string; icon: IconName; right?: React.ReactNode }) {
  return (
    <div className={styles.pageHead}>
      <span className={styles.pageIcon}>
        <I d={icon} size={22} />
      </span>
      <div>
        <h1>{title}</h1>
        <small>{sub}</small>
      </div>
      {right && <span className={styles.headRight}>{right}</span>}
    </div>
  );
}
