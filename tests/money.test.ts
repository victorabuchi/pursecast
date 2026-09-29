import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, addMonths, range, relative, todayIn, weekStart } from '../src/lib/money/dates';
import { exact, initials, money, parseAmount } from '../src/lib/money/format';
import { occurrences, rollForward } from '../src/lib/money/recurrence';
import { buildForecast, jarAccrued, monthsOfForecast, saveSuggestion, spreadCut, suggestFix, weeksOf, worstWeek, type FcEvent } from '../src/lib/money/forecast';
import { adviceFor, joyByCategory, type Rated } from '../src/lib/money/worth';
import { forkValue, pastBalance } from '../src/lib/money/forks';
import { estimate, normalizeCalendarUrl, parseIcs } from '../src/lib/money/plan';
import { personalInflation } from '../src/lib/money/inflation';
import { guessCategory, parseQuick } from '../src/lib/money/categories';
import { evaluate, isExpression, show } from '../src/lib/money/calc';
import { affordableFrom } from '../src/lib/money/wish';
import { parseCsv, rowsToTxns } from '../src/lib/statements/tabular';
import { story } from '../src/lib/statements/analysis';
import { paidBack, remaining } from '../src/lib/money/debts';
import { noteFor, pauseFor, validAudio } from '../src/lib/money/notes';

test('dates', () => {
  assert.equal(addDays('2026-10-30', 3), '2026-11-02');
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2026-01-31', 1, 31), '2026-02-28');
  assert.equal(weekStart('2026-09-28'), '2026-09-28');
  assert.equal(weekStart('2026-10-04'), '2026-09-28');
  assert.equal(range('2026-11-03', '2026-11-09'), 'Nov 3–9');
  assert.equal(range('2026-10-27', '2026-11-02'), 'Oct 27–Nov 2');
  assert.equal(relative('2026-09-27', '2026-09-28'), 'Yesterday');
  assert.equal(todayIn('Europe/Helsinki', new Date('2026-09-27T22:30:00Z')), '2026-09-28');
});

test('money formatting and parsing', () => {
  assert.equal(money(-8600, 'EUR'), '−€86');
  assert.equal(money(290000, 'EUR', { sign: true }), '+€2,900');
  assert.equal(exact(1250, 'EUR'), '€12.50');
  assert.equal(exact(1200, 'EUR'), '€12');
  assert.equal(parseAmount('12,50'), 1250);
  assert.equal(parseAmount('1,200'), 120000);
  assert.equal(parseAmount('€950'), 95000);
  assert.equal(parseAmount('abc'), null);
  assert.equal(initials('Victor Abuchi'), 'VA');
  assert.equal(initials('Victor'), 'VI');
});

test('two-second logging', () => {
  assert.deepEqual(parseQuick('12.50 lunch'), { amount: -1250, note: 'Lunch' });
  assert.deepEqual(parseQuick('coffee 4,20'), { amount: -420, note: 'Coffee' });
  assert.deepEqual(parseQuick('€64 concert at Tavastia'), { amount: -6400, note: 'Concert at Tavastia' });
  assert.deepEqual(parseQuick('+2900 salary'), { amount: 290000, note: 'Salary' });
  assert.equal(parseQuick('lunch'), null);
  const byName = new Map([
    ['Takeaway', 't'],
    ['Other', 'o'],
    ['Income', 'i'],
    ['Coffee', 'c'],
  ]);
  assert.equal(guessCategory('Wolt thai', -3800, new Map(), byName), 't');
  assert.equal(guessCategory('Mystery', -100, new Map(), byName), 'o');
  assert.equal(guessCategory('Mystery', -100, new Map([['mystery', 'c']]), byName), 'c');
  assert.equal(guessCategory('Salary', 100, new Map(), byName), 'i');
});

test('recurrence', () => {
  assert.deepEqual(occurrences('2026-10-03', 'monthly', '2026-09-28', '2026-12-31'), ['2026-10-03', '2026-11-03', '2026-12-03']);
  assert.deepEqual(occurrences('2026-10-01', 'weekly', '2026-10-05', '2026-10-20'), ['2026-10-08', '2026-10-15']);
  assert.equal(rollForward('2026-09-01', 'monthly', '2026-09-28'), '2026-10-01');
});

