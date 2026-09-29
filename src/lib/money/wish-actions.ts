'use server';

import { db } from '../../prisma/db';
import { cents, day, done, str } from './act';
import { addMonths, monthOf, short } from './dates';
import { exact, money } from './format';
import { saveSuggestion } from './forecast';
import { getMe } from './load';
import { photoChange } from './wish-icons';

const BACK = '/plan#want';

function cleanUrl(input: string): string | null {
  try {
    const u = new URL(input.trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export async function addWishAction(formData: FormData) {
  const me = await getMe();
  const name = str(formData, 'name', 80);
  const price = cents(formData, 'price');
  if (!name || !price) done('/plan?wish=1', 'Add what it is and what it costs.', 'error');
  const priority = Math.min(3, Math.max(1, Number(str(formData, 'priority', 1)) || 2));
  await db.orm.public.WishItem.create({ userId: me.id, name, price, priority, url: cleanUrl(str(formData, 'url', 500)), ...photoChange(formData) });
  done(BACK, `${name} added to your wish list`);
}

export async function updateWishAction(formData: FormData) {
  const me = await getMe();
  const item = await db.orm.public.WishItem.where({ id: str(formData, 'id', 40), userId: me.id }).first();
  const name = str(formData, 'name', 80);
  const price = cents(formData, 'price');
  if (!item) done(BACK, 'That item is gone.', 'error');
  if (!name || !price) done(BACK, 'Add what it is and what it costs.', 'error');
  const priority = Math.min(3, Math.max(1, Number(str(formData, 'priority', 1)) || 2));
  await db.orm.public.WishItem.where({ id: item.id, userId: me.id }).update({ name, price, priority, url: cleanUrl(str(formData, 'url', 500)), ...photoChange(formData) });
  // Saving for it follows the new name and price.
  if (item.eventId && (name !== item.name || price !== item.price)) {
    await Promise.all([
      db.orm.public.PlanEvent.where({ id: item.eventId, userId: me.id }).update({ name }),
      db.orm.public.PlanItem.where({ eventId: item.eventId, userId: me.id }).updateAll({ name, amount: price }),
    ]);
  }
  done(BACK, `${name} updated`);
}

export async function deleteWishAction(formData: FormData) {
  const me = await getMe();
  const row = await db.orm.public.WishItem.where({ id: str(formData, 'id', 40), userId: me.id }).delete();
  if (row?.eventId) await db.orm.public.PlanEvent.where({ id: row.eventId, userId: me.id }).delete();
  done(BACK, `${row?.name ?? 'Item'} removed`);
}

// Logs the purchase in Spending, and ends any saving for it.
export async function boughtWishAction(formData: FormData) {
  const me = await getMe();
  const item = await db.orm.public.WishItem.where({ id: str(formData, 'id', 40), userId: me.id }).first();
  if (!item) done(BACK, 'That item is gone.', 'error');
  const paid = cents(formData, 'price') ?? item.price;
  const shopping = await db.orm.public.Category.where({ userId: me.id, name: 'Shopping' }).first();
  await Promise.all([
    db.orm.public.Entry.create({ userId: me.id, date: me.today, amount: -paid, note: item.name, categoryId: shopping?.id ?? null }),
    db.orm.public.WishItem.where({ id: item.id, userId: me.id }).update({ boughtAt: new Date().toISOString(), eventId: null }),
    item.eventId ? db.orm.public.PlanEvent.where({ id: item.eventId, userId: me.id }).delete() : Promise.resolve(null),
  ]);
  done(BACK, `Enjoy it · ${item.name} ${exact(paid, me.currency)} logged`);
}

// Puts money aside each month until the chosen day, through Plan ahead.
export async function saveForWishAction(formData: FormData) {
  const me = await getMe();
  const item = await db.orm.public.WishItem.where({ id: str(formData, 'id', 40), userId: me.id }).first();
  if (!item) done(BACK, 'That item is gone.', 'error');
  let date = day(formData, 'by') ?? addMonths(me.today, 3);
  if (date <= me.today) date = addMonths(me.today, 1);
  const { monthly } = saveSuggestion(item.price, me.today, date);
  if (item.eventId) await db.orm.public.PlanEvent.where({ id: item.eventId, userId: me.id }).delete();
  const ev = await db.orm.public.PlanEvent.create({ userId: me.id, date, name: item.name, tag: 'Shopping', source: 'wish', saveMonthly: monthly, saveFrom: monthOf(me.today) });
  await Promise.all([db.orm.public.PlanItem.create({ eventId: ev.id, userId: me.id, name: item.name, amount: item.price }), db.orm.public.WishItem.where({ id: item.id, userId: me.id }).update({ eventId: ev.id })]);
  done(BACK, `${money(monthly, me.currency)} a month set aside · ${item.name} by ${short(date)}`);
}
