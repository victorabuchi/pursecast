// Basic arithmetic for amount fields and the calculator: + − × ÷, %, √, ^
// and brackets. A small parser, never eval.
//
// % works like a pocket calculator: 200 + 10% is 220, 300 × 20% is 60 and
// 50% on its own is 0.5.

type Tok = { t: 'num'; v: number } | { t: 'op'; v: string };

// Accepts what people type: "1 200", "12,50", "3x4", "×", "÷", "−", "sqrt".
export function normalize(input: string): string {
  return input
    .replace(/[€$£]/g, '')
    .replace(/(\d)[ \u00a0](?=\d{3}(?!\d))/g, '$1')
    .replace(/(\d),(\d{1,2})(?!\d)/g, '$1.$2')
    .replace(/(\d),(?=\d{3})/g, '$1')
    .replace(/[×xX]/g, '*')
    .replace(/[÷:]/g, '/')
    .replace(/[−–—]/g, '-')
    .replace(/sqrt/gi, '√')
    .replace(/\s+/g, '');
}

function tokenize(s: string): Tok[] | null {
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (/[\d.]/.test(c)) {
      const m = /^\d*\.?\d+|^\d+\.?/.exec(s.slice(i));
      if (!m) return null;
      out.push({ t: 'num', v: Number(m[0]) });
      i += m[0].length;
    } else if ('+-*/%^()√'.includes(c)) {
      out.push({ t: 'op', v: c });
      i += 1;
    } else return null;
  }
  return out;
}

type Val = { v: number; pct?: number };

export function evaluate(input: string): number | null {
  const toks = tokenize(normalize(input));
  if (!toks || !toks.length) return null;
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => peek()?.t === 'op' && peek()!.v === v;

  function primary(): number {
    const tk = toks![p];
    if (!tk) throw new Error('end');
    if (tk.t === 'num') {
      p++;
      return tk.v;
    }
    if (tk.v === '(') {
      p++;
      const v = expr();
      if (isOp(')')) p++;
      return v;
    }
    throw new Error('unexpected');
  }
  function power(): number {
    const base = primary();
    if (isOp('^')) {
      p++;
      return Math.pow(base, unary());
    }
    return base;
  }
  function unary(): number {
    if (isOp('-')) {
      p++;
      return -unary();
    }
    if (isOp('+')) {
      p++;
      return unary();
    }
    if (isOp('√')) {
      p++;
      const v = unary();
      if (v < 0) throw new Error('negative root');
      return Math.sqrt(v);
    }
    return power();
  }
  function factor(): Val {
    const v = unary();
    if (isOp('%')) {
      p++;
      return { v: v / 100, pct: v };
    }
    return { v };
  }
  function term(): Val {
    let left = factor();
    while (isOp('*') || isOp('/')) {
      const op = toks![p++]!.v;
      const right = factor();
      if (op === '/' && right.v === 0) throw new Error('divide by zero');
      left = { v: op === '*' ? left.v * right.v : left.v / right.v };
    }
    return left;
  }
  function expr(): number {
    let left = term().v;
    while (isOp('+') || isOp('-')) {
      const op = toks![p++]!.v;
      const right = term();
      // 200 + 10% adds ten percent of 200.
      const amount = right.pct !== undefined ? (left * right.pct) / 100 : right.v;
      left = op === '+' ? left + amount : left - amount;
    }
    return left;
  }

  try {
    const v = expr();
    if (p !== toks.length || !Number.isFinite(v)) return null;
    return Math.round(v * 1e10) / 1e10;
  } catch {
    return null;
  }
}

// True when the text is a sum to work out rather than a plain number.
export function isExpression(input: string): boolean {
  const s = normalize(input);
  return /[+*/%^()√]/.test(s) || /\d-/.test(s);
}

// Shows a result the way people write money: up to two decimals.
export function show(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/0$/, '');
}

// A field's value as a number while typing: plain or a sum, else 0.
export function amountOf(input: string): number {
  const v = isExpression(input) ? evaluate(input) : Number(normalize(input));
  return v !== null && Number.isFinite(v) ? v : 0;
}
