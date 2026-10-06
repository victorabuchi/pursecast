import { db } from '../../../../prisma/db';
import { meFrom, moneyFor } from '../../../../lib/money/load';
import { remindersFor } from '../../../../lib/money/reminders-load';
import { weeklyDigest } from '../../../../lib/money/reminders';
import { addDays } from '../../../../lib/money/dates';
import { pushTo } from '../../../../lib/push';
import { emailConfigured, sendEmail } from '../../../../lib/email';
import { bankReady } from '../../../../lib/bank/enable';
import { syncLink } from '../../../../lib/bank/sync';

export const maxDuration = 300;

// Called every hour (Render cron, or any scheduler) with
// Authorization: Bearer CRON_SECRET. From 8:00 in each person's time zone it
// pushes reminders not sent yet, and on Monday the weekly email.
const SEND_FROM_HOUR = 8;

function localHour(timeZone: string): number {
  return Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(new Date()));
}

export async function GET(request: Request) {
  const secret = process.env['CRON_SECRET'];
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Not allowed', { status: 401 });
  const appUrl = (process.env['APP_URL'] || new URL(request.url).origin).replace(/\/$/, '');

  const [users, subs] = await Promise.all([db.orm.public.User.where((u) => u.balance.isNotNull()).all(), db.orm.public.PushSub.select('userId').all()]);
  const withPush = new Set(subs.map((s) => s.userId));
  const email = emailConfigured();
  let pushed = 0;
  let emailed = 0;

  // Banks: new balances and transactions every 6 hours or so (banks allow
  // about four reads a day without the person present).
  let banksSynced = 0;
  if (bankReady()) {
    const since = new Date(Date.now() - 6 * 3_600_000).toISOString();
    const due = (await db.orm.public.BankLink.where({ status: 'active' }).all()).filter((l) => !l.lastSyncAt || l.lastSyncAt < since);
    for (const l of due) {
      const res = await syncLink(l.userId, l.id).catch((e) => ({ added: 0, error: String(e) }));
      if (!res.error) banksSynced++;
    }
  }

  for (const u of users) {
    const wantsPush = withPush.has(u.id);
    const me = meFrom(u);
    const monday = new Date(`${me.today}T00:00:00Z`).getUTCDay() === 1;
    const wantsEmail = email && u.weeklyEmail && monday && u.weeklyAt !== me.today;
    if ((!wantsPush && !wantsEmail) || localHour(u.timezone) < SEND_FROM_HOUR) continue;
    try {
      const money = await moneyFor(me as typeof me & { balance: number; balanceSetAt: string }, 91);
      const low = money.forecast.low;
      if (wantsPush) {
        const reminders = await remindersFor(me, low);
        const sent = new Set((await db.orm.public.ReminderSent.where({ userId: u.id }).where((r) => r.createdAt.gte(new Date(Date.now() - 45 * 86_400_000).toISOString())).all()).map((r) => r.key));
        const fresh = reminders.filter((r) => !sent.has(r.key));
        // Up to three one by one; more than that as one summary.
        const messages = fresh.length > 3 ? [{ title: `${fresh.length} things from Pursecast`, body: fresh.map((r) => r.title).join(' · '), url: '/forecast', tag: `digest:${me.today}` }] : fresh.map((r) => ({ title: r.title, body: r.body, url: r.href, tag: r.key }));
        for (const msg of messages) pushed += (await pushTo(u.id, msg)) ? 1 : 0;
        if (fresh.length) await db.orm.public.ReminderSent.createAll(fresh.map((r) => ({ userId: u.id, key: r.key })));
      }
      if (wantsEmail) {
        const until = addDays(me.today, 7);
        const week = money.forecast.days.filter((d) => d.date >= me.today && d.date < until).flatMap((d) => d.flows.filter((f) => f.kind === 'bill' || f.kind === 'income').map((f) => ({ date: d.date, name: f.name, amount: f.amount })));
        const todos = (await db.orm.public.Todo.where({ userId: u.id }).where((t) => t.doneAt.isNull()).all()).map((t) => t.text);
        const digest = weeklyDigest({ name: u.name, currency: u.currency, today: me.today, balance: money.balance, week, todos, low, cushion: u.cushion, appUrl });
        if (await sendEmail({ to: u.email, subject: digest.subject, text: digest.text })) {
          emailed++;
          await db.orm.public.User.where({ id: u.id }).update({ weeklyAt: me.today });
        }
      }
    } catch (e) {
      console.error('Reminders failed for a user', e);
    }
  }
  // Keys older than 45 days can go.
  await db.orm.public.ReminderSent.where((r) => r.createdAt.lt(new Date(Date.now() - 45 * 86_400_000).toISOString())).deleteAll();
  return Response.json({ users: users.length, pushed, emailed, banksSynced });
}
