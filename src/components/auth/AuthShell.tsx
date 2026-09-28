import Link from 'next/link';
import Mark from '../Mark';
import styles from './auth.module.css';

// Frame for sign-in pages: logo and heading on the hero background, one card,
// and an optional line under it.
export default function AuthShell({ title, lede, below, children }: { title: string; lede?: string; below?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={styles.page}>
      <div className={styles.aurora} aria-hidden="true" />
      <header className={styles.head}>
        <Link href="/" className={styles.logo}>
          <span className={styles.tile}>
            <Mark size={22} />
          </span>
          Pursecast
        </Link>
        <h1>{title}</h1>
        {lede && <p>{lede}</p>}
      </header>
      <main className={styles.card}>{children}</main>
      {below && <p className={styles.switch}>{below}</p>}
    </div>
  );
}
