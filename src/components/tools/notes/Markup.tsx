'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './notes.module.css';
import Floating from './Floating';

// Drawing on the note, after macOS Notes markup: pens with their own feel,
// five widths, colours, shapes, text and a signature. Strokes stay editable
// (select and move) until Done, when the drawing goes into the note as a
// picture.

export type Tool = 'pen' | 'monoline' | 'marker' | 'pencil' | 'crayon' | 'fountain' | 'reed' | 'watercolour' | 'eraser';
type Pt = { x: number; y: number; t: number };
type Shape = 'line' | 'arrow' | 'rect' | 'roundrect' | 'oval' | 'bubble' | 'star' | 'hexagon';
type Item =
  | { kind: 'path'; tool: Tool; color: string; width: number; pts: Pt[]; seed: number }
  | { kind: 'shape'; shape: Shape; color: string; width: number; a: Pt; b: Pt }
  | { kind: 'text'; color: string; size: number; x: number; y: number; text: string };

export const TOOLS: Array<[Tool, string]> = [
  ['pen', 'Pen'],
  ['monoline', 'Monoline'],
  ['marker', 'Marker'],
  ['pencil', 'Pencil'],
  ['crayon', 'Crayon'],
  ['fountain', 'Fountain Pen'],
  ['reed', 'Reed'],
  ['watercolour', 'Watercolour'],
  ['eraser', 'Eraser'],
];
const WIDTHS = [1.5, 2.5, 4, 6, 9];
// The quick row, then a grid of greys and every hue from dark to light, as on a Mac.
const QUICK = ['#eb4d3d', '#f19a37', '#fdfc4b', '#6ff54e', '#6ffcfc', '#1d36f5', '#ea56f5', '#8b2e8f', '#a07a4c', '#ffffff', '#929292', '#000000'];
const HUES = [195, 222, 250, 276, 330, 6, 22, 36, 46, 56, 68, 96];
const GRID: string[][] = [
  Array.from({ length: 12 }, (_, i) => `hsl(0 0% ${Math.round(100 - (i * 100) / 11)}%)`),
  ...Array.from({ length: 9 }, (_, row) => HUES.map((h) => `hsl(${h} ${h > 40 && h < 70 ? 85 : 70}% ${16 + row * 9}%)`)),
];
const SHAPES: Array<[Shape, string, string]> = [
  ['line', 'Line', 'M5 19 19 5'],
  ['arrow', 'Arrow', 'M5 19 18 6M11 6h7v7'],
  ['rect', 'Square', 'M5 5h14v14H5Z'],
  ['roundrect', 'Rounded square', 'M8 5h8a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Z'],
  ['oval', 'Circle', 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z'],
  ['bubble', 'Speech bubble', 'M6 5h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-6l-4 3v-3H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z'],
  ['star', 'Star', 'M12 4l2.4 5 5.4.7-4 3.7 1 5.4L12 16.3 7.2 18.8l1-5.4-4-3.7 5.4-.7Z'],
  ['hexagon', 'Hexagon', 'M12 3.5 19.5 8v8L12 20.5 4.5 16V8Z'],
];

// A tiny repeatable random, so textured pens look the same on every redraw.
function rand(seed: number) {
  let s = seed || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function drawPath(ctx: CanvasRenderingContext2D, it: Extract<Item, { kind: 'path' }>) {
  const { pts, color, width, tool } = it;
  if (!pts.length) return;
  const r = rand(it.seed);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const segment = (w: number, a: Pt, b: Pt) => {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };
  const speed = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y) / Math.max(1, b.t - a.t);
  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0]!.x, pts[0]!.y, width / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  switch (tool) {
    case 'monoline':
      ctx.lineWidth = width;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      break;
    case 'pen':
      // A little thinner when fast, like ink.
      for (let i = 1; i < pts.length; i++) segment(width * Math.max(0.6, 1.15 - speed(pts[i - 1]!, pts[i]!) * 0.25), pts[i - 1]!, pts[i]!);
      break;
    case 'marker':
      ctx.globalAlpha = 0.38;
      ctx.lineCap = 'square';
      ctx.lineWidth = width * 3.2;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      break;
    case 'pencil':
      ctx.globalAlpha = 0.75;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]!;
        const b = pts[i]!;
        for (let k = 0; k < 3; k++) segment(width * 0.45, { ...a, x: a.x + (r() - 0.5) * width * 0.6, y: a.y + (r() - 0.5) * width * 0.6 }, { ...b, x: b.x + (r() - 0.5) * width * 0.6, y: b.y + (r() - 0.5) * width * 0.6 });
      }
      break;
    case 'crayon':
      ctx.globalAlpha = 0.55;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]!;
        const b = pts[i]!;
        const steps = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 1.5));
        for (let s = 0; s < steps; s++) {
          const x = a.x + ((b.x - a.x) * s) / steps;
          const y = a.y + ((b.y - a.y) * s) / steps;
          for (let k = 0; k < 6; k++) {
            if (r() < 0.35) continue;
            ctx.fillRect(x + (r() - 0.5) * width * 2.2, y + (r() - 0.5) * width * 2.2, 1.3, 1.3);
          }
        }
      }
      break;
    case 'fountain':
      // Slow is thick, fast is thin, with a slanted nib.
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]!;
        const b = pts[i]!;
        const w = width * Math.max(0.35, 1.6 - speed(a, b) * 0.6);
        ctx.lineCap = 'butt';
        segment(w, a, b);
        segment(w * 0.5, { ...a, x: a.x + 0.6, y: a.y - 0.6 }, { ...b, x: b.x + 0.6, y: b.y - 0.6 });
      }
      break;
    case 'reed':
      // A broad flat nib: wide across, thin along 45 degrees.
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]!;
        const b = pts[i]!;
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        const w = width * (0.5 + 1.6 * Math.abs(Math.sin(angle - Math.PI / 4)));
        ctx.lineCap = 'butt';
        segment(w, a, b);
      }
      break;
    case 'watercolour':
      ctx.globalAlpha = 0.09;
      for (let k = 0; k < 4; k++) {
        ctx.lineWidth = width * (4 + k * 1.3);
        ctx.beginPath();
        pts.forEach((p, i) => {
          const x = p.x + (r() - 0.5) * 2;
          const y = p.y + (r() - 0.5) * 2;
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        });
        ctx.stroke();
      }
      break;
    default:
      break;
  }
  ctx.restore();
}

