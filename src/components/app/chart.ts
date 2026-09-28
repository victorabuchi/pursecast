// Line charts are drawn in a 600 x 200 box stretched to fit; dots and labels
// are HTML placed by percentage so they stay round and sharp.
export const VB = { w: 600, h: 200 };
export type Pt = [number, number];

export function smooth(p: Pt[]): string {
  if (p.length < 2) return p.length ? `M${p[0]![0]},${p[0]![1]}` : '';
  let d = `M${p[0]![0]},${p[0]![1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i - 1] ?? p[i]!;
    const b = p[i]!;
    const c = p[i + 1]!;
    const e = p[i + 2] ?? c;
    d += ` C${b[0] + (c[0] - a[0]) / 6},${b[1] + (c[1] - a[1]) / 6} ${c[0] - (e[0] - b[0]) / 6},${c[1] - (e[1] - b[1]) / 6} ${c[0]},${c[1]}`;
  }
  return d;
}

export const pct = (p: Pt) => ({ left: `${(p[0] / VB.w) * 100}%`, top: `${(p[1] / VB.h) * 100}%` });
