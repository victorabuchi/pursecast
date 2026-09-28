import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '../../../components/app/app.module.css';
import I from '../../../components/app/Icon';
import PageHead from '../../../components/app/PageHead';
import CategorySelect from '../../../components/app/CategorySelect';
import Submit from '../../../components/app/Submit';
import BudgetPicker from '../../../components/app/BudgetPicker';
import { DEFAULT_CATEGORIES } from '../../../lib/money/categories';
import { loadMoney, type Money } from '../../../lib/money/load';
import Bills from './Bills';
import Owed from './Owed';
import Pause from './Pause';
import { addMonthKey, monthLabel, monthOf, relative } from '../../../lib/money/dates';
import { exact, money } from '../../../lib/money/format';
import { FACE, isMood } from '../../../lib/money/worth';
import { addCategoryAction, deleteCategoryAction, deleteEntryAction, quickAddAction, saveBudgetsAction } from '../../../lib/money/actions';

export const metadata: Metadata = { title: 'Spending', robots: { index: false } };

type Tab = 'activity' | 'bills' | 'owed' | 'budgets';

export default async function SpendingPage({ searchParams }: PageProps<'/spending'>) {
  const params = await searchParams;
  const tab: Tab = params['tab'] === 'bills' || params['tab'] === 'owed' || params['tab'] === 'budgets' ? params['tab'] : 'activity';
  const data = await loadMoney();
  const { me } = data;

  return (
    <>
      <PageHead
        title="Spending"
        sub={tab === 'bills' ? 'Bills, subscriptions and income' : tab === 'owed' ? 'Money owed and borrowed' : tab === 'budgets' ? 'Budgets for everyday spending' : 'Log it in two seconds'}
        icon="list"
        right={
          <nav className={styles.segment} aria-label="Spending sections">
            <Link href="/spending" aria-current={tab === 'activity' ? 'page' : undefined}>
              Activity
            </Link>
            <Link href="/spending?tab=bills" aria-current={tab === 'bills' ? 'page' : undefined}>
              Bills &amp; income
            </Link>
            <Link href="/spending?tab=owed" aria-current={tab === 'owed' ? 'page' : undefined}>
              Owed
            </Link>
            <Link href="/spending?tab=budgets" aria-current={tab === 'budgets' ? 'page' : undefined}>
              Budgets
            </Link>
          </nav>
        }
      />
      {tab === 'activity' && <Activity data={data} month={typeof params['month'] === 'string' && /^\d{4}-\d{2}$/.test(params['month']) ? params['month'] : monthOf(me.today)} focus={Boolean(params['add'])} />}
      {tab === 'bills' && <Bills data={data} openNew={Boolean(params['new'])} openAdvance={Boolean(params['advance'])} />}
      {tab === 'owed' && <Owed data={data} openNew={Boolean(params['new'])} />}
      {params['pause'] && <Pause me={me} cats={data.cats} params={params} />}
      {tab === 'budgets' && <Budgets data={data} />}
    </>
  );
}

type Data = Money;

