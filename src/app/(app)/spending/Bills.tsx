import styles from "../../../components/app/app.module.css";
import I from "../../../components/app/Icon";
import Submit from "../../../components/app/Submit";
import { MoneyInput, SignToggle } from "../../../components/app/Fields";
import PriceInput from "../../../components/app/PriceInput";
import type { Rates } from "../../../lib/money/currencies";
import { CloseButton, SheetButton } from "../../../components/app/Sheet";
import Popover from "../../../components/app/Popover";
import {
  cancelAdvanceAction,
  pauseAction,
  resumeAction,
  skipOnceAction,
  takeAdvanceAction,
  unskipAction,
} from "../../../lib/money/bill-actions";
import type { Cat, Money, RecurringRow } from "../../../lib/money/load";
import { addMonths, monthName, short } from "../../../lib/money/dates";
import { exact, money } from "../../../lib/money/format";
import { CADENCES, occurrences, perMonth } from "../../../lib/money/recurrence";
import {
  addRecurringAction,
  deleteRecurringAction,
  updateRecurringAction,
} from "../../../lib/money/actions";
import {
  POPULAR_BILLS,
  POPULAR_SUBSCRIPTIONS,
} from "../../../lib/money/presets";

const BACK = "/spending?tab=bills";

function RecurringForm({
  row,
  currency,
  rates,
  today,
  types,
  preset,
}: {
  row?: RecurringRow;
  currency: string;
  rates: Rates;
  today: string;
  types: Cat[];
  preset?: Cat;
}) {
  const billed =
    row?.priceCurrency && row.priceAmount !== null
      ? { cur: row.priceCurrency, cents: row.priceAmount }
      : row && row.amount
        ? { cur: currency, cents: Math.abs(row.amount) }
        : null;
  return (
    <form
      action={row ? updateRecurringAction : addRecurringAction}
      className={styles.form}
    >
      <input type="hidden" name="back" value={BACK} />
      {row && <input type="hidden" name="id" value={row.id} />}
      {!row && (
        <SignToggle
          name="direction"
          value={preset?.kind === "income" ? "+" : "-"}
          minus="Bill"
          plus="Income"
          label="Bill or income"
        />
      )}
      <label className={styles.field}>
        Name
        <input
          className={styles.input}
          name="name"
          list="recurring-names"
          defaultValue={row?.name}
          placeholder={
            preset?.name === "Subscriptions"
              ? "Netflix"
              : preset?.kind === "income"
                ? "Salary"
                : "Car insurance"
          }
          required={!row}
          autoFocus={!row}
          maxLength={80}
          autoComplete="off"
        />
        <datalist id="recurring-names">
          {(preset?.name === "Subscriptions"
            ? POPULAR_SUBSCRIPTIONS
            : preset?.kind === "income"
              ? [
                  { name: "Salary" },
                  { name: "Child benefit" },
                  { name: "Side job" },
                  { name: "Rent from lodger" },
                ]
              : [...POPULAR_BILLS, ...POPULAR_SUBSCRIPTIONS]
          ).map((p) => (
            <option key={p.name} value={p.name} />
          ))}
        </datalist>
      </label>
      <div className={styles.row}>
        <label className={styles.field}>
          Amount
          <PriceInput
            name="amount"
            account={currency}
            rates={rates}
            currency={billed?.cur}
            defaultValue={billed ? String(billed.cents / 100) : ""}
            placeholder="Leave empty if it varies"
          />
        </label>
        <label className={styles.field}>
          How often
          <select
            name="cadence"
            className={styles.select}
            defaultValue={row?.cadence ?? "monthly"}
          >
            {CADENCES.map(([c, label]) => (
              <option key={c} value={c}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={styles.row}>
        <label className={styles.field}>
          Next due date
          <input
            className={styles.input}
            type="date"
            name="nextDate"
            defaultValue={row?.nextDate}
            min={today}
          />
        </label>
        <label className={styles.field}>
          Type
          <select
            name="categoryId"
            className={styles.select}
            defaultValue={row?.categoryId ?? preset?.id ?? ""}
          >
            {!row && <option value="">Pick for me</option>}
            {types.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className={styles.check}>
        <input type="checkbox" name="variable" defaultChecked={row?.variable} />
        The price or date changes each time (like Render or Supabase)
      </label>
      <p className={styles.note}>
        Varying ones are never posted automatically; log what they really cost.
        A rough amount helps Money Weather.
      </p>
      <div className={styles.sheetActions}>
        <CloseButton className={styles.btnGhost}>Cancel</CloseButton>
        <Submit className={styles.btn}>{row ? "Save" : "Add"}</Submit>
      </div>
    </form>
  );
}

const BLURB: Record<string, string> = {
  Income: "Salary and anything else that comes in regularly.",
  Housing: "Rent, mortgage and housing costs.",
  Subscriptions: "Streaming, apps and memberships. Yearly ones included.",
  "Bills & insurance": "Phone, electricity, internet and insurance.",
};

function BillRow({
  r,
  color,
  currency,
  rates,
  today,
  types,
  openAdvance = false,
}: {
  r: RecurringRow;
  color?: string;
  currency: string;
  rates: Rates;
  today: string;
  types: Cat[];
  openAdvance?: boolean;
}) {
  const upcoming = occurrences(
    r.nextDate,
    r.cadence,
    today,
    addMonths(today, 14),
  ).slice(0, 3);
  const skipped = upcoming.filter((d) => r.skips.includes(d));
  const next = upcoming.find((d) => !r.skips.includes(d));
  const income = r.amount > 0;
  const tint = color ?? "#64748b";
  return (
    <div
      className={styles.entry}
      style={r.paused ? { opacity: 0.6 } : undefined}
    >
      <span
        className={styles.catDot}
        style={{ background: `${tint}1f`, color: tint }}
        aria-hidden="true"
      >
        <I d={income ? "wallet" : "repeat"} size={15} />
      </span>
      <span>
        <b>
          {r.name}
          {r.paused && <span className={styles.tag}>paused</span>}
          {r.variable && <span className={styles.tag}>varies</span>}
        </b>
        <small>
          {CADENCES.find(([c]) => c === r.cadence)?.[1]}
          {!r.paused && next ? ` · due ${short(next)}` : ""}
        </small>
        {skipped.map((d) => (
          <form key={d} action={unskipAction} className={styles.inlineNote}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="date" value={d} />
            <span>Skipped for {monthName(d.slice(0, 7), true)}</span>
            <button type="submit" className={styles.linkBtn}>
              Add it back
            </button>
          </form>
        ))}
        {r.advances.map((a) => (
          <form
            key={a.id}
            action={cancelAdvanceAction}
            className={styles.inlineNote}
          >
            <input type="hidden" name="id" value={a.id} />
            <span>
              {exact(a.amount, currency)} advance
              {a.pending ? ` on ${short(a.takenOn)}` : ""} · off the{" "}
              {short(a.payday)} pay
            </span>
            <button
              type="submit"
              className={styles.linkBtn}
              aria-label="Remove advance"
            >
              Undo
            </button>
          </form>
        ))}
      </span>
      {r.paused ? (
        <form action={resumeAction}>
          <input type="hidden" name="id" value={r.id} />
          <Submit className={`${styles.btnGhost} ${styles.btnSmall}`}>
            Resume
          </Submit>
        </form>
      ) : (
        <b
          className={`${styles.num} ${income ? styles.pos : ""}`}
          title={
            r.priceCurrency
              ? `About ${exact(Math.abs(r.amount), currency)} at today's rate`
              : undefined
          }
        >
          {r.priceCurrency && r.priceAmount !== null
            ? r.variable
              ? `~${exact(r.priceAmount, r.priceCurrency)}`
              : exact(
                  income ? r.priceAmount : -r.priceAmount,
                  r.priceCurrency,
                  { sign: income },
                )
            : r.variable
              ? r.amount
                ? `~${exact(Math.abs(r.amount), currency)}`
                : "Varies"
              : exact(r.amount, currency, { sign: income })}
          {r.priceCurrency && (
            <small className={styles.billedAs}>
              ≈ {exact(Math.abs(r.amount), currency)}
            </small>
          )}
        </b>
      )}
      {income && !r.paused && (
        <SheetButton
          className={`${styles.btnGhost} ${styles.btnSmall}`}
          label="Advance"
          initiallyOpen={openAdvance}
          title={`${r.name} advance`}
          sub="Part of your pay early. The same amount comes off the next payday after it."
        >
          <form action={takeAdvanceAction} className={styles.form}>
            <input type="hidden" name="id" value={r.id} />
            <div className={styles.row}>
              <label className={styles.field}>
                How much
                <MoneyInput
                  name="amount"
                  currency={currency}
                  required
                  autoFocus
                />
              </label>
              <label className={styles.field}>
                Arrives on
                <input
                  className={styles.input}
                  type="date"
                  name="date"
                  defaultValue={today}
                  min={today}
                />
              </label>
            </div>
            <p className={styles.note}>
              It is added to your balance on that day, and comes off your next
              payday after it. Money Weather shows both, so you see the dip
              coming.
            </p>
            <div className={styles.sheetActions}>
              <CloseButton className={styles.btnGhost}>Cancel</CloseButton>
              <Submit className={styles.btn}>Add advance</Submit>
            </div>
          </form>
        </SheetButton>
      )}
      <SheetButton
        className={styles.xBtn}
        ariaLabel={`Edit ${r.name}`}
        label={<I d="edit" size={14} />}
        title={`Edit ${r.name}`}
      >
        <RecurringForm
          row={r}
          currency={currency}
          rates={rates}
          today={today}
          types={types}
        />
      </SheetButton>
      <Popover
        label={`More for ${r.name}`}
        className={styles.xBtn}
        button={<I d="more" size={16} />}
      >
        {!r.paused && next && (
          <form action={skipOnceAction}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="date" value={next} />
            <button type="submit" className={styles.popItem}>
              <I d="skip" /> Skip {monthName(next.slice(0, 7), true)}
              <small className={styles.muted} style={{ marginLeft: "auto" }}>
                not using it
              </small>
            </button>
          </form>
        )}
        <form action={r.paused ? resumeAction : pauseAction}>
          <input type="hidden" name="id" value={r.id} />
          <button type="submit" className={styles.popItem}>
            <I d={r.paused ? "play" : "pause"} />{" "}
            {r.paused ? "Resume" : "Pause until I resume"}
          </button>
        </form>
        <form action={deleteRecurringAction}>
          <input type="hidden" name="id" value={r.id} />
          <button
            type="submit"
            className={styles.popItem}
            style={{ color: "var(--neg)" }}
          >
            <I d="trash" /> Remove for good
          </button>
        </form>
      </Popover>
    </div>
  );
}

// Bills and income grouped by type, each in its own block.
export default function Bills({
  data,
  openNew,
  openAdvance,
}: {
  data: Money;
  openNew: boolean;
  openAdvance: boolean;
}) {
  const { me, recurring, cats } = data;
  const cur = me.currency;
  const types = cats
    .filter((c) => c.kind !== "flex")
    .sort(
      (a, b) =>
        Number(b.kind === "income") - Number(a.kind === "income") ||
        a.position - b.position,
    );
  const typeIds = new Set(types.map((t) => t.id));
  const blocks = [
    ...types.map((t) => ({
      key: t.id,
      title: t.name,
      cat: t as Cat | undefined,
      rows: recurring.filter((r) => r.categoryId === t.id),
    })),
    {
      key: "other",
      title: "Other bills",
      cat: undefined,
      rows: recurring.filter(
        (r) => !r.categoryId || !typeIds.has(r.categoryId),
      ),
    },
  ].filter((b) => b.cat || b.rows.length);
  // Paused items do not count until resumed.
  const monthly = (rows: RecurringRow[]) =>
    rows
      .filter((r) => !r.paused)
      .reduce((s, r) => s + perMonth(r.amount, r.cadence), 0);
  const inTotal = monthly(recurring.filter((r) => r.amount > 0));
  const outTotal = -monthly(recurring.filter((r) => r.amount < 0));
  const subs = types.find((t) => t.name === "Subscriptions");
  const firstIncome = recurring.find((r) => r.amount > 0 && !r.paused);

  return (
    <>
      <div className={styles.stats}>
        <div className={`${styles.card} ${styles.stat}`}>
          <small>Comes in each month</small>
          <b className={styles.pos}>{money(inTotal, cur)}</b>
        </div>
        <div className={`${styles.card} ${styles.stat}`}>
          <small>Bills each month</small>
          <b>{money(outTotal, cur)}</b>
        </div>
        <div className={`${styles.card} ${styles.stat}`}>
          <small>Subscriptions a year</small>
          <b>
            {money(
              subs
                ? -monthly(recurring.filter((r) => r.categoryId === subs.id)) *
                    12
                : 0,
              cur,
            )}
          </b>
        </div>
      </div>
      <div className={styles.row} style={{ alignItems: "center" }}>
        <SheetButton
          className={styles.btn}
          initiallyOpen={openNew}
          label={
            <>
              <I d="plus" size={15} stroke={2.6} /> Add bill or income
            </>
          }
          title="Add bill or income"
          sub="Anything that repeats. It posts itself on its due date."
        >
          <RecurringForm
            currency={cur}
            rates={data.rates}
            today={me.today}
            types={types}
          />
        </SheetButton>
        <p className={styles.note} style={{ flex: "3 1 300px" }}>
          Bills and income post themselves on their due date and move your
          balance, so you only log everyday spending.
        </p>
      </div>
      <div className={styles.split2}>
        {blocks.map((b) => (
          <section key={b.key} className={styles.card} aria-label={b.title}>
            <div className={styles.cardHead}>
              <span>
                <strong className={styles.cardTitle}>{b.title}</strong>
                {BLURB[b.title] && (
                  <span className={styles.cardSub} style={{ display: "block" }}>
                    {BLURB[b.title]}
                  </span>
                )}
              </span>
              <span className={`${styles.num} ${styles.cardSub}`}>
                {money(Math.abs(monthly(b.rows)), cur)} / mo
              </span>
            </div>
            {b.rows.length === 0 && (
              <p className={styles.note}>Nothing here yet.</p>
            )}
            {b.rows.map((r) => (
              <BillRow
                key={r.id}
                r={r}
                color={b.cat?.color}
                currency={cur}
                rates={data.rates}
                today={me.today}
                types={types}
                openAdvance={openAdvance && r.id === firstIncome?.id}
              />
            ))}
            {b.cat && (
              <SheetButton
                className={`${styles.btnGhost} ${styles.btnSmall}`}
                label={
                  <>
                    <I d="plus" size={14} stroke={2.6} /> Add to{" "}
                    {b.title.toLowerCase()}
                  </>
                }
                title={`Add to ${b.title.toLowerCase()}`}
              >
                <RecurringForm
                  currency={cur}
                  rates={data.rates}
                  today={me.today}
                  types={types}
                  preset={b.cat}
                />
              </SheetButton>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
