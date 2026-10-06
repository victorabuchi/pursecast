import { db } from '../../../../prisma/db';
import { getMe } from '../../../../lib/money/load';
import { aiReady } from '../../../../lib/statements/read';
import { redirectOf, redirectResponse } from '../../../../lib/mobile/redirect';

// What the Statements screen is drawn from: the same loads as the web page.
// ?s=<statement id> narrows it to one statement.
export async function GET(request: Request) {
  try {
    const me = await getMe();
    const statements = await db.orm.public.Statement.where({ userId: me.id }).orderBy((s) => s.createdAt.desc()).all();
    const selected = statements.find((s) => s.id === new URL(request.url).searchParams.get('s'));
    const rows = await db.orm.public.StatementTxn.where(selected ? { userId: me.id, statementId: selected.id } : { userId: me.id })
      .orderBy([(t) => t.date.desc(), (t) => t.id.asc()])
      .all();
    // Charges already set up as bills or subscriptions.
    const tracked = (await db.orm.public.Recurring.where({ userId: me.id }).select('name').all()).map((r) => r.name);
    return Response.json({
      me: { currency: me.currency, today: me.today },
      aiReady: aiReady(),
      statements: statements.map((s) => ({ id: s.id, name: s.name })),
      selected: selected?.id ?? null,
      txns: rows.map((t) => ({ id: t.id, date: t.date, description: t.description, place: t.place, amount: t.amount, category: t.category })),
      tracked,
    });
  } catch (error) {
    const redirected = redirectOf(error);
    if (redirected) return redirectResponse(redirected);
    throw error;
  }
}
