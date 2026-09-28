import { evaluate, isExpression } from './calc';

// Starting categories. flex ones have a suggested monthly budget (cents) that
// setup shows and the person can change.

export type Kind = 'flex' | 'fixed' | 'income';
export type DefaultCategory = { name: string; kind: Kind; budget: number; color: string; words: RegExp };

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: 'Groceries', kind: 'flex', budget: 35000, color: '#16a34a', words: /grocer|supermarket|lidl|aldi|tesco|k-?market|k-?citymarket|prisma|s-?market|alepa|sale\b|rimi|coop|food shop|market/i },
  { name: 'Eating out', kind: 'flex', budget: 12000, color: '#f97316', words: /restaurant|ravintola|lunch|lounas|dinner|brunch|bistro|sushi|burger|kebab|pizzeria/i },
  { name: 'Takeaway', kind: 'flex', budget: 6000, color: '#ef4444', words: /wolt|foodora|uber ?eats|deliveroo|just ?eat|takeaway|take-away|take away|delivery|pizza/i },
  { name: 'Coffee', kind: 'flex', budget: 4000, color: '#a16207', words: /coffee|kahvi|cafe|café|latte|espresso|cappuccino|starbucks|robert|bakery/i },
  { name: 'Transport', kind: 'flex', budget: 8000, color: '#0ea5e9', words: /\bbus\b|train|\bvr\b|taxi|uber|bolt|hsl|metro|tram|fuel|petrol|gas station|\bneste\b|\bst1\b|parking|scooter|tier|voi\b/i },
  { name: 'Fun money', kind: 'flex', budget: 15000, color: '#8b5cf6', words: /concert|keikka|cinema|movie|finnkino|\bbar\b|beer|olut|drinks|club|game|steam|gym|climbing|boulder|ticket|festival|bowling|museum/i },
  { name: 'Shopping', kind: 'flex', budget: 10000, color: '#ec4899', words: /clothes|shoes|amazon|zalando|ikea|h&m|hm\b|zara|stockmann|clas ohlson|tokmanni|gigantti|verkkokauppa|shop/i },
  { name: 'Health', kind: 'flex', budget: 3000, color: '#14b8a6', words: /pharmacy|apteekki|doctor|lääkäri|dentist|hammas|medicine|vitamin|terveys/i },
  { name: 'Gifts', kind: 'flex', budget: 0, color: '#f43f5e', words: /gift|present|lahja|flowers|kukka/i },
  { name: 'Travel', kind: 'flex', budget: 0, color: '#6366f1', words: /flight|hotel|airbnb|finnair|ryanair|norwegian|booking\.com|hostel|viking line|tallink/i },
  { name: 'Other', kind: 'flex', budget: 5000, color: '#64748b', words: /$^/ },
  { name: 'Housing', kind: 'fixed', budget: 0, color: '#0f7a63', words: /\brent\b|vuokra|mortgage|laina|vastike/i },
  { name: 'Bills & insurance', kind: 'fixed', budget: 0, color: '#475569', words: /electric|sähkö|internet|phone|puhelin|elisa|telia|\bdna\b|insurance|vakuutus|water|heating|if\b|lähitapiola|pohjola/i },
  { name: 'Subscriptions', kind: 'fixed', budget: 0, color: '#d946ef', words: /netflix|spotify|disney|hbo|max\b|viaplay|youtube|icloud|apple|google one|subscription|streaming|patreon|chatgpt/i },
  { name: 'Income', kind: 'income', budget: 0, color: '#15803d', words: /salary|palkka|wage|paycheck|payday|refund|kela|bonus|freelance|invoice paid/i },
];

export function isKind(v: unknown): v is Kind {
  return v === 'flex' || v === 'fixed' || v === 'income';
}

// "12.50 lunch", "lunch 12,50", "€4 coffee", "+2900 salary". The first word
// that is a number is the amount, the rest is the note. Income needs a +.
export function parseQuick(input: string): { amount: number; note: string } | null {
  const s = input.trim();
  const income = s.startsWith('+');
  const words = s.replace(/^[+-]\s*/, '').split(/\s+/);
  const at = words.findIndex((w) => /^[€$£]?\d[\d.,]*(€|e|eur)?$/i.test(w) || (/^[\d(√]/.test(w) && isExpression(w) && evaluate(w) !== null));
  if (at === -1) return null;
  const cents = isExpression(words[at]!) ? Math.round((evaluate(words[at]!) ?? 0) * 100) || null : parseCents(words[at]!);
  if (!cents) return null;
  const note = words
    .filter((_, i) => i !== at)
    .join(' ')
    .replace(/^(on|for|at)\s+/i, '')
    .trim();
  return { amount: income ? cents : -cents, note: note ? note[0]!.toUpperCase() + note.slice(1) : income ? 'Income' : 'Expense' };
}

function parseCents(word: string): number | null {
  const clean = word.replace(/[€$£]|eur$|e$/gi, '');
  const normalized = /,\d{1,2}$/.test(clean) ? clean.replace(/\./g, '').replace(',', '.') : clean.replace(/,/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

// Same note as before wins; otherwise keywords; otherwise nothing.
export function guessCategory(note: string, amount: number, history: Map<string, string>, byName: Map<string, string>): string | null {
  const seen = history.get(note.trim().toLowerCase());
  if (seen) return seen;
  for (const c of DEFAULT_CATEGORIES) {
    if ((c.kind === 'income') !== amount > 0) continue;
    if (c.words.test(note) && byName.has(c.name)) return byName.get(c.name)!;
  }
  if (amount > 0) return byName.get('Income') ?? null;
  return byName.get('Other') ?? null;
}

// Category name for a bill or income by its name: Housing, Subscriptions,
// Bills & insurance, or Income.
export function recurringCategory(name: string, income: boolean): string {
  if (income) return 'Income';
  return DEFAULT_CATEGORIES.find((c) => c.kind === 'fixed' && c.words.test(name))?.name ?? 'Bills & insurance';
}
