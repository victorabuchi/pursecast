'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import styles from './landing.module.css';
import { ICONS } from '../../lib/icons';

export type MenuItem = { title: string; desc: string; href: string; icon: string };
export type Menu = {
  id: string;
  label: string;
  columns: Array<{ heading: string; items: MenuItem[] }>;
  side: { heading: string; links: Array<{ label: string; href: string }> };
  footer: { label: string; href: string };
};


function Icon({ name }: { name: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name] ?? ICONS['sun']} />
    </svg>
  );
}

function Go({ href, className, onClick, children }: { href: string; className?: string; onClick?: () => void; children: React.ReactNode }) {
  if (href.startsWith('/')) {
    return (
      <Link href={href} className={className} onClick={onClick}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  );
}

// Top bar with hover cards: pointing at a menu opens a card that explains
// each feature, like a product site's mega menu. On phones it folds into one list.
export default function LandingNav({
  logo,
  menus,
  plain,
  actions,
  mobileExtra,
  menuLabel,
}: {
  logo: React.ReactNode;
  menus: Menu[];
  plain: Array<{ label: string; href: string }>;
  actions: React.ReactNode;
  mobileExtra: React.ReactNode;
  menuLabel: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const active = menus.find((m) => m.id === open) ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(null);
        setMobile(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const show = (id: string) => {
    window.clearTimeout(timer.current);
    setOpen(id);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(null), 140);
  };
  const close = () => {
    setOpen(null);
    setMobile(false);
  };

  return (
    <nav className={styles.nav} onMouseLeave={hide}>
      <div className={`${styles.wrap} ${styles.navInner}`}>
        <Link href="/" className={styles.navLogo} aria-label="Pursecast" onClick={close}>
          {logo}
        </Link>
        <ul className={styles.navLinks}>
          {menus.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className={styles.trigger}
                aria-expanded={open === m.id}
                aria-haspopup="true"
                onMouseEnter={() => show(m.id)}
                onFocus={() => show(m.id)}
                onClick={() => (open === m.id ? setOpen(null) : show(m.id))}
              >
                {m.label}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            </li>
          ))}
          {plain.map((p) => (
            <li key={p.href}>
              <a href={p.href} className={styles.trigger} onMouseEnter={() => setOpen(null)}>
                {p.label}
              </a>
            </li>
          ))}
        </ul>
        <div className={styles.navActions} onMouseEnter={() => setOpen(null)}>
          {actions}
          <button type="button" className={styles.menuBtn} aria-label={menuLabel} aria-expanded={mobile} onClick={() => setMobile((v) => !v)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {mobile ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {active && (
        <div className={styles.panelWrap}>
          <div className={styles.panel} role="menu" onMouseEnter={() => show(active.id)}>
            <div className={styles.panelGrid}>
              {active.columns.map((col) => (
                <div key={col.heading} className={styles.panelCol}>
                  <div className={styles.panelHeading}>{col.heading}</div>
                  {col.items.map((item) => (
                    <Go key={item.title} href={item.href} className={styles.panelItem} onClick={close}>
                      <span className={styles.panelIcon}>
                        <Icon name={item.icon} />
                      </span>
                      <span>
                        <span className={styles.panelTitle}>{item.title}</span>
                        <span className={styles.panelDesc}>{item.desc}</span>
                      </span>
                    </Go>
                  ))}
                </div>
              ))}
              <div className={`${styles.panelCol} ${styles.panelSide}`}>
                <div className={styles.panelHeading}>{active.side.heading}</div>
                {active.side.links.map((l) => (
                  <Go key={l.href} href={l.href} className={styles.panelSideLink} onClick={close}>
                    {l.label}
                  </Go>
                ))}
              </div>
            </div>
            <Go href={active.footer.href} className={styles.panelFooter} onClick={close}>
              {active.footer.label}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </Go>
          </div>
        </div>
      )}

      {mobile && (
        <div className={styles.mobilePanel}>
          {menus.map((m) => (
            <details key={m.id} className={styles.mobileGroup}>
              <summary>{m.label}</summary>
              {m.columns.flatMap((c) => c.items).map((item) => (
                <Go key={item.title} href={item.href} className={styles.panelItem} onClick={close}>
                  <span className={styles.panelIcon}>
                    <Icon name={item.icon} />
                  </span>
                  <span>
                    <span className={styles.panelTitle}>{item.title}</span>
                    <span className={styles.panelDesc}>{item.desc}</span>
                  </span>
                </Go>
              ))}
            </details>
          ))}
          {plain.map((p) => (
            <a key={p.href} href={p.href} className={styles.mobileLink} onClick={close}>
              {p.label}
            </a>
          ))}
          {mobileExtra}
        </div>
      )}
    </nav>
  );
}
