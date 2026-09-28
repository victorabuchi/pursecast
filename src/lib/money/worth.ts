// Worth-It: one tap after a purchase builds a joy per euro map.

export type Mood = 'love' | 'meh' | 'regret';
export const MOODS: Array<[Mood, string, string]> = [
  ['love', '😍', 'Loved it'],
  ['meh', '😐', 'It was fine'],
  ['regret', '😩', 'Regret it'],
];
export const FACE: Record<Mood, string> = { love: '😍', meh: '😐', regret: '😩' };
const SCORE: Record<Mood, number> = { love: 10, meh: 5, regret: 0 };

export function isMood(v: unknown): v is Mood {
  return v === 'love' || v === 'meh' || v === 'regret';
}

// Purchases become ready to rate this many days after they happen.
export const RATE_AFTER_DAYS = 2;

export type Rated = { categoryId: string | null; categoryName: string; amount: number; mood: Mood; date: string };
export type Joy = { categoryId: string | null; name: string; score: number; count: number; regrets: number; spent: number; recent: Mood[] };

// Spend weighted average of ratings per category, 0 (all regret) to 10.
export function joyByCategory(rated: Rated[]): Joy[] {
  const map = new Map<string, Joy & { weighted: number }>();
  for (const r of [...rated].sort((a, b) => (a.date < b.date ? 1 : -1))) {
    const key = r.categoryId ?? 'none';
    const cost = Math.abs(r.amount);
    const j = map.get(key) ?? { categoryId: r.categoryId, name: r.categoryName, score: 0, count: 0, regrets: 0, spent: 0, weighted: 0, recent: [] };
    j.count += 1;
    j.spent += cost;
    j.weighted += cost * SCORE[r.mood];
    if (r.mood === 'regret') j.regrets += 1;
    if (j.recent.length < 10) j.recent.push(r.mood);
    map.set(key, j);
  }
  return [...map.values()]
    .map(({ weighted, ...j }) => ({ ...j, score: j.spent ? weighted / j.spent : 0 }))
    .sort((a, b) => b.score - a.score);
}

export type Advice = {
  from: { id: string; name: string; budget: number };
  to: { id: string; name: string; budget: number };
  amount: number;
  regrets: number;
  of: number;
};

// Suggest moving part of a regretted budget to a loved one. Categories moved
// from in the last 30 days are left alone.
export function adviceFor(joy: Joy[], budgets: Array<{ id: string; name: string; budget: number }>, recentlyMovedFrom: Set<string>): Advice | null {
  const budget = new Map(budgets.map((b) => [b.id, b]));
  const regretted = joy
    .filter((j) => j.categoryId && budget.get(j.categoryId)?.budget && !recentlyMovedFrom.has(j.categoryId))
    .map((j) => ({ j, regrets: j.recent.filter((m) => m === 'regret').length, of: j.recent.length }))
    .filter((x) => x.of >= 3 && x.regrets / x.of >= 0.5)
    .sort((a, b) => b.regrets / b.of - a.regrets / a.of || b.j.spent - a.j.spent)[0];
  if (!regretted) return null;
  const loved = joy.find((j) => j.categoryId && j.categoryId !== regretted.j.categoryId && budget.has(j.categoryId) && j.count >= 2 && j.score >= 7);
  if (!loved) return null;
  const from = budget.get(regretted.j.categoryId!)!;
  const to = budget.get(loved.categoryId!)!;
  const amount = Math.min(from.budget, Math.max(1000, Math.floor(from.budget / 3 / 1000) * 1000));
  return { from, to, amount, regrets: regretted.regrets, of: regretted.of };
}
