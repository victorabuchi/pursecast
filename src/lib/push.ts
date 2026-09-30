import 'server-only';
import webpush from 'web-push';
import { db } from '../prisma/db';

// Web push with the VAPID keys in the environment. Without them, nothing is
// sent and the settings page says notifications are not set up.
export const pushReady = () => Boolean(process.env['VAPID_PUBLIC_KEY'] && process.env['VAPID_PRIVATE_KEY']);
export const pushPublicKey = () => process.env['VAPID_PUBLIC_KEY'] ?? '';

let configured = false;
function setup() {
  if (configured || !pushReady()) return;
  webpush.setVapidDetails(process.env['VAPID_SUBJECT'] || 'mailto:hello@pursecast.com', process.env['VAPID_PUBLIC_KEY']!, process.env['VAPID_PRIVATE_KEY']!);
  configured = true;
}

// Sends to every device the person turned notifications on for. Devices that
// are gone (unsubscribed, app removed) are forgotten. Returns how many got it.
export async function pushTo(userId: string, message: { title: string; body: string; url: string; tag?: string }): Promise<number> {
  if (!pushReady()) return 0;
  setup();
  const subs = await db.orm.public.PushSub.where({ userId }).all();
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(message), { TTL: 60 * 60 * 12 });
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await db.orm.public.PushSub.where({ id: s.id, userId }).delete();
        else console.error('Push failed', status, (e as Error).message);
      }
    }),
  );
  return sent;
}
