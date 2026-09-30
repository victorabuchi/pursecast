import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage, { CONTACT } from '../../components/legal/LegalPage';

export const metadata: Metadata = { title: 'Privacy', description: 'What Pursecast keeps about you, why, where, and how to take it with you or delete it.' };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="September 30, 2026">
      <p>Pursecast is a personal budgeting app that forecasts your money. This page explains what we keep about you, why, where it is stored, who helps us run the service, and your choices. We do not sell your data and we do not use it for advertising.</p>

      <h2>What we keep</h2>
      <ul>
        <li><b>Your account:</b> name, email address, a password (stored only as a one-way hash), time zone, currency and an optional profile picture.</li>
        <li><b>What you enter:</b> balances, pay, bills and subscriptions, budgets, spending you log, ratings, notes (text or voice), planned costs, things you want to buy, money owed, to-dos and other accounts.</li>
        <li><b>Statements you upload:</b> the transactions read from PDFs, screenshots and exports. The files themselves are not kept after reading.</li>
        <li><b>Connected banks (optional):</b> if you connect a bank, the account names, masked account numbers, balances and transactions your bank shares with your approval.</li>
        <li><b>Calendar (optional):</b> the address of a calendar you connect and the events read from it for planning.</li>
        <li><b>Notifications (optional):</b> the address your browser gives us to send reminders, and whether you want the weekly email.</li>
        <li><b>Technical:</b> a sign-in cookie, and error reports without your personal content.</li>
      </ul>

      <h2>Why</h2>
      <p>Only to run Pursecast for you: to forecast your money, show where it went, remind you of what you asked to be reminded of, keep your account secure, and fix problems. The legal basis is the agreement to provide the service you signed up for, and your consent for optional features such as bank connections, which you can withdraw at any time.</p>

      <h2>Bank connections</h2>
      <p>
        Bank connections are provided by Enable Banking Oy, a licensed account information service provider supervised by the Finnish Financial Supervisory Authority. You approve access in your own bank, and you choose the accounts. Access is read-only: Pursecast can never move money. Access ends when you disconnect in Pursecast, when you revoke it in your bank, or when it expires (at most 180 days).
      </p>

      <h2>Who helps us</h2>
      <ul>
        <li>Supabase (database, hosted in the EU, Ireland).</li>
        <li>Render (application hosting, in the EU, Frankfurt).</li>
        <li>Enable Banking Oy (bank connections, Finland), only if you connect a bank.</li>
        <li>Anthropic (reading uploaded statements and screenshots), only for files you upload. Files are sent for reading and not used to train models.</li>
        <li>Resend (sending email), only for sign-in links and emails you turn on.</li>
        <li>Your browser&rsquo;s push service (such as Google, Apple or Mozilla), only if you turn on notifications.</li>
      </ul>
      <p>Some of these companies may process data outside the EU under standard contractual clauses.</p>

      <h2>How long</h2>
      <p>We keep your data while you have an account. When you delete your account, everything is deleted from the live database right away. Disconnecting a bank stops new data; transactions already imported stay until you delete them or your account.</p>

      <h2>Your choices and rights</h2>
      <ul>
        <li>Download everything we keep about you as a file: Settings, Export my data.</li>
        <li>Delete your account and all its data: Settings, Delete account.</li>
        <li>Correct your details at any time in the app.</li>
        <li>You can also ask us for access, correction, deletion, restriction or portability, object to processing, and complain to your data protection authority (in Finland, the Data Protection Ombudsman).</li>
      </ul>

      <h2>Contact</h2>
      <p>
        Questions about your data: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. See also our <Link href="/terms">terms</Link>.
      </p>
    </LegalPage>
  );
}
