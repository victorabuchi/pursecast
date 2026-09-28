// Categories for imported transactions. Income comes in; Transfers are money
// moved between the person's own accounts and are left out of spending.
export const STATEMENT_CATEGORIES = [
  'Income',
  'Groceries',
  'Eating out',
  'Takeaway',
  'Coffee',
  'Transport',
  'Housing',
  'Bills & insurance',
  'Subscriptions',
  'Shopping',
  'Health',
  'Fun',
  'Travel',
  'Gifts',
  'Cash',
  'Fees',
  'Transfers',
  'Other',
] as const;

export type StatementCategory = (typeof STATEMENT_CATEGORIES)[number];

// One transaction: date YYYY-MM-DD, amount in cents (negative = money out).
export type Txn = { date: string; description: string; place: string; amount: number; category: string };

export function isStatementCategory(v: string): v is StatementCategory {
  return (STATEMENT_CATEGORIES as readonly string[]).includes(v);
}
