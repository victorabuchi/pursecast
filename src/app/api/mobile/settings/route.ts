import { db } from '../../../../prisma/db';
import { emailConfigured } from '../../../../lib/email';
import { getMe } from '../../../../lib/money/load';
import { redirectOf, redirectResponse } from '../../../../lib/mobile/redirect';

// What the Settings screen shows: the profile, whether there is a password,
// and the Monday email choice. (Settings works before first-time setup.)
export async function GET() {
  try {
    const me = await getMe();
    const [hasPassword, user] = await Promise.all([
      db.orm.public.AuthIdentity.where({ userId: me.id, provider: 'password' }).first().then(Boolean),
      db.orm.public.User.where({ id: me.id }).select('weeklyEmail').first(),
    ]);
    return Response.json({ me, hasPassword, weeklyEmail: Boolean(user?.weeklyEmail), emailReady: emailConfigured() });
  } catch (error) {
    const redirected = redirectOf(error);
    if (redirected) return redirectResponse(redirected);
    throw error;
  }
}
