import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import { STATEMENT_CATEGORIES, isStatementCategory, type Txn } from './types';
import { categorize, parseCsv, rowsToTxns, tidyPlace } from './tabular';

// Turns an uploaded file into transactions. Spreadsheets are read directly;
// screenshots, PDFs and tables we cannot recognise are read by Claude.

export type Upload = { name: string; type: string; bytes: Buffer };
export type ReadResult = { txns: Txn[]; note?: string };

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export const aiReady = () => Boolean(process.env['ANTHROPIC_API_KEY']);

function kind(file: Upload): 'pdf' | 'image' | 'csv' | 'excel' | 'unknown' {
  const name = file.name.toLowerCase();
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (IMAGE_TYPES.has(file.type) || /\.(png|jpe?g|webp|gif)$/.test(name)) return 'image';
  if (/\.xlsx$/.test(name) || file.type.includes('spreadsheetml')) return 'excel';
  if (/\.(csv|txt|tsv)$/.test(name) || file.type.startsWith('text/')) return 'csv';
  return 'unknown';
}

async function excelRows(bytes: Buffer): Promise<string[][]> {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(bytes as unknown as ArrayBuffer);
  const sheet = book.worksheets.reduce((a, b) => (b.rowCount > (a?.rowCount ?? 0) ? b : a), book.worksheets[0]);
  const rows: string[][] = [];
  sheet?.eachRow({ includeEmpty: false }, (row) => {
    const values = (row.values as unknown[]).slice(1).map((v) => {
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      if (v && typeof v === 'object' && 'result' in v) return String((v as { result: unknown }).result ?? '');
      if (v && typeof v === 'object' && 'text' in v) return String((v as { text: unknown }).text ?? '');
      return v === null || v === undefined ? '' : String(v);
    });
    rows.push(values.map((x) => x.trim()));
  });
  return rows;
}

// Asked before every call to Claude; false when today's limit is used up.
export type Allow = () => Promise<boolean>;
export const LIMIT_NOTE = 'You have read a lot of statements today. Screenshots and PDFs work again tomorrow; Excel and CSV exports still work now.';

export async function readUpload(file: Upload, today: string, allow: Allow = async () => true): Promise<ReadResult> {
  const k = kind(file);
  if (k === 'unknown') return { txns: [], note: `${file.name}: use a screenshot, PDF, Excel (.xlsx) or CSV file.` };
  if (k === 'csv' || k === 'excel') {
    const rows = k === 'excel' ? await excelRows(file.bytes) : parseCsv(file.bytes.toString('utf8'));
    const direct = rowsToTxns(rows);
    if (direct) return { txns: direct };
    if (!aiReady()) return { txns: [], note: `${file.name}: the columns were not recognised. Reading any layout needs ANTHROPIC_API_KEY.` };
    // Unknown layout: hand the table to Claude in chunks.
    const out: Txn[] = [];
    for (let i = 0; i < rows.length; i += 300) {
      const text = rows
        .slice(i, i + 300)
        .map((r) => r.join(' | '))
        .join('\n');
      if (!(await allow())) return { txns: out, note: LIMIT_NOTE };
      out.push(...(await extract([{ type: 'text', text: `Rows ${i + 1}-${i + 300} of a bank export:\n${text}` }], today)).txns);
    }
    return { txns: out };
  }
  if (!aiReady()) return { txns: [], note: `${file.name}: reading screenshots and PDFs needs ANTHROPIC_API_KEY.` };
  if (!(await allow())) return { txns: [], note: LIMIT_NOTE };
  const data = file.bytes.toString('base64');
  const block: Anthropic.Beta.BetaContentBlockParam =
    k === 'pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
      : { type: 'image', source: { type: 'base64', media_type: (IMAGE_TYPES.has(file.type) ? file.type : 'image/png') as 'image/png', data } };
  return extract([block], today);
}

const TxnSchema = z.object({
  date: z.string().describe('YYYY-MM-DD'),
  description: z.string().describe('The transaction text as shown'),
  place: z.string().describe('Short clean name of the shop, company or person'),
  amount: z.number().describe('In the account currency; negative when money went out, positive when it came in'),
  category: z.enum(STATEMENT_CATEGORIES),
});
const ResultSchema = z.object({ transactions: z.array(TxnSchema) });

const INSTRUCTIONS = `You read bank statements, transaction screenshots and bank exports for a personal finance app.
Extract every individual transaction you can see, once each. Skip running balances, totals, opening/closing balance lines and pending authorisations that are repeated as completed.
- date: the booking or purchase date as YYYY-MM-DD. When the year is not shown, use the statement's period, or the most recent past date given today's date.
- amount: negative for money going out (purchases, bills, withdrawals, fees), positive for money coming in (salary, refunds, transfers in).
- place: the merchant, company or person, cleaned of card numbers, reference codes and city suffixes, e.g. "K-Market", "Wolt", "Spotify".
- category: pick the closest. Transfers between the person's own accounts are "Transfers". Salary, refunds and money received are "Income".
If there are no transactions, return an empty list.`;

const client = () => new Anthropic();

async function extract(content: Anthropic.Beta.BetaContentBlockParam[], today: string): Promise<ReadResult> {
  const stream = client().beta.messages.stream({
    model: 'claude-opus-5',
    max_tokens: 64000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: betaZodOutputFormat(ResultSchema) },
    system: INSTRUCTIONS,
    messages: [{ role: 'user', content: [...content, { type: 'text', text: `Today is ${today}. Extract the transactions.` }] }],
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === 'refusal') return { txns: [], note: 'That file could not be read.' };
  const parsed = message.parsed_output;
  if (!parsed) return { txns: [], note: 'Nothing could be read from that file.' };
  const txns = parsed.transactions
    .filter((t) => /^\d{4}-\d{2}-\d{2}$/.test(t.date) && Number.isFinite(t.amount) && t.amount !== 0)
    .map((t) => {
      const amount = Math.round(t.amount * 100);
      const description = t.description.trim().slice(0, 200) || t.place;
      return {
        date: t.date,
        description,
        place: (t.place.trim() || tidyPlace(description)).slice(0, 60),
        amount,
        category: isStatementCategory(t.category) ? t.category : categorize(description, amount),
      };
    });
  return { txns, note: message.stop_reason === 'max_tokens' ? 'That file is very long; only the first part was read. Split it into smaller files.' : undefined };
}