function Activity({ data, month, focus }: { data: Data; month: string; focus: boolean }) {
  const { me, cats, entries } = data;
  const cur = me.currency;
  const catById = new Map(cats.map((c) => [c.id, c]));
  const inMonth = entries.filter((e) => monthOf(e.date) === month);
  // Lending, borrowing and paybacks move money but are not spending or income.
  const own = inMonth.filter((e) => !e.debtId);
  const spent = -own.filter((e) => e.amount < 0).reduce((s, e) => s + e.amount, 0);
  const income = own.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const isThisMonth = month === monthOf(me.today);
  const flexLeft = data.budgets.reduce((s, b) => s + Math.max(0, b.budget - (b.cuts[month] ?? 0) - b.spent), 0);
  const back = isThisMonth ? '/spending' : `/spending?month=${month}`;
  const days = [...new Set(inMonth.map((e) => e.date))];
  const options = cats.map((c) => ({ id: c.id, name: c.name }));

  return (
    <>
      <form action={quickAddAction} className={styles.quick} id="add">
        <input type="hidden" name="back" value={back} />
        <input className={styles.input} name="text" placeholder='12.50 lunch  ·  +2900 salary' autoComplete="off" autoFocus={focus} required aria-label="Amount and a word" />
        <select name="categoryId" className={styles.select} defaultValue="" aria-label="Category">
          <option value="">Category: automatic</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input className={`${styles.input} ${styles.dateInput}`} type="date" name="date" defaultValue={me.today} max={me.today} aria-label="Date" />
        <Submit className={styles.btn}>
          <I d="plus" size={15} stroke={2.6} />
          Add
        </Submit>
      </form>

      <div className={styles.stats}>
        <div className={`${styles.card} ${styles.stat}`}>
          <small>Spent in {monthLabel(month, me.today)}</small>
          <b>{money(spent, cur)}</b>
        </div>
        <div className={`${styles.card} ${styles.stat}`}>
          <small>Came in</small>
          <b className={styles.pos}>{money(income, cur)}</b>
        </div>
        <div className={`${styles.card} ${styles.stat}`}>
          <small>{isThisMonth ? 'Left in budgets this month' : 'Net'}</small>
          <b>{isThisMonth ? money(flexLeft, cur) : money(income - spent, cur, { sign: true })}</b>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHead}>
          <Link href={`/spending?month=${addMonthKey(month, -1)}`} className={styles.iconBtn} aria-label="Previous month">
            <I d="left" size={16} />
          </Link>
          <strong className={styles.cardTitle}>{monthLabel(month, me.today)}</strong>
          {isThisMonth ? (
            <span style={{ width: 36 }} />
          ) : (
            <Link href={`/spending?month=${addMonthKey(month, 1)}`} className={styles.iconBtn} aria-label="Next month">
              <I d="right" size={16} />
            </Link>
          )}
        </div>
        {inMonth.length === 0 && (
          <div className={styles.empty}>
            <b>Nothing logged {isThisMonth ? 'yet this month' : `in ${monthLabel(month, me.today)}`}.</b>
            Type an amount and a word above, like &quot;4.20 coffee&quot;. Pursecast picks the category and updates your forecast.
          </div>
        )}
        {days.map((d) => {
          const list = inMonth.filter((e) => e.date === d);
          const total = list.reduce((s, e) => s + e.amount, 0);
          return (
            <div key={d}>
              <div className={styles.dayHead}>
                <span>{relative(d, me.today)}</span>
                <span className={styles.num}>{exact(total, cur, { sign: true })}</span>
              </div>
              {list.map((e) => {
                const c = e.categoryId ? catById.get(e.categoryId) : undefined;
                return (
                  <div key={e.id} className={styles.entry}>
                    <span className={styles.catDot} style={{ background: `${c?.color ?? '#64748b'}1f`, color: c?.color ?? '#64748b' }} aria-hidden="true">
                      {(c?.name ?? e.note)[0]}
                    </span>
                    <span>
                      <b>
                        {e.note}
                        {e.recurringId && <span className={styles.tag}>repeats</span>}
                        {e.debtId && <span className={styles.tag}>owed</span>}
                      </b>
                      <CategorySelect id={e.id} value={e.categoryId} options={options} back={back} />
                    </span>
                    {isMood(e.mood) && (
                      <span title="Your Worth-It rating" aria-label={`Rated ${e.mood}`}>
                        {FACE[e.mood]}
                      </span>
                    )}
                    <b className={`${styles.num} ${e.amount > 0 ? styles.pos : ''}`}>{exact(e.amount, cur, { sign: e.amount > 0 })}</b>
                    <form action={deleteEntryAction}>
                      <input type="hidden" name="id" value={e.id} />
                      <input type="hidden" name="back" value={back} />
                      <button type="submit" className={styles.xBtn} aria-label={`Delete ${e.note}`}>
                        <I d="x" size={14} />
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}

function Budgets({ data }: { data: Data }) {
  const { me, cats, budgets } = data;
  const cur = me.currency;
  const month = monthOf(me.today);
  const flex = cats.filter((c) => c.kind === 'flex');
  const other = cats.filter((c) => c.kind !== 'flex');
  const suggested = new Map(DEFAULT_CATEGORIES.map((c) => [c.name, c.budget]));
  const options = flex.map((c) => {
    const b = budgets.find((x) => x.id === c.id);
    return { name: c.name, amount: c.budget || (suggested.get(c.name) ?? 0), color: c.color, spent: b?.spent ?? 0, cut: b?.cuts[month] ?? 0 };
  });
  const initial = flex.filter((c) => c.budget > 0 || (budgets.find((x) => x.id === c.id)?.spent ?? 0) > 0).map((c) => c.name);
  return (
    <div className={styles.split}>
      <form action={saveBudgetsAction} className={styles.card}>
        <div className={styles.cardHead}>
          <span>
            <strong className={styles.cardTitle}>Everyday spending · {monthLabel(month, me.today)}</strong>
            <span className={styles.cardSub} style={{ display: 'block' }}>
              Money Weather spreads these over each month. Remove the ones you do not use.
            </span>
          </span>
        </div>
        <BudgetPicker options={options} initial={initial} currency={cur} />
        <Submit className={styles.btn}>Save budgets</Submit>
      </form>
      <div className={styles.card}>
        <strong className={styles.cardTitle}>Bill and income types</strong>
        <p className={styles.note}>The blocks on Bills &amp; income. Removing one keeps its bills under Other.</p>
        {other.map((c) => (
          <div key={c.id} className={styles.entry}>
            <span className={styles.catDot} style={{ background: `${c.color}1f`, color: c.color }} aria-hidden="true">
              {c.name[0]}
            </span>
            <span>
              <b>{c.name}</b>
              <small>{c.kind === 'income' ? 'Income' : 'Bills'}</small>
            </span>
            <form action={deleteCategoryAction}>
              <input type="hidden" name="id" value={c.id} />
              <button type="submit" className={styles.xBtn} aria-label={`Remove ${c.name}`}>
                <I d="trash" size={14} />
              </button>
            </form>
          </div>
        ))}
        <form action={addCategoryAction} className={styles.row} style={{ paddingTop: 12, borderTop: '1px solid var(--line)' }}>
          <input type="hidden" name="back" value="/spending?tab=budgets" />
          <input className={styles.input} name="name" placeholder="New type, like Insurance" required maxLength={40} aria-label="Type name" />
          <select name="kind" className={styles.select} defaultValue="fixed" aria-label="Bills or income" style={{ flex: '0 1 120px' }}>
            <option value="fixed">Bills</option>
            <option value="income">Income</option>
          </select>
          <Submit className={`${styles.btnGhost} ${styles.btnSmall}`}>Add</Submit>
        </form>
      </div>
    </div>
  );
}
