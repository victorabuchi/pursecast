import { DEFAULT_CATEGORIES } from '../money/categories';
import type { Txn } from './types';

// Reads bank exports (CSV and Excel rows) without any AI when the columns can
// be recognised. Returns null when they cannot, so the caller can fall back.

export function parseCsv(text: string): string[][] {
  const body = text.replace(/^﻿/, '');
  const firstLine = body.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = [';', '\t', ',', '|'].map((d) => [d, firstLine.split(d).length] as const).sort((a, b) => b[1] - a[1])[0]![0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i]!;
    if (quoted) {
      if (c === '"' && body[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && body[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows.map((r) => r.map((x) => x.trim()));
}

const HEAD = {
  date: /^(date|booking date|transaction date|posting date|value date|kirjauspäivä|maksupäivä|tapahtumapäivä|päivämäärä|arvopäivä|datum|buchungsdatum|bokföringsdag|fecha|data)$/i,
  amount: /^(amount|sum|value|määrä|summa|määrä euroa|määrä eur|belopp|betrag|importe|montant|amount \(eur\)|amount eur)$/i,
  debit: /^(debit|out|money out|withdrawal|withdrawals|paid out|veloitus|nosto|uttag|soll)$/i,
  credit: /^(credit|in|money in|deposit|deposits|paid in|hyvitys|pano|insättning|haben)$/i,
  text: /(description|details|merchant|payee|payer|counterparty|name|narrative|reference|memo|text|selitys|otsikko|viesti|saaja|maksaja|nimi|beskrivning|mottagare|verwendungszweck|empfänger|concepto)/i,
};

function toCents(raw: string): number | null {
  let s = raw.replace(/[€$£\s ]|EUR|USD|GBP/gi, '');
  if (!s) return null;
  let sign = 1;
  if (/^\(.*\)$/.test(s)) {
    sign = -1;
    s = s.slice(1, -1);
  }
  if (s.endsWith('-')) {
    sign = -sign;
    s = s.slice(0, -1);
  }
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) * sign : null;
}

// Day-first unless the first part cannot be a day.
function toDay(raw: string): string | null {
  const s = raw.trim();
  let m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/.exec(s);
  if (m) return fmt(+m[1]!, +m[2]!, +m[3]!);
  m = /^(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})/.exec(s);
  if (m) {
    let [a, b] = [+m[1]!, +m[2]!];
    const y = m[3]!.length === 2 ? 2000 + +m[3]! : +m[3]!;
    if (b > 12 && a <= 12) [a, b] = [b, a];
    return fmt(y, b, a);
  }
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (m) return fmt(+m[1]!, +m[2]!, +m[3]!);
  return null;
}

function fmt(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Keyword categories for rows read without AI.
export function categorize(text: string, amount: number): string {
  if (amount > 0) return /transfer|siirto|oma tili|own account/i.test(text) ? 'Transfers' : 'Income';
  if (/atm|cash|käteis|nosto|otto/i.test(text)) return 'Cash';
  if (/fee|palkkio|maksu pankki|service charge|interest|korko/i.test(text)) return 'Fees';
  const hit = DEFAULT_CATEGORIES.find((c) => c.kind !== 'income' && c.words.test(text));
  if (!hit) return 'Other';
  return hit.name === 'Fun money' ? 'Fun' : hit.name;
}

export function tidyPlace(text: string): string {
  const s = text
    .replace(/\b(card|kortti|visa|mastercard|debit|purchase|osto|payment|maksu)\b/gi, '')
    .replace(/\*+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return (s.split(/\s{2,}| - |\//)[0] ?? s).slice(0, 60) || text.slice(0, 60);
}

export function rowsToTxns(rows: string[][]): Txn[] | null {
  const headerAt = rows.slice(0, 15).findIndex((r) => r.some((c) => HEAD.date.test(c.trim())) && r.some((c) => HEAD.amount.test(c.trim()) || HEAD.debit.test(c.trim())));
  if (headerAt === -1) return null;
  const head = rows[headerAt]!.map((c) => c.trim());
  const col = (re: RegExp) => head.findIndex((c) => re.test(c));
  const dateCol = col(HEAD.date);
  const amountCol = col(HEAD.amount);
  const debitCol = col(HEAD.debit);
  const creditCol = col(HEAD.credit);
  // Who the money went to, or came from: the other party, not the owner.
  const payeeCol = col(/saaja|payee|recipient|beneficiary|merchant|mottagare|empfänger/i);
  const payerCol = col(/maksaja|payer|sender|avsändare|auftraggeber/i);
  const textCols = head.map((c, i) => (HEAD.text.test(c) && ![dateCol, amountCol, payeeCol, payerCol].includes(i) ? i : -1)).filter((i) => i >= 0);
  const out: Txn[] = [];
  for (const r of rows.slice(headerAt + 1)) {
    const date = toDay(r[dateCol] ?? '');
    let amount: number | null = null;
    if (amountCol >= 0) amount = toCents(r[amountCol] ?? '');
    else {
      const debit = toCents(r[debitCol] ?? '');
      const credit = creditCol >= 0 ? toCents(r[creditCol] ?? '') : null;
      amount = credit ? Math.abs(credit) : debit ? -Math.abs(debit) : null;
    }
    if (!date || !amount) continue;
    const party = (amount < 0 ? r[payeeCol] : r[payerCol])?.trim();
    const description = [...new Set(textCols.map((i) => (r[i] ?? '').trim()).filter(Boolean))].join(' · ').slice(0, 200) || party || 'Transaction';
    const place = party ? party.slice(0, 60) : tidyPlace(description);
    out.push({ date, description, place, amount, category: categorize(`${place} ${description}`, amount) });
  }
  return out.length ? out : null;
}
