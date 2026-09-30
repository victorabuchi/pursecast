import Link from 'next/link';
import styles from './legal.module.css';
import Mark from '../Mark';

export const CONTACT = 'contact@victorabuchi.com';

// The frame for the privacy notice and the terms.
export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <Link href="/">
          <Mark size={22} /> Pursecast
        </Link>
      </header>
      <main className={styles.body}>
        <h1>{title}</h1>
        <p className={styles.updated}>Last updated {updated}</p>
        {children}
      </main>
    </div>
  );
}
