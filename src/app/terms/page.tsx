import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage, { CONTACT } from '../../components/legal/LegalPage';

export const metadata: Metadata = { title: 'Terms', description: 'The terms for using Pursecast.' };

export default function TermsPage() {
  return (
    <LegalPage title="Terms" updated="September 30, 2026">
      <p>These terms apply when you use Pursecast. By creating an account you agree to them.</p>

      <h2>The service</h2>
      <p>Pursecast helps you plan your money: it forecasts balances from what you enter, what you upload and, if you choose, what your bank shares. Forecasts, suggestions and categories are estimates to help you decide. They are not financial, tax or legal advice, and you remain responsible for your own decisions.</p>

      <h2>Your account</h2>
      <ul>
        <li>Give a real email address and keep your sign-in details to yourself.</li>
        <li>Use Pursecast only for your own money or money you are allowed to manage.</li>
        <li>Do not misuse the service, try to break it or access other people&rsquo;s data.</li>
      </ul>

      <h2>Bank connections</h2>
      <p>Connecting a bank is optional and read-only, provided through Enable Banking Oy. Your bank decides which accounts and how much history it shares, and how long access lasts. Information from banks can be late or incomplete; Pursecast shows it as received.</p>

      <h2>Your data</h2>
      <p>
        Your data is yours. We use it only to provide Pursecast, as described in our <Link href="/privacy">privacy notice</Link>. You can export or delete it at any time in Settings.
      </p>

      <h2>Availability and changes</h2>
      <p>We work to keep Pursecast running and correct, but we cannot promise it will always be available or free of errors. We may change or stop features, and will tell you in the app or by email before changes that affect you significantly.</p>

      <h2>Ending</h2>
      <p>You can stop using Pursecast and delete your account at any time. We may suspend accounts that break these terms.</p>

      <h2>Liability</h2>
      <p>To the extent the law allows, Pursecast is not liable for indirect losses or for decisions made based on forecasts. Nothing in these terms limits rights you have as a consumer under the law of your country.</p>

      <h2>Contact</h2>
      <p>
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
      </p>
    </LegalPage>
  );
}
