'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './app.module.css';
import I from './Icon';

// A sheet like the film's: a dialog on desktop, sliding up from the bottom on
// phones. Built on <dialog> so focus, Escape and the backdrop work natively.

const CloseContext = createContext<() => void>(() => {});
export const useCloseSheet = () => useContext(CloseContext);

export function Sheet({ open, onClose, title, sub, wide, children }: { open: boolean; onClose: () => void; title: React.ReactNode; sub?: React.ReactNode; wide?: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`${styles.sheet} ${wide ? styles.sheetWide : ''}`}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open && (
        <CloseContext.Provider value={onClose}>
          <div className={styles.sheetInner}>
            <span className={styles.grabber} />
            <div className={styles.sheetHead}>
              <div>
                <strong>{title}</strong>
                {sub && <p>{sub}</p>}
              </div>
              <button type="button" className={styles.xBtn} onClick={onClose} aria-label="Close">
                <I d="x" size={16} />
              </button>
            </div>
            {children}
          </div>
        </CloseContext.Provider>
      )}
    </dialog>
  );
}

// A button that opens a sheet.
export function SheetButton({
  label,
  className,
  title,
  sub,
  wide,
  initiallyOpen = false,
  ariaLabel,
  children,
}: {
  label: React.ReactNode;
  className?: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  wide?: boolean;
  initiallyOpen?: boolean;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} aria-label={ariaLabel}>
        {label}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title} sub={sub} wide={wide}>
        {children}
      </Sheet>
    </>
  );
}

export function CloseButton({ className, children }: { className?: string; children: React.ReactNode }) {
  const close = useCloseSheet();
  return (
    <button type="button" className={className} onClick={close}>
      {children}
    </button>
  );
}

// A sheet opened by the address (?week=, ?event=, ?new=1): the server renders
// it when the parameter is there, and closing it drops the parameter.
export function UrlSheet({ title, sub, wide, drop, children }: { title: React.ReactNode; sub?: React.ReactNode; wide?: boolean; drop: string[]; children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const close = () => {
    setOpen(false);
    const url = new URL(window.location.href);
    for (const p of drop) url.searchParams.delete(p);
    router.replace(url.pathname + url.search, { scroll: false });
  };
  return (
    <Sheet open={open} onClose={close} title={title} sub={sub} wide={wide}>
      {children}
    </Sheet>
  );
}