test('Money Weather finds the storm and a fix clears it', () => {
  const base = {
    today: '2026-09-28',
    balance: 100000,
    cushion: 0,
    recurring: [
      { id: 'rent', name: 'Rent', amount: -95000, cadence: 'monthly' as const, nextDate: '2026-11-03' },
      { id: 'salary', name: 'Salary', amount: 290000, cadence: 'monthly' as const, nextDate: '2026-11-09' },
    ],
    events: [],
    days: 91,
  };
  const budget = { id: 'fun', name: 'Fun money', budget: 15000, spent: 0, cuts: {} as Record<string, number> };
  const fc = buildForecast({ ...base, budgets: [budget] });
  assert.equal(fc.days.length, 91);
  assert.ok(fc.low.amount < 0, `low ${fc.low.amount}`);
  const weeks = weeksOf(fc);
  const storm = worstWeek(weeks)!;
  assert.equal(storm.sky, 'storm');
  assert.equal(storm.start, '2026-11-02');
  const groceries = { id: 'food', name: 'Groceries', budget: 40000, spent: 0, cuts: {} as Record<string, number> };
  const fix = suggestFix(buildForecast({ ...base, budgets: [groceries, budget] }), storm, [groceries, budget]);
  assert.ok(fix && fix.categoryId === 'fun' && fix.amount % 1000 === 0, JSON.stringify(fix));
  // Applying the fix lifts the low point by the amount, however the months fall.
  const cuts = spreadCut(fix.amount, base.today, fix.until);
  const fixed = buildForecast({ ...base, budgets: [groceries, { ...budget, cuts }] });
  const before = buildForecast({ ...base, budgets: [groceries, budget] });
  const at = (f: typeof fixed) => f.days.find((d) => d.date === fix.until)!.spendable;
  assert.ok(Math.abs(at(fixed) - at(before) - fix.amount) <= 100, `${at(fixed) - at(before)} vs ${fix.amount}`);
});

test('saving for an event: the film wedding is €104 a month, 17% right away', () => {
  const s = saveSuggestion(62000, '2026-09-28', '2027-03-14');
  assert.deepEqual(s, { monthly: 10400, months: 6 });
  const ev: FcEvent = { id: 'w', name: 'Wedding', date: '2027-03-14', cost: 62000, saveMonthly: 10400, saveFrom: '2026-09', source: 'calendar' };
  assert.equal(Math.round((jarAccrued(ev, '2026-09-28') / 62000) * 100), 17);
  assert.equal(jarAccrued(ev, '2026-10-01'), 20800);
  assert.equal(jarAccrued(ev, '2027-03-13'), 62000);
  const fc = buildForecast({ today: '2026-09-28', balance: 100000, cushion: 0, recurring: [], budgets: [], events: [ev], days: 200 });
  assert.equal(fc.reserved, 10400);
  const after = fc.days.find((d) => d.date === '2027-03-14')!;
  assert.equal(after.spendable, 100000 - 62000);
  assert.equal(after.real, 100000 - 62000);
});

test('Worth-It suggests moving money from regret to joy', () => {
  const rated: Rated[] = [
    ...Array.from({ length: 5 }, (_, i) => ({ categoryId: 'take', categoryName: 'Takeaway', amount: -3000, mood: i < 4 ? ('regret' as const) : ('meh' as const), date: `2026-09-0${i + 1}` })),
    { categoryId: 'fun', categoryName: 'Fun money', amount: -6400, mood: 'love', date: '2026-09-10' },
    { categoryId: 'fun', categoryName: 'Fun money', amount: -1600, mood: 'love', date: '2026-09-11' },
  ];
  const joy = joyByCategory(rated);
  assert.equal(joy[0]!.name, 'Fun money');
  assert.equal(joy[0]!.score, 10);
  const advice = adviceFor(
    joy,
    [
      { id: 'take', name: 'Takeaway', budget: 12000 },
      { id: 'fun', name: 'Fun money', budget: 4000 },
    ],
    new Set(),
  );
  assert.deepEqual(advice && { from: advice.from.id, to: advice.to.id, amount: advice.amount, regrets: advice.regrets, of: advice.of }, { from: 'take', to: 'fun', amount: 4000, regrets: 4, of: 5 });
  assert.equal(adviceFor(joy, [{ id: 'take', name: 'Takeaway', budget: 12000 }], new Set(['take'])), null);
});

