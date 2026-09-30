import type { Instrumentation } from 'next';

// Server errors reach the owner: a chat webhook (Slack, Discord or anything
// that takes {text} or {content}) at ALERT_WEBHOOK_URL, and/or an email to
// ALERT_EMAIL through Resend. The same message is sent at most once every 15
// minutes. No cookies, headers or form data leave the server.
const recent = new Map<string, number>();
const QUIET_MS = 15 * 60 * 1000;

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const webhook = process.env['ALERT_WEBHOOK_URL'];
  const to = process.env['ALERT_EMAIL'];
  if (!webhook && !to) return;
  const message = err instanceof Error ? err.message : String(err);
  const digest = typeof err === 'object' && err !== null && 'digest' in err ? String((err as { digest: unknown }).digest) : '';
  const key = `${context.routePath}|${message}`;
  const now = Date.now();
  if ((recent.get(key) ?? 0) > now - QUIET_MS) return;
  recent.set(key, now);
  const text = [`Pursecast error on ${request.method} ${request.path.split('?')[0]}`, message.slice(0, 500), `${context.routeType} · ${context.routePath}${digest ? ` · digest ${digest}` : ''}`].join('\n');
  try {
    await Promise.all([
      webhook ? fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, content: text }), signal: AbortSignal.timeout(5000) }) : null,
      to ? import('./lib/email').then(({ sendEmail }) => sendEmail({ to, subject: `Pursecast error: ${message.slice(0, 80)}`, text })) : null,
    ]);
  } catch (e) {
    console.error('Could not send the error alert', e);
  }
};
