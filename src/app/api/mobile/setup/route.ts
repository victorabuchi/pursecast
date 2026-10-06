import { getAccounts, getAdvances, getBalance, getCategories, getDebts, getMe, getRecurring } from '../../../../lib/money/load';
import { getRates } from '../../../../lib/money/fx';
import { redirectOf, redirectResponse } from '../../../../lib/mobile/redirect';

// What the Setup screen is filled from: the same loads as the web's setup
// page. Before first-time setup there is nothing to fill in yet.
export async function GET() {
  try {
    const me = await getMe();
    const editing = me.balance !== null;
    const [[cats, recurring, debts, balance, advances, accounts], rates] = await Promise.all([
      editing ? Promise.all([getCategories(me.id), getRecurring(me.id), getDebts(me.id), getBalance(me), getAdvances(me.id), getAccounts(me.id)]) : Promise.resolve([[], [], [], 0, [], []] as const),
      getRates(),
    ]);
    return Response.json({ me, editing, cats, recurring, debts, balance, advances, accounts, rates });
  } catch (error) {
    const redirected = redirectOf(error);
    if (redirected) return redirectResponse(redirected);
    throw error;
  }
}