test('forks', () => {
  assert.equal(forkValue(100000, { startDate: '2026-09-28', oneTime: -50000, monthly: 39000 }, '2026-09-27'), null);
  assert.equal(forkValue(100000, { startDate: '2026-09-28', oneTime: -50000, monthly: 39000 }, '2026-09-28'), 50000);
  const year = forkValue(0, { startDate: '2026-01-01', oneTime: 0, monthly: 10000 }, '2027-01-01')!;
  assert.ok(Math.abs(year - 120000) < 300);
  const entries = [
    { date: '2026-09-10', amount: -5000 },
    { date: '2026-09-20', amount: -1000 },
  ];
  assert.equal(pastBalance(100000, entries, '2026-09-15', '2026-09-01'), 101000);
  assert.equal(pastBalance(100000, entries, '2026-08-31', '2026-09-01'), null);
});

test('plan ahead reads a calendar and prices events', () => {
  const ics = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'UID:a1',
    'DTSTART;VALUE=DATE:20270314',
    "SUMMARY:Anna & Jon's wedding",
    'LOCATION:Porto\\, Portugal',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:b1',
    'DTSTART;VALUE=DATE:19900107',
    'RRULE:FREQ=YEARLY',
    "SUMMARY:Maya's birthday",
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:c1',
    'DTSTART:20261005T090000Z',
    'RRULE:FREQ=WEEKLY',
    'SUMMARY:Standup',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:d1',
    'DTSTART:20250101T090000Z',
    'SUMMARY:Old',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const events = parseIcs(ics, '2026-09-28', '2027-03-28');
  assert.deepEqual(
    events.map((e) => [e.name, e.date, e.location]),
    [
      ["Maya's birthday", '2027-01-07', ''],
      ["Anna & Jon's wedding", '2027-03-14', 'Porto, Portugal'],
    ],
  );
  const wedding = estimate("Anna & Jon's wedding", 'Porto')!;
  assert.equal(wedding.tag, 'Wedding');
  assert.equal(wedding.items.reduce((s, i) => s + i.amount, 0), 62000);
  assert.equal(estimate('Standup'), null);
  assert.equal(normalizeCalendarUrl('webcal://calendar.google.com/x.ics'), 'https://calendar.google.com/x.ics');
  assert.equal(normalizeCalendarUrl('not a url'), null);
});

test('personal inflation compares the same things a year apart', () => {
  const buys = [
    { note: 'Oat milk', category: 'Groceries', amount: -200, date: '2025-09-01' },
    { note: 'Oat milk', category: 'Groceries', amount: -220, date: '2026-09-01' },
    { note: 'Car insurance', category: 'Bills & insurance', amount: -40000, date: '2025-10-01' },
    { note: 'Car insurance', category: 'Bills & insurance', amount: -43000, date: '2026-09-15' },
    { note: 'Coffee', category: 'Coffee', amount: -400, date: '2025-09-10' },
    { note: 'Coffee', category: 'Coffee', amount: -400, date: '2026-09-10' },
  ];
  const r = personalInflation(buys, '2026-09-28');
  assert.ok(r.rate !== null && r.rate > 7 && r.rate < 8, JSON.stringify(r));
  assert.deepEqual(r.rate !== null && r.drivers, ['Bills & insurance', 'Groceries']);
  assert.equal(personalInflation(buys.slice(0, 2), '2026-09-28').rate, null);
});

test('money owed: paybacks go the other way', () => {
  const lent = { id: 'a', direction: 'lent', amount: 6000, settledAt: null };
  const borrowed = { id: 'b', direction: 'borrowed', amount: 30000, settledAt: null };
  const entries = [
    { debtId: 'a', amount: -6000 },
    { debtId: 'a', amount: 2000 },
    { debtId: 'b', amount: 30000 },
    { debtId: 'b', amount: -10000 },
    { debtId: null, amount: -500 },
  ];
  assert.equal(paidBack(lent, entries), 2000);
  assert.equal(remaining(lent, 2000), 4000);
  assert.equal(paidBack(borrowed, entries), 10000);
  assert.equal(remaining({ ...borrowed, settledAt: 'x' }, 0), 0);
  const fc = buildForecast({ today: '2026-09-28', balance: 100000, cushion: 0, recurring: [], budgets: [], events: [], debts: [{ id: 'b', person: 'Mom', remaining: 20000, dueDate: '2026-10-15' }], days: 30 });
  assert.equal(fc.days.find((d) => d.date === '2026-10-15')!.flows[0]!.name, 'Pay back Mom');
  assert.equal(fc.days.at(-1)!.spendable, 80000);
});

