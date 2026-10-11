'use client';

import { useEffect } from 'react';
import confetti from 'canvas-confetti';

// Confetti once per day per occasion (a birthday, a goal reached).
export default function Celebrate({ id }: { id: string }) {
  useEffect(() => {
    const key = `pursecast:celebrated:${id}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
    } catch {}
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const fire = (x: number) => confetti({ particleCount: 90, spread: 70, startVelocity: 38, origin: { x, y: 0.35 }, colors: ['#0f7a63', '#f5a524', '#ffffff', '#7c3aed'] });
    fire(0.3);
    const t = window.setTimeout(() => fire(0.7), 250);
    return () => window.clearTimeout(t);
  }, [id]);
  return null;
}
