import { db } from '../../../prisma/db';
import { getViewer } from '../../../lib/auth/viewer';

// Everything Pursecast stores about the signed-in person, as one JSON file.
export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return new Response('Sign in first', { status: 401 });
  const userId = viewer.id;
  const [user, categories, entries, recurring, budgetMoves, forks, forkEffects, planEvents, planItems, debts, notes, wishes, advances, todos] = await Promise.all([
    db.orm.public.User.where({ id: userId }).first(),
    db.orm.public.Category.where({ userId }).all(),
    db.orm.public.Entry.where({ userId }).orderBy((e) => e.date.asc()).all(),
    db.orm.public.Recurring.where({ userId }).all(),
    db.orm.public.BudgetMove.where({ userId }).all(),
    db.orm.public.Fork.where({ userId }).all(),
    db.orm.public.ForkEffect.where({ userId }).all(),
    db.orm.public.PlanEvent.where({ userId }).all(),
    db.orm.public.PlanItem.where({ userId }).all(),
    db.orm.public.Debt.where({ userId }).all(),
    db.orm.public.FutureNote.where({ userId }).all(),
    db.orm.public.WishItem.where({ userId }).all(),
    db.orm.public.SalaryAdvance.where({ userId }).all(),
    db.orm.public.Todo.where({ userId }).all(),
  ]);
  const { calendarUrl, ...profile } = user!;
  const body = {
    exportedAt: new Date().toISOString(),
    note: 'Amounts are in cents. Negative means money going out.',
    profile: { ...profile, calendarConnected: Boolean(calendarUrl) },
    categories,
    entries,
    recurring,
    budgetMoves,
    forks: forks.map((f) => ({ ...f, effects: forkEffects.filter((e) => e.forkId === f.id) })),
    planEvents: planEvents.map((e) => ({ ...e, items: planItems.filter((i) => i.eventId === e.id) })),
    debts,
    futureNotes: notes,
    wishList: wishes,
    salaryAdvances: advances,
    whenMoneyLands: todos,
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="pursecast-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
