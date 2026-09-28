// Money owed between the person and others. Paybacks are entries linked to
// the debt going the other way: money coming back for 'lent', going out for
// 'borrowed'.

export type Direction = 'lent' | 'borrowed';
export const isDirection = (v: unknown): v is Direction => v === 'lent' || v === 'borrowed';

export type DebtLike = { id: string; direction: string; amount: number; settledAt: string | null };

export function paidBack(debt: DebtLike, entries: Array<{ debtId: string | null; amount: number }>): number {
  return entries
    .filter((e) => e.debtId === debt.id)
    .reduce((s, e) => s + (debt.direction === 'lent' ? Math.max(0, e.amount) : Math.max(0, -e.amount)), 0);
}

export function remaining(debt: DebtLike, paid: number): number {
  return debt.settledAt ? 0 : Math.max(0, debt.amount - paid);
}
