import 'server-only';
import { createSign } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

// Enable Banking (open banking across Europe): the person picks their bank,
// approves in the bank's own app or site, and we read balances and
// transactions for as long as they allow. Requests are signed with the
// application's private key (RS256), which is read from
// ENABLE_BANKING_PRIVATE_KEY (the PEM text), or a file: ENABLE_BANKING_KEY_FILE,
// ./enablebanking.pem, or a Render secret file at /etc/secrets/enablebanking.pem.

const API = 'https://api.enablebanking.com';

function privateKey(): string | null {
  const inline = process.env['ENABLE_BANKING_PRIVATE_KEY'];
  if (inline) return inline.includes('\\n') ? inline.replace(/\\n/g, '\n') : inline;
  for (const f of [process.env['ENABLE_BANKING_KEY_FILE'], 'enablebanking.pem', '/etc/secrets/enablebanking.pem']) {
    if (f && existsSync(f)) return readFileSync(f, 'utf8');
  }
  return null;
}

export const bankReady = () => Boolean(process.env['ENABLE_BANKING_APP_ID'] && privateKey());

let token: { jwt: string; until: number } | null = null;
function jwt(): string {
  const now = Math.floor(Date.now() / 1000);
  if (token && token.until > now + 60) return token.jwt;
  const key = privateKey();
  const app = process.env['ENABLE_BANKING_APP_ID'];
  if (!key || !app) throw new Error('Bank connections are not set up (ENABLE_BANKING_APP_ID and the private key).');
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = b64({ typ: 'JWT', alg: 'RS256', kid: app });
  const body = b64({ iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: now, exp: now + 3600 });
  const sig = createSign('RSA-SHA256').update(`${head}.${body}`).sign(key, 'base64url');
  token = { jwt: `${head}.${body}.${sig}`, until: now + 3600 };
  return token.jwt;
}

export class BankError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function call<T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: object): Promise<T> {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${jwt()}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text.slice(0, 300);
    try {
      const j = JSON.parse(text) as { message?: string; detail?: unknown; error?: string };
      msg = j.message || j.error || (typeof j.detail === 'string' ? j.detail : msg);
    } catch {}
    throw new BankError(msg || `Bank request failed (${res.status})`, res.status);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export type Aspsp = { name: string; country: string; logo: string; maximum_consent_validity?: number; psu_types?: string[]; beta?: boolean };
export type Money = { amount: string; currency: string };
export type SessionAccount = { uid: string; name?: string; currency?: string; account_id?: { iban?: string }; cash_account_type?: string; details?: string; product?: string };
export type BankTxn = {
  entry_reference?: string;
  transaction_id?: string;
  transaction_amount: Money;
  credit_debit_indicator: 'CRDT' | 'DBIT' | string;
  status?: string;
  booking_date?: string;
  value_date?: string;
  transaction_date?: string;
  creditor?: { name?: string } | null;
  debtor?: { name?: string } | null;
  remittance_information?: string[] | null;
};

// Banks in a country, kept for a day (the list rarely changes).
const bankCache = new Map<string, { at: number; list: Aspsp[] }>();
export async function banksIn(country: string): Promise<Aspsp[]> {
  const hit = bankCache.get(country);
  if (hit && Date.now() - hit.at < 86_400_000) return hit.list;
  const res = await call<{ aspsps: Aspsp[] }>('GET', `/aspsps?country=${encodeURIComponent(country)}&psu_type=personal&service=AIS`);
  const list = res.aspsps.filter((a) => !a.psu_types || a.psu_types.includes('personal')).sort((a, b) => a.name.localeCompare(b.name));
  bankCache.set(country, { at: Date.now(), list });
  return list;
}

export async function application(): Promise<{ environment: 'SANDBOX' | 'PRODUCTION'; countries?: string[] }> {
  return call('GET', '/application');
}

// Sends the person to their bank. Access lasts as long as the bank allows,
// up to 180 days.
export async function startAuth(input: { aspsp: { name: string; country: string }; state: string; redirectUrl: string; days: number }): Promise<{ url: string }> {
  const validUntil = new Date(Date.now() + input.days * 86_400_000).toISOString();
  return call('POST', '/auth', { access: { valid_until: validUntil }, aspsp: input.aspsp, state: input.state, redirect_url: input.redirectUrl, psu_type: 'personal' });
}

export async function createSession(code: string): Promise<{ session_id: string; accounts: SessionAccount[]; access?: { valid_until?: string } }> {
  return call('POST', '/sessions', { code });
}

export async function deleteSession(sessionId: string): Promise<void> {
  await call('DELETE', `/sessions/${encodeURIComponent(sessionId)}`);
}

export async function balances(uid: string): Promise<Array<{ balance_amount: Money; balance_type: string }>> {
  return (await call<{ balances: Array<{ balance_amount: Money; balance_type: string }> }>('GET', `/accounts/${encodeURIComponent(uid)}/balances`)).balances ?? [];
}

// Every booked transaction since a day, following the pages.
export async function transactions(uid: string, from: string): Promise<BankTxn[]> {
  const out: BankTxn[] = [];
  let key: string | undefined;
  for (let page = 0; page < 50; page++) {
    const q = new URLSearchParams({ date_from: from });
    if (key) q.set('continuation_key', key);
    const res = await call<{ transactions: BankTxn[]; continuation_key?: string | null }>('GET', `/accounts/${encodeURIComponent(uid)}/transactions?${q}`);
    out.push(...(res.transactions ?? []));
    if (!res.continuation_key) break;
    key = res.continuation_key;
  }
  return out;
}
