import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import AuthShell from '../../components/auth/AuthShell';
import PasswordField from '../../components/auth/PasswordField';
import GoogleButton from '../../components/auth/GoogleButton';
import styles from '../../components/auth/auth.module.css';
import { getViewer } from '../../lib/auth/viewer';
import { passwordSignInAction } from '../../lib/auth/actions';
import { HOME } from '../../lib/auth/constants';

export const metadata: Metadata = { title: 'Log in' };

const ERRORS: Record<string, string> = {
  missing: 'Enter your email address, and your password to sign in with one.',
  invalid: 'That email and password do not match.',
  throttled: 'Too many attempts. Wait a few minutes, or continue with Google.',
  google: 'Google sign-in did not finish. Try again.',
  apple: 'Apple sign-in did not finish. Try again.',
};

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  if (await getViewer()) redirect(HOME);
  const params = await searchParams;
  const one = (k: string) => (typeof params[k] === 'string' ? params[k] : '');
  const error = ERRORS[one('error')];

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
      <GoogleButton />
      <form action={passwordSignInAction} className={styles.form}>
        <label className={styles.field}>
          Email
          <input className={styles.input} type="email" name="email" autoComplete="username" inputMode="email" defaultValue={one('email')} required />
        </label>
        <PasswordField label="Password" autoComplete="current-password" />
        <button className={styles.button} type="submit">
          Log in
        </button>
      </form>
    </AuthShell>
  );
}