function drawShape(ctx: CanvasRenderingContext2D, it: Extract<Item, { kind: 'shape' }>) {
  const { a, b, color, width, shape } = it;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const w = Math.abs(b.x - a.x);
  const h = Math.abs(b.y - a.y);
  const cx = x + w / 2;
  const cy = y + h / 2;
  if (shape === 'rect') ctx.rect(x, y, w, h);
  else if (shape === 'roundrect') ctx.roundRect(x, y, w, h, Math.min(w, h) * 0.18);
  else if (shape === 'bubble') {
    ctx.roundRect(x, y, w, h * 0.78, Math.min(w, h) * 0.15);
    ctx.moveTo(x + w * 0.25, y + h * 0.78);
    ctx.lineTo(x + w * 0.2, y + h);
    ctx.lineTo(x + w * 0.42, y + h * 0.78);
  } else if (shape === 'star' || shape === 'hexagon') {
    const n = shape === 'star' ? 10 : 6;
    for (let i = 0; i <= n; i++) {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const r = shape === 'star' && i % 2 ? 0.42 : 1;
      const px = cx + (w / 2) * r * Math.cos(ang);
      const py = cy + (h / 2) * r * Math.sin(ang);
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.closePath();
  } else if (shape === 'oval') ctx.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2);
  else {
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    if (shape === 'arrow') {
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const head = 10 + width * 2;
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - head * Math.cos(ang - 0.45), b.y - head * Math.sin(ang - 0.45));
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - head * Math.cos(ang + 0.45), b.y - head * Math.sin(ang + 0.45));
    }
  }
  ctx.stroke();
  ctx.restore();
}