test('future-self notes play before regretted or over-budget spending', () => {
  const notes = [
    { id: 'any', categoryId: null, until: null },
    { id: 'take', categoryId: 't', until: '2026-12-01' },
    { id: 'old', categoryId: 'x', until: '2026-01-01' },
  ];
  assert.equal(noteFor(notes, 't', '2026-09-28')!.id, 'take');
  assert.equal(noteFor(notes, 'x', '2026-09-28')!.id, 'any');
  assert.equal(noteFor(notes.slice(1), 'x', '2026-09-28'), null);
  assert.deepEqual(pauseFor({ categoryId: 't', amount: -3800 }, { recentMoods: ['regret', 'regret', 'love'], budgetLeft: 10000 }), { reason: 'regret', regrets: 2, of: 3 });
  assert.deepEqual(pauseFor({ categoryId: 't', amount: -3800 }, { recentMoods: ['love'], budgetLeft: 2000 }), { reason: 'budget', over: 1800 });
  assert.equal(pauseFor({ categoryId: 't', amount: -3800 }, { recentMoods: ['love', 'meh'], budgetLeft: 9000 }), null);
  assert.equal(pauseFor({ categoryId: 't', amount: 3800 }, { recentMoods: ['regret', 'regret'], budgetLeft: 0 }), null);
  assert.ok(validAudio('data:audio/webm;codecs=opus;base64,GkXfo59ChoEBQveBAULygQRC'));
  assert.ok(!validAudio('data:text/html;base64,PHNjcmlwdD4='));
  assert.ok(!validAudio('javascript:alert(1)'));
});

test('skipped dates and salary advances in the forecast', () => {
  const base = { today: '2026-09-28', balance: 100000, cushion: 0, budgets: [], events: [], days: 60 };
  const electricity = { id: 'e', name: 'Electricity', amount: -4500, cadence: 'monthly' as const, nextDate: '2026-10-12' };
  const skipped = buildForecast({ ...base, recurring: [{ ...electricity, skips: ['2026-10-12'] }] });
  assert.equal(skipped.days.find((d) => d.date === '2026-10-12')!.flows.length, 0);
  assert.equal(skipped.days.find((d) => d.date === '2026-11-12')!.flows[0]!.amount, -4500);
  const salary = { id: 's', name: 'Salary', amount: 290000, cadence: 'monthly' as const, nextDate: '2026-10-09', advances: [{ payday: '2026-10-09', amount: 30000 }] };
  const fc = buildForecast({ ...base, recurring: [salary] });
  assert.deepEqual(
    fc.days.filter((d) => d.flows.length).map((d) => [d.date, d.flows[0]!.amount, d.flows[0]!.name]),
    [
      ['2026-10-09', 260000, 'Salary (after advance)'],
      ['2026-11-09', 290000, 'Salary'],
    ],
  );
});

test('a future salary advance comes in on its day and off the next pay', () => {
  const salary = { id: 's', name: 'Salary', amount: 290000, cadence: 'monthly' as const, nextDate: '2026-10-09', advances: [{ payday: '2026-10-09', amount: 30000, arrivesOn: '2026-10-03' }] };
  const fc = buildForecast({ today: '2026-09-28', balance: 0, cushion: 0, recurring: [salary], budgets: [], events: [], days: 20 });
  const flows = fc.days.filter((d) => d.flows.length).map((d) => [d.date, d.flows[0]!.amount, d.flows[0]!.name]);
  assert.deepEqual(flows, [
    ['2026-10-03', 30000, 'Salary advance'],
    ['2026-10-09', 260000, 'Salary (after advance)'],
  ]);
  assert.equal(fc.days.at(-1)!.spendable, 290000);
});

test('the longer views group the forecast by month', () => {
  const fc = buildForecast({ today: '2026-09-28', balance: 100000, cushion: 0, recurring: [{ id: 'r', name: 'Rent', amount: -95000, cadence: 'monthly', nextDate: '2026-11-03' }], budgets: [], events: [], days: 366 });
  const months = monthsOfForecast(fc);
  assert.equal(months.length, 13);
  assert.deepEqual([months[0]!.start, months[0]!.end], ['2026-09-28', '2026-09-30']);
  assert.deepEqual([months[2]!.start, months[2]!.end, months[2]!.low, months[2]!.sky], ['2026-11-01', '2026-11-30', 5000, 'cloud']);
  assert.equal(months[3]!.sky, 'storm');
});

