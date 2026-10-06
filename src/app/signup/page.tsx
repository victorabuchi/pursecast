import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import AuthShell from '../../components/auth/AuthShell';
import PasswordField from '../../components/auth/PasswordField';
import GoogleButton from '../../components/auth/GoogleButton';
import styles from '../../components/auth/auth.module.css';
import { getViewer } from '../../lib/auth/viewer';
import { signUpAction } from '../../lib/auth/actions';
import { HOME } from '../../lib/auth/constants';
import { MIN_PASSWORD_LENGTH } from '../../lib/auth/password';

export const metadata: Metadata = { title: 'Start free' };

const ERRORS: Record<string, string> = {
  missing: 'Enter your name and email address.',
  short: `Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`,
  taken: 'There is already an account with this email. Log in instead, or ask for a sign-in link.',
};

export default async function SignupPage({ searchParams }: PageProps<'/signup'>) {
  if (await getViewer()) redirect(HOME);
  const params = await searchParams;
  const one = (k: string) => (typeof params[k] === 'string' ? params[k] : '');
  const error = ERRORS[one('error')];

  return (
    <AuthShell
      title="Start budgeting the future"
      lede="Free while in beta. No bank login needed."
      below={
        <>
          Already have an account? <Link href="/login">Log in</Link>
        </>
      }
    >
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <GoogleButton />
      <form action={signUpAction} className={styles.form}>
        <label className={styles.field}>
          Your name
          <input className={styles.input} name="name" autoComplete="given-name" maxLength={80} defaultValue={one('name')} required />
        </label>
        <label className={styles.field}>
          Email
          <input className={styles.input} type="email" name="email" autoComplete="email" inputMode="email" defaultValue={one('email')} required />
        </label>
        <PasswordField label="Password" hint={`At least ${MIN_PASSWORD_LENGTH} characters.`} autoComplete="new-password" required />
        <label className={styles.honey} aria-hidden="true">
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
        <button className={styles.button} type="submit">
          Create account
        </button>
      </form>
      <p className={styles.fine}>
        {error === ERRORS['taken'] ? <Link href={`/login?email=${encodeURIComponent(one('email'))}`}>Go to log in</Link> : 'You can export or delete your data at any time.'}
      </p>
    </AuthShell>
  );
}
