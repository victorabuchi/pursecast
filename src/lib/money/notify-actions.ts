'use server';

import { refresh } from 'next/cache';
import { db } from '../../prisma/db';
import { getMe } from './load';
import { pushTo } from '../push';

// Saves this device for notifications (a browser push subscription).
export async function savePushAction(sub: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<{ ok: boolean }> {
  const me = await getMe();
  const endpoint = String(sub?.endpoint ?? '').slice(0, 1000);
  if (!endpoint.startsWith('https://') || !sub.keys?.p256dh || !sub.keys?.auth) return { ok: false };
  await db.orm.public.PushSub.where({ userId: me.id, endpoint }).deleteAll();
  await db.orm.public.PushSub.create({ userId: me.id, endpoint, p256dh: String(sub.keys.p256dh).slice(0, 200), auth: String(sub.keys.auth).slice(0, 100) });
  refresh();
  return { ok: true };
}

export async function removePushAction(endpoint: string): Promise<void> {
  const me = await getMe();
  await db.orm.public.PushSub.where({ userId: me.id, endpoint: String(endpoint).slice(0, 1000) }).deleteAll();
  refresh();
}

export async function testPushAction(): Promise<{ sent: number }> {
  const me = await getMe();
  const sent = await pushTo(me.id, { title: 'Pursecast is set', body: 'Reminders will show up here, like this one.', url: '/settings', tag: 'test' });
  return { sent };
}

export async function setWeeklyEmailAction(on: boolean): Promise<void> {
  const me = await getMe();
  await db.orm.public.User.where({ id: me.id }).update({ weeklyEmail: Boolean(on) });
  refresh();
}