test('sums in amount fields', () => {
  assert.equal(evaluate('200 + 10 + 45'), 255);
  assert.equal(evaluate('12,50 × 4'), 50);
  assert.equal(evaluate('100 ÷ 8'), 12.5);
  assert.equal(evaluate('3x4 - 2'), 10);
  assert.equal(evaluate('200 + 10%'), 220);
  assert.equal(evaluate('300 * 20%'), 60);
  assert.equal(evaluate('√144 + 2^3'), 20);
  assert.equal(evaluate('sqrt(16)*(2+1)'), 12);
  assert.equal(evaluate('1 200 + 50'), 1250);
  assert.equal(evaluate('10 / 0'), null);
  assert.equal(evaluate('2 +'), null);
  assert.equal(evaluate('alert(1)'), null);
  assert.equal(isExpression('1,200'), false);
  assert.equal(isExpression('45'), false);
  assert.equal(isExpression('200+10'), true);
  assert.equal(parseAmount('200 + 10 + 45'), 25500);
  assert.equal(parseAmount('12,50'), 1250);
  assert.deepEqual(parseQuick('12+8 lunch'), { amount: -2000, note: 'Lunch' });
  assert.equal(show(12.5), '12.5');
  assert.equal(show(255), '255');
});

test('want to buy: the first day it fits without a storm later', () => {
  const fc = buildForecast({ today: '2026-09-28', balance: 50000, cushion: 0, recurring: [{ id: 's', name: 'Salary', amount: 100000, cadence: 'monthly', nextDate: '2026-10-09' }], budgets: [], events: [], days: 60 });
  assert.equal(affordableFrom(fc, 40000), '2026-09-28');
  assert.equal(affordableFrom(fc, 120000), '2026-10-09');
  assert.equal(affordableFrom(fc, 500000), null);
});

test('statements: bank CSV is read without AI and told as a story', () => {
  const csv = ['Kirjauspäivä;Määrä;Maksaja;Maksunsaaja;Otsikko', '01.10.2025;2900,00;Acme Oy;Alex;Palkka', '03.10.2025;-950,00;Alex;Landlord;Vuokra', '05.10.2025;-12,99;Alex;Spotify;Spotify', '05.11.2025;-12,99;Alex;Spotify;Spotify', '06.12.2025;-12,99;Alex;Spotify;Spotify', '10.11.2025;-42,10;Alex;K-Market;K-Market Kamppi', '12.11.2025;-500,00;Alex;Alex;Oma tili siirto'].join('\n');
  const txns = rowsToTxns(parseCsv(csv))!;
  assert.equal(txns.length, 7);
  assert.deepEqual([txns[0]!.date, txns[0]!.amount, txns[0]!.category], ['2025-10-01', 290000, 'Income']);
  assert.equal(txns[5]!.category, 'Groceries');
  const s = story(txns.map((t) => (t.description.includes('siirto') ? { ...t, category: 'Transfers' } : t)), (c) => `€${c / 100}`, (m) => m)!;
  assert.equal(s.moneyIn, 290000);
  assert.equal(s.moneyOut, 95000 + 3 * 1299 + 4210);
  assert.equal(s.months.length, 3);
  assert.deepEqual(s.recurring.map((r) => [r.name, r.typical, r.months]), [['Spotify', 1299, 3]]);
  assert.deepEqual([txns[0]!.place, txns[5]!.place, txns[5]!.description], ['Acme Oy', 'K-Market', 'K-Market Kamppi']);
  assert.deepEqual(s.biggest.map((t) => t.place), ['Landlord', 'K-Market']);
  assert.equal(s.categories[0]!.name, 'Housing');
  assert.equal(parseCsv('a,b\n"x, y",2')[1]![0], 'x, y');
  assert.equal(rowsToTxns([['foo', 'bar'], ['1', '2']]), null);
});

test('a price in another currency converts through the dollar rate', async () => {
  const { convert } = await import('../src/lib/money/currencies');
  const rates = { USD: 1, EUR: 0.88, GBP: 0.75 };
  assert.equal(convert(2500, 'USD', 'EUR', rates), 2200);
  assert.equal(convert(2200, 'EUR', 'USD', rates), 2500);
  assert.equal(convert(1000, 'GBP', 'EUR', rates), 1173);
  assert.equal(convert(1000, 'EUR', 'EUR', rates), 1000);
  assert.equal(convert(1000, 'XYZ', 'EUR', rates), null);
});
