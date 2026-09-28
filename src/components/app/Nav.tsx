'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './app.module.css';
import I, { type IconName } from './Icon';

export const NAV: Array<[IconName, string, string]> = [
  ['sun', 'Forecast', '/forecast'],
  ['list', 'Spending', '/spending'],
  ['heart', 'Worth-It', '/worth-it'],
  ['fork', 'Forks', '/forks'],
  ['cal', 'Plan', '/plan'],
];

export function Rail() {
  const path = usePathname();
  return (
    <nav className={styles.rail} aria-label="Main">
      {NAV.map(([icon, label, href]) => (
        <Link key={href} href={href} className={styles.railItem} data-active={path.startsWith(href)} aria-label={label} aria-current={path.startsWith(href) ? 'page' : undefined}>
          <I d={icon} size={20} />
          <span>{label}</span>
        </Link>
      ))}
      <span className={styles.railSpacer} />
      <Link href="/settings" className={styles.railItem} data-active={path.startsWith('/settings')} aria-label="Settings">
        <I d="gear" size={20} />
        <span>Settings</span>
      </Link>
    </nav>
  );
}

export function Tabs() {
  const path = usePathname();
  return (
    <nav className={styles.tabs} aria-label="Main">
      {NAV.map(([icon, label, href]) => (
        <Link key={href} href={href} className={styles.tabItem} data-active={path.startsWith(href)} aria-current={path.startsWith(href) ? 'page' : undefined}>
          <I d={icon} size={20} />
          <small>{label}</small>
        </Link>
      ))}
    </nav>
  );
}
