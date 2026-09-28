import type { Metadata } from 'next';
import AuthShell from '../../../components/auth/AuthShell';
import styles from '../../../components/auth/auth.module.css';
import { consumeLinkAction } from '../../../lib/auth/actions';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };

// A button, not an automatic sign-in on GET, so mail scanners that open links
// cannot use up the one-time token.
export default async function VerifyPage({ searchParams }: PageProps<'/auth/verify'>) {
  const { token } = await searchParams;
  return (
    <AuthShell title="Sign in to Pursecast" lede="Confirm to finish signing in on this device.">
      <form action={consumeLinkAction} className={styles.form}>
        <input type="hidden" name="token" value={typeof token === 'string' ? token : ''} />
        <button className={styles.button} type="submit">
          Continue
        </button>
      </form>
    </AuthShell>
  );
}
