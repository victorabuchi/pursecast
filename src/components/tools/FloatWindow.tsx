'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './tools.module.css';

// A window that floats over the app and is dragged by its title bar. Where
// it was left is remembered in this browser; the last one touched is on top.

let topZ = 90;
const KEY = (id: string) => `pursecast:win:${id}`;

// Keeps the whole window on screen when it fits, and its title bar always.
function clamp(x: number, y: number, el: HTMLElement | null) {
  const w = el?.offsetWidth ?? 320;
  const h = el?.offsetHeight ?? 200;
  // The visible area, not innerWidth, which grows when a window pokes out.
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  return {
    x: Math.max(8, Math.min(x, vw - w - 8)),
    y: Math.max(8, Math.min(y, vh - Math.min(h, 120) - 8)),
  };
}

// Children mark their title bar with data-drag; pressing there moves it.
export default function FloatWindow({ id, start, className, label, children }: { id: string; start: () => { x: number; y: number }; className?: string; label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [z, setZ] = useState(() => ++topZ);

  useEffect(() => {
    let saved: { x: number; y: number } | null = null;
    try {
      saved = JSON.parse(window.localStorage.getItem(KEY(id)) ?? 'null');
    } catch {
      saved = null;
    }
    const p = saved ?? start();
    queueMicrotask(() => setPos(clamp(p.x, p.y, ref.current)));
    // Re-fit when the screen or the window itself changes size.
    const onResize = () => setPos((q) => (q ? clamp(q.x, q.y, ref.current) : q));
    window.addEventListener('resize', onResize);
    const observer = new ResizeObserver(onResize);
    if (ref.current) observer.observe(ref.current);
    return () => {
      window.removeEventListener('resize', onResize);
      observer.disconnect();
    };
  }, [id, start]);

  const front = useCallback(() => setZ(++topZ), []);

  const drag = useCallback(
    (e: React.PointerEvent) => {
      const target = e.target as HTMLElement;
      // Only the title bar drags, and its buttons stay clickable.
      if (!target.closest('[data-drag]') || target.closest('button, input, textarea, a') || !pos) return;
      e.preventDefault();
      front();
      const dx = e.clientX - pos.x;
      const dy = e.clientY - pos.y;
      const move = (ev: PointerEvent) => setPos(clamp(ev.clientX - dx, ev.clientY - dy, ref.current));
      const up = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        try {
          window.localStorage.setItem(KEY(id), JSON.stringify(clamp(ev.clientX - dx, ev.clientY - dy, ref.current)));
        } catch {
          // Position just is not remembered.
        }
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [front, id, pos],
  );

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      className={`${styles.window} ${className ?? ''}`}
      style={{
        left: pos?.x ?? -9999,
        top: pos?.y ?? -9999,
        zIndex: z,
        visibility: pos ? 'visible' : 'hidden',
      }}
      onPointerDown={(e) => {
        front();
        drag(e);
      }}
    >
      {children}
    </div>
  );
}
