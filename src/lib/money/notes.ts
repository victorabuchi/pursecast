// Future-self notes: a note plays back before a purchase in a category the
// person tends to regret, or one this purchase would take over budget. A note
// tied to that category wins over a general one.

export type NoteLike = { id: string; categoryId: string | null; until: string | null };
export type Pause = { reason: 'regret'; regrets: number; of: number } | { reason: 'budget'; over: number };

export function pauseFor(
  purchase: { categoryId: string | null; amount: number },
  ctx: { recentMoods: string[]; budgetLeft: number | null },
): Pause | null {
  if (purchase.amount >= 0 || !purchase.categoryId) return null;
  const regrets = ctx.recentMoods.filter((m) => m === 'regret').length;
  if (ctx.recentMoods.length >= 2 && regrets / ctx.recentMoods.length >= 0.5) return { reason: 'regret', regrets, of: ctx.recentMoods.length };
  if (ctx.budgetLeft !== null && -purchase.amount > ctx.budgetLeft) return { reason: 'budget', over: -purchase.amount - Math.max(0, ctx.budgetLeft) };
  return null;
}

export function noteFor<N extends NoteLike>(notes: N[], categoryId: string | null, today: string): N | null {
  const live = notes.filter((n) => !n.until || n.until >= today);
  return live.find((n) => n.categoryId === categoryId) ?? live.find((n) => !n.categoryId) ?? null;
}

// Voice notes are stored as data: URLs; about a minute of compressed audio.
export const MAX_AUDIO_CHARS = 1_500_000;
export function validAudio(v: string): boolean {
  return v.length <= MAX_AUDIO_CHARS && /^data:audio\/[a-z0-9.+-]+(;[a-z0-9=.+-]+)*;base64,[A-Za-z0-9+/=]+$/i.test(v);
}