function drawItem(ctx: CanvasRenderingContext2D, it: Item) {
  if (it.kind === 'path') drawPath(ctx, it);
  else if (it.kind === 'shape') drawShape(ctx, it);
  else {
    ctx.save();
    ctx.fillStyle = it.color;
    ctx.font = `${it.size}px -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    it.text.split('\n').forEach((line, i) => ctx.fillText(line, it.x, it.y + i * it.size * 1.25));
    ctx.restore();
  }
}

function bounds(it: Item): { x: number; y: number; w: number; h: number } {
  if (it.kind === 'path') {
    const xs = it.pts.map((p) => p.x);
    const ys = it.pts.map((p) => p.y);
    const pad = it.width * (it.tool === 'watercolour' ? 6 : it.tool === 'marker' ? 2 : 1.5);
    return { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + pad * 2 };
  }
  if (it.kind === 'shape') {
    const pad = it.width + 12;
    return { x: Math.min(it.a.x, it.b.x) - pad, y: Math.min(it.a.y, it.b.y) - pad, w: Math.abs(it.b.x - it.a.x) + pad * 2, h: Math.abs(it.b.y - it.a.y) + pad * 2 };
  }
  const lines = it.text.split('\n');
  return { x: it.x - 4, y: it.y - 4, w: Math.max(...lines.map((l) => l.length)) * it.size * 0.6 + 8, h: lines.length * it.size * 1.25 + 8 };
}

function moved(it: Item, dx: number, dy: number): Item {
  if (it.kind === 'path') return { ...it, pts: it.pts.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })) };
  if (it.kind === 'shape') return { ...it, a: { ...it.a, x: it.a.x + dx, y: it.a.y + dy }, b: { ...it.b, x: it.b.x + dx, y: it.b.y + dy } };
  return { ...it, x: it.x + dx, y: it.y + dy };
}

const hit = (box: { x: number; y: number; w: number; h: number }, x: number, y: number) => x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// The pen tip as a small icon, like the macOS list.
export function ToolIcon({ tool, size = 16 }: { tool: Tool; size?: number }) {
  const d: Record<Tool, string> = {
    pen: 'M12 2 9 9v11h6V9Z M12 2v7',
    monoline: 'M12 3 10 8v3h4V8Z M9 11h6v9H9Z',
    marker: 'M10 2h4l1 7v11H9V9Z M10 2l-1 4',
    pencil: 'M12 2 9 9v11h6V9Z M10.5 14h3',
    crayon: 'M12 2 9 8v12h6V8Z',
    fountain: 'M12 2c3 3 4 6 3 9l-3 3-3-3c-1-3 0-6 3-9Z M12 9v5M10 20h4',
    reed: 'M9 3h6v6l-1 11h-4L9 9Z M12 3v6',
    watercolour: 'M12 3c2.5 4 4 6.5 4 9a4 4 0 0 1-8 0c0-2.5 1.5-5 4-9Z',
    eraser: 'M8 3h8v7H8Z M8 10h8v10H8Z',
  };
  const filled = tool === 'crayon' || tool === 'watercolour' || tool === 'eraser';
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
      <path d={d[tool]} />
    </svg>
  );
}

type Menu = null | 'tool' | 'color' | 'shape' | 'signature';

function Tick() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default function Markup({ onDone }: { onDone: (png: Blob | null) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [tool, setTool] = useState<Tool>('monoline');
  const [mode, setMode] = useState<'draw' | 'select' | 'text' | Shape>('draw');
  const [width, setWidth] = useState(1);
  const [color, setColor] = useState('#1d1d1f');
  const [menu, setMenu] = useState<Menu>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [lasso, setLasso] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [typing, setTyping] = useState<{ x: number; y: number; text: string } | null>(null);
  const live = useRef<Item | null>(null);
  const action = useRef<null | { kind: 'draw' } | { kind: 'lasso'; x: number; y: number } | { kind: 'move'; x: number; y: number; from: Item[] }>(null);

  const paint = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    for (const it of items) drawItem(ctx, it);
    if (live.current) drawItem(ctx, live.current);
  }, [items]);

  // The canvas fills the note body, sharp on any screen.
  useEffect(() => {
    const el = wrap.current;
    const c = canvas.current;
    if (!el || !c) return;
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      c.width = el.clientWidth * dpr;
      c.height = el.clientHeight * dpr;
      c.style.width = `${el.clientWidth}px`;
      c.style.height = `${el.clientHeight}px`;
      paint();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [paint]);

  useEffect(() => paint(), [paint]);

  const at = (e: React.PointerEvent): Pt => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
  };

  const down = (e: React.PointerEvent) => {
    if (menu) setMenu(null);
    const p = at(e);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    if (mode === 'text') {
      setTyping({ x: p.x, y: p.y, text: '' });
      return;
    }
    if (mode === 'select') {
      const inside = selected.some((i) => items[i] && hit(bounds(items[i]!), p.x, p.y));
      if (inside) action.current = { kind: 'move', x: p.x, y: p.y, from: items };
      else {
        setSelected([]);
        action.current = { kind: 'lasso', x: p.x, y: p.y };
        setLasso({ x: p.x, y: p.y, w: 0, h: 0 });
      }
      return;
    }
    if (tool === 'eraser' && mode === 'draw') {
      setItems((list) => list.filter((it) => !hit(bounds(it), p.x, p.y)));
      action.current = { kind: 'draw' };
      return;
    }
    live.current = mode === 'draw' ? { kind: 'path', tool, color, width: WIDTHS[width]!, pts: [p], seed: Math.floor(Math.random() * 1e9) } : { kind: 'shape', shape: mode, color, width: WIDTHS[width]!, a: p, b: p };
    action.current = { kind: 'draw' };
    paint();
  };

  const move = (e: React.PointerEvent) => {
    const a = action.current;
    if (!a) return;
    const p = at(e);
    if (a.kind === 'lasso') {
      setLasso({ x: Math.min(a.x, p.x), y: Math.min(a.y, p.y), w: Math.abs(p.x - a.x), h: Math.abs(p.y - a.y) });
      return;
    }
    if (a.kind === 'move') {
      setItems(a.from.map((it, i) => (selected.includes(i) ? moved(it, p.x - a.x, p.y - a.y) : it)));
      return;
    }
    if (tool === 'eraser' && mode === 'draw') {
      setItems((list) => list.filter((it) => !hit(bounds(it), p.x, p.y)));
      return;
    }
    const it = live.current;
    if (!it) return;
    if (it.kind === 'path') it.pts.push(p);
    else if (it.kind === 'shape') it.b = p;
    paint();
  };

  const up = () => {
    const a = action.current;
    action.current = null;
    if (a?.kind === 'lasso' && lasso) {
      setSelected(items.map((it, i) => (overlaps(bounds(it), lasso) ? i : -1)).filter((i) => i >= 0));
      setLasso(null);
    }
    if (live.current) {
      const it = live.current;
      live.current = null;
      setItems((list) => [...list, it]);
    }
  };

  const placeText = () => {
    if (typing?.text.trim()) setItems((list) => [...list, { kind: 'text', color, size: 14 + WIDTHS[width]! * 2, x: typing.x, y: typing.y, text: typing.text }]);
    setTyping(null);
  };

  // The finished drawing, cropped to what was drawn.
  const finish = () => {
    if (!items.length) return onDone(null);
    const boxes = items.map(bounds);
    const x0 = Math.max(0, Math.min(...boxes.map((b) => b.x)) - 8);
    const y0 = Math.max(0, Math.min(...boxes.map((b) => b.y)) - 8);
    const x1 = Math.max(...boxes.map((b) => b.x + b.w)) + 8;
    const y1 = Math.max(...boxes.map((b) => b.y + b.h)) + 8;
    const out = document.createElement('canvas');
    const scale = 2;
    out.width = Math.max(1, Math.round((x1 - x0) * scale));
    out.height = Math.max(1, Math.round((y1 - y0) * scale));
    const ctx = out.getContext('2d')!;
    ctx.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);
    for (const it of items) drawItem(ctx, it);
    out.toBlob((b) => onDone(b), 'image/png');
  };

  const sel = selected.length ? selected.map((i) => items[i]).filter(Boolean).map((it) => bounds(it!)) : [];
  const selBox = sel.length ? { x: Math.min(...sel.map((b) => b.x)), y: Math.min(...sel.map((b) => b.y)), w: Math.max(...sel.map((b) => b.x + b.w)) - Math.min(...sel.map((b) => b.x)), h: Math.max(...sel.map((b) => b.y + b.h)) - Math.min(...sel.map((b) => b.y)) } : null;

  return (
    <div className={styles.markup} ref={wrap}>
      <canvas ref={canvas} className={styles.markupCanvas} data-mode={mode === 'draw' ? tool : mode} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
      {lasso && <div className={styles.lasso} style={{ left: lasso.x, top: lasso.y, width: lasso.w, height: lasso.h }} />}
      {selBox && mode === 'select' && <div className={styles.selBox} style={{ left: selBox.x, top: selBox.y, width: selBox.w, height: selBox.h }} />}
      {typing && (
        <textarea
          className={styles.markupText}
          style={{ left: typing.x, top: typing.y, color, fontSize: 14 + WIDTHS[width]! * 2 }}
          value={typing.text}
          autoFocus
          onChange={(e) => setTyping({ ...typing, text: e.target.value })}
          onBlur={placeText}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setTyping(null);
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              placeText();
            }
          }}
          placeholder="Text"
        />
      )}

      <div className={styles.markBar} onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" className={styles.markBtn} data-on={mode === 'select'} onClick={() => setMode(mode === 'select' ? 'draw' : 'select')} aria-label="Select" title="Select and move">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeDasharray="3 2.4" aria-hidden="true">
            <rect x="4" y="4" width="16" height="16" rx="2.5" />
          </svg>
        </button>
        <span className={styles.markAnchor}>
          <button type="button" className={styles.penBtn} data-on={mode === 'draw'} onClick={() => (mode === 'draw' ? setMenu(menu === 'tool' ? null : 'tool') : setMode('draw'))} aria-label="Pen" title={TOOLS.find(([t]) => t === tool)![1]}>
            <ToolIcon tool={tool} size={20} />
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {menu === 'tool' && (
            <Floating className={styles.pop} width={300}>
              <div className={styles.widths}>
                {WIDTHS.map((w, i) => (
                  <button key={w} type="button" data-on={i === width} onClick={() => setWidth(i)} aria-label={`Width ${i + 1}`}>
                    <svg viewBox="0 0 30 24" width="34" height="26" aria-hidden="true">
                      <path d="M5 17c3-9 6-10 7-6s3 6 6-1 6-6 7 0" fill="none" stroke="currentColor" strokeWidth={1 + i * 1.2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                ))}
              </div>
              {TOOLS.map(([t, label]) => (
                <button
                  key={t}
                  type="button"
                  className={styles.popRow}
                  onClick={() => {
                    setTool(t);
                    setMode('draw');
                    setMenu(null);
                  }}
                >
                  <span className={styles.check}>{t === tool ? <Tick /> : null}</span>
                  <ToolIcon tool={t} />
                  {label}
                </button>
              ))}
            </Floating>
          )}
        </span>
        <span className={styles.markAnchor}>
          <button type="button" className={styles.colorBtn} onClick={() => setMenu(menu === 'color' ? null : 'color')} aria-label="Colour" title="Colour">
            <i style={{ background: color }} />
          </button>
          {menu === 'color' && (
            <Floating className={`${styles.pop} ${styles.colorPop}`} width={456}>
              <div className={styles.quick}>
                {QUICK.map((c) => (
                  <button key={c} type="button" style={{ background: c }} data-on={c === color} onClick={() => (setColor(c), setMenu(null))} aria-label={`Colour ${c}`} />
                ))}
              </div>
              <div className={styles.grid}>
                {GRID.flat().map((c, i) => (
                  <button key={`${c}-${i}`} type="button" style={{ background: c }} data-on={c === color} onClick={() => (setColor(c), setMenu(null))} aria-label={`Colour ${c}`} />
                ))}
              </div>
              <label className={styles.showColours}>
                Show Colours…
                <input type="color" value={/^#[0-9a-f]{6}$/i.test(color) ? color : '#000000'} onChange={(e) => setColor(e.target.value)} />
              </label>
            </Floating>
          )}
        </span>
        <i className={styles.markSep} />
        <span className={styles.markAnchor}>
          <button type="button" className={styles.markBtn} data-on={SHAPES.some(([sh]) => sh === mode)} onClick={() => setMenu(menu === 'shape' ? null : 'shape')} aria-label="Shapes" title="Shapes">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <rect x="3.5" y="3.5" width="11" height="11" rx="2.5" />
              <rect x="9.5" y="9.5" width="11" height="11" rx="2.5" />
            </svg>
          </button>
          {menu === 'shape' && (
            <Floating className={`${styles.pop} ${styles.shapePop}`} width={132}>
              {SHAPES.map(([sh, label, d]) => (
                <button key={sh} type="button" data-on={mode === sh} onClick={() => (setMode(sh), setMenu(null))} aria-label={label} title={label}>
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
                    <path d={d} />
                  </svg>
                </button>
              ))}
            </Floating>
          )}
        </span>
        <button type="button" className={styles.markBtn} data-on={mode === 'text'} onClick={() => setMode(mode === 'text' ? 'draw' : 'text')} aria-label="Text" title="Text">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" strokeDasharray="3 2.4" />
            <path d="M9 15l3-7 3 7M10 13h4" />
          </svg>
        </button>
        <span className={styles.markAnchor}>
          <button type="button" className={styles.markBtn} onClick={() => setMenu(menu === 'signature' ? null : 'signature')} aria-label="Signature" title="Signature">
            <svg viewBox="0 0 30 24" width="28" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 18l3-3M3 15l3 3M8 18h19M10 14c2-6 4-9 5-8s-2 8 0 8 3-5 4-5 0 4 2 4 3-3 5-3" />
            </svg>
          </button>
          {menu === 'signature' && <Signature color={color} onCancel={() => setMenu(null)} onUse={(pts) => (setItems((list) => [...list, ...pts]), setMenu(null), setMode('select'))} />}
        </span>
        <i className={styles.markSep} />
        <button type="button" className={styles.markDone} onClick={finish}>
          Done
        </button>
      </div>
    </div>
  );
}

// The signature sheet, after macOS: sign on the pad with a trackpad, mouse
// or finger, then it lands on the drawing to move where it goes.
function Signature({ color, onUse, onCancel }: { color: string; onUse: (items: Item[]) => void; onCancel: () => void }) {
  const c = useRef<HTMLCanvasElement>(null);
  const [paths, setPaths] = useState<Pt[][]>([]);
  const [begun, setBegun] = useState(false);
  const [label, setLabel] = useState('None');
  const cur = useRef<Pt[] | null>(null);
  const W = 520;
  const H = 220;
  const redraw = (list: Pt[][]) => {
    const ctx = c.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = '#1d1d1f';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const p of list) {
      ctx.beginPath();
      p.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.stroke();
    }
  };
  const pt = (e: React.PointerEvent): Pt => {
    const r = c.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H, t: performance.now() };
  };
  // Scaled to a signature's size and placed near the top left of the note.
  const use = () => {
    const all = paths.flat();
    const minX = Math.min(...all.map((p) => p.x));
    const minY = Math.min(...all.map((p) => p.y));
    const scale = 0.45;
    onUse(paths.map((p) => ({ kind: 'path', tool: 'monoline', color, width: 2, pts: p.map((q) => ({ ...q, x: 40 + (q.x - minX) * scale, y: 60 + (q.y - minY) * scale })), seed: 1 })));
  };
  return (
    <Floating className={styles.sigSheet} width={560}>
      <div className={styles.sigTabs}>
        <button type="button" data-on="true">
          Trackpad
        </button>
        <button type="button" disabled title="Available on a Mac with a camera">
          Camera
        </button>
      </div>
      <div className={styles.sigArea}>
        <canvas
          ref={c}
          width={W}
          height={H}
          className={styles.sigPad}
          data-live={begun || undefined}
          onPointerDown={(e) => {
            if (!begun) return;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            cur.current = [pt(e)];
          }}
          onPointerMove={(e) => {
            if (!cur.current) return;
            cur.current.push(pt(e));
            redraw([...paths, cur.current]);
          }}
          onPointerUp={() => {
            if (cur.current) setPaths((p) => [...p, cur.current!]);
            cur.current = null;
          }}
        />
        {!begun && (
          <button type="button" className={styles.sigBegin} onClick={() => setBegun(true)}>
            Click Here to Begin
          </button>
        )}
      </div>
      <p className={styles.sigHint}>{begun ? 'Sign your name with your trackpad, mouse or finger.' : 'Sign your name on the trackpad.'}</p>
      <label className={styles.sigDesc}>
        Description:
        <select value={label} onChange={(e) => setLabel(e.target.value)} disabled={!paths.length}>
          <option>None</option>
          <option>Signature</option>
          <option>Initials</option>
        </select>
      </label>
      <div className={styles.sigActions}>
        <button type="button" disabled={!paths.length} onClick={() => (setPaths([]), redraw([]))}>
          Clear
        </button>
        <span>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={styles.sigUse} disabled={!paths.length} onClick={use}>
            Done
          </button>
        </span>
      </div>
    </Floating>
  );
}
