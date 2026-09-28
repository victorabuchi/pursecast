import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import AuthShell from '../../components/auth/AuthShell';
import PasswordField from '../../components/auth/PasswordField';
import styles from '../../components/auth/auth.module.css';
import { getViewer } from '../../lib/auth/viewer';
import { passwordSignInAction, requestLinkAction } from '../../lib/auth/actions';
import { HOME, LOGIN_LINK_MINUTES } from '../../lib/auth/constants';

export const metadata: Metadata = { title: 'Log in' };

const ERRORS: Record<string, string> = {
  missing: 'Enter your email address, and your password to sign in with one.',
  invalid: 'That email and password do not match.',
  throttled: 'Too many attempts. Wait a few minutes, or sign in with an email link.',
  link: 'That sign-in link has expired or was already used. Ask for a new one.',
  email: 'We could not send the email. Try again in a moment.',
};

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  if (await getViewer()) redirect(HOME);
  const params = await searchParams;
  const one = (k: string) => (typeof params[k] === 'string' ? params[k] : '');
  const error = ERRORS[one('error')];
  const devLink = process.env.NODE_ENV !== 'production' ? one('dev') : '';

  return (
    <AuthShell
      title="Welcome back"
      lede="Your forecast is waiting."
      below={
        <>
          New to Pursecast? <Link href="/signup">Create an account</Link>
        </>
      }
    >
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {one('sent') && (
        <p className={styles.success} role="status">
          If that email has a Pursecast account, a sign-in link is on its way. It works for {LOGIN_LINK_MINUTES} minutes.
        </p>
      )}
      {devLink && (
        <div className={styles.notice}>
          <span>Development: email is not set up, so here is the link.</span>
          <a href={devLink}>{devLink}</a>
        </div>
      )}
      <form action={passwordSignInAction} className={styles.form}>
        <label className={styles.field}>
          Email
          <input className={styles.input} type="email" name="email" autoComplete="username" inputMode="email" defaultValue={one('email')} required />
        </label>
        <PasswordField label="Password" autoComplete="current-password" />
        <button className={styles.button} type="submit">
          Log in
        </button>
        <div className={styles.divider}>or</div>
        <button className={styles.buttonGhost} type="submit" formAction={requestLinkAction} formNoValidate>
          Email me a sign-in link
        </button>
      </form>
    </AuthShell>
  );
}
