import { db } from '../../../../../prisma/db';
import { loadMoney, type Money } from '../../../../../lib/money/load';
import { redirectOf, redirectResponse } from '../../../../../lib/mobile/redirect';
import { isoAgo } from '../../../../../lib/money/dates';
import { photoUrl } from '../../../../../lib/photo-url';

// What each app screen is drawn from: the shared money load plus the extra
// queries that page makes on the web. ?days= sets how far the forecast runs.

type Loader = (money: Money, url: URL) => Promise<Record<string, unknown>>;

const PAGES: Record<string, { days?: number; load: Loader }> = {
  // Plan ahead looks a year ahead, so Want to buy can find the first day each
  // thing fits. Also the wish list, the payday to-dos and the national rate.
  plan: {
    days: 366,
    load: async ({ me }) => {
      const wishes = await db.orm.public.WishItem.where({ userId: me.id }).orderBy([(w) => w.priority.asc(), (w) => w.createdAt.asc()]).all();
      const todos = await db.orm.public.Todo.where({ userId: me.id }).orderBy((t) => t.createdAt.asc()).all();
      return {
        national: Number(process.env['NATIONAL_INFLATION'] ?? ''),
        wishes: wishes.map((w) => ({ id: w.id, name: w.name, price: w.price, url: w.url, photo: photoUrl('wish', w.id, w.photo), priority: w.priority, eventId: w.eventId, boughtAt: w.boughtAt })),
        todos: todos.map((t) => ({ id: t.id, text: t.text, amount: t.amount, incomeId: t.incomeId, due: t.due, priority: t.priority, doneAt: t.doneAt })),
      };
    },
  },
  // Timeline forks and what each one changes. The chart looks 290 days ahead.
  forks: {
    days: 290,
    load: async ({ me }) => {
      const forks = await db.orm.public.Fork.where({ userId: me.id }).orderBy((f) => f.createdAt.asc()).all();
      const effects = forks.length ? await db.orm.public.ForkEffect.where({ userId: me.id }).all() : [];
      return {
        forks: forks.map((f) => ({ id: f.id, name: f.name, startDate: f.startDate, oneTime: f.oneTime })),
        effects: effects.map((e) => ({ id: e.id, forkId: e.forkId, name: e.name, monthly: e.monthly })),
      };
    },
  },
  // Budgets moved for value in the last 30 days (so the advice is not repeated)
  // and the future-self notes.
  'worth-it': {
    load: async ({ me }) => {
      const moved = await db.orm.public.BudgetMove.where({ userId: me.id, reason: 'value' })
        .where((m) => m.createdAt.gte(isoAgo(30)))
        .all();
      const notes = await db.orm.public.FutureNote.where({ userId: me.id }).orderBy((n) => n.createdAt.desc()).all();
      return {
        movedFrom: moved.map((m) => m.fromCategoryId),
        notes: notes.map((n) => ({ id: n.id, text: n.text, audio: n.audio, categoryId: n.categoryId, until: n.until, shown: n.shown, skipped: n.skipped, saved: n.saved, createdAt: n.createdAt })),
      };
    },
  },
  // The note played before a purchase future you may regret (?pause=<note id>).
  spending: {
    load: async ({ me }, url) => {
      const id = url.searchParams.get('pause');
      const note = id ? await db.orm.public.FutureNote.where({ id, userId: me.id }).first() : null;
      return { pauseNote: note ? { id: note.id, text: note.text, audio: note.audio, createdAt: note.createdAt, skipped: note.skipped, saved: note.saved } : null };
    },
  },
  // Things waiting for a payday, shown on that pay in Coming up.
  forecast: {
    load: async ({ me }) => ({
      todos: await db.orm.public.Todo.where({ userId: me.id }).where((t) => t.doneAt.isNull()).where((t) => t.incomeId.isNotNull()).select('incomeId', 'due').all(),
    }),
  },
};

export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const page = PAGES[name];
  if (!page) return Response.json({ error: 'Unknown page.' }, { status: 404 });
  const url = new URL(request.url);
  const days = Math.min(400, Math.max(7, Number(url.searchParams.get('days')) || page.days || 91));
  try {
    const money = await loadMoney(days);
    return Response.json({ money, ...(await page.load(money, url)) });
  } catch (error) {
    const redirected = redirectOf(error);
    if (redirected) return redirectResponse(redirected);
    throw error;
  }
}
