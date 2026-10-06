import { requestLinkAction } from '../../../../lib/auth/actions';
import { LOGIN_LINK_MINUTES } from '../../../../lib/auth/constants';
import { redirectOf } from '../../../../lib/mobile/redirect';

const ERRORS: Record<string, string> = {
  missing: 'Enter your email address.',
  email: 'We could not send the email. Try again in a moment.',
};

// "Email me a sign-in link": the same action as the login page. It always
// answers "sent" so the form does not reveal who has an account.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const form = new FormData();
  form.set('email', String(body.email ?? ''));
  try {
    await requestLinkAction(form);
  } catch (error) {
    const redirected = redirectOf(error);
    if (!redirected) throw error;
    // The action redirects back to /login with ?error=<code> or ?sent=1.
    if (redirected.error) return Response.json({ error: ERRORS[redirected.error] ?? ERRORS['email'] }, { status: 400 });
  }
  return Response.json({ sent: true, minutes: LOGIN_LINK_MINUTES });
}
