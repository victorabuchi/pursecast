'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// A popover that sits above the note window instead of inside it, so it can
// reach past the window's edges like on a Mac. It anchors to the element it
// is placed in and keeps the window's colours.
const VARS = ['--w-fg', '--w-note', '--w-muted', '--w-line', '--w-soft', '--w-soft-on', '--n-accent', '--n-pop', '--n-pop-line'];

export default function Floating({ className, width, children }: { className: string; width: number; children: React.ReactNode }) {
  const mark = useRef<HTMLSpanElement>(null);
  const [place, setPlace] = useState<{ left: number; bottom: number; vars: Record<string, string> } | null>(null);

  useLayoutEffect(() => {
    const anchor = mark.current?.parentElement;
    if (!anchor) return;
    const measure = () => {
      const r = anchor.getBoundingClientRect();
      const css = getComputedStyle(anchor);
      const vw = document.documentElement.clientWidth;
      setPlace({
        left: Math.max(8, Math.min(r.left + r.width / 2 - width / 2, vw - width - 8)),
        bottom: window.innerHeight - r.top + 10,
        vars: Object.fromEntries(VARS.map((v) => [v, css.getPropertyValue(v)])),
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [width]);

  return (
    <>
      <span ref={mark} hidden />
      {place &&
        createPortal(
          <div className={className} style={{ ...place.vars, position: 'fixed', left: place.left, bottom: place.bottom, top: 'auto', right: 'auto', width, zIndex: 1000, transform: 'none', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" } as React.CSSProperties} onPointerDown={(e) => e.stopPropagation()}>
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
