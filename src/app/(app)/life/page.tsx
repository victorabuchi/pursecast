import type { Metadata } from 'next';
import styles from '../../../components/app/app.module.css';
import I from '../../../components/app/Icon';
import PageHead from '../../../components/app/PageHead';
import Submit from '../../../components/app/Submit';
import ConfirmX from '../../../components/app/ConfirmX';
import Celebrate from '../../../components/app/Celebrate';
import { MoneyInput } from '../../../components/app/Fields';
import { db } from '../../../prisma/db';
import { loadMoney } from '../../../lib/money/load';
import { addMonths, diffDays, monthName, short } from '../../../lib/money/dates';
import { exact, money } from '../../../lib/money/format';
import { ageOn, grows, habitsOf, safeToSave, savingStreak, weeklyPace } from '../../../lib/money/life';
import { addGoalAction, deleteGoalAction, deleteSavingAction, openCapsuleAction, saveAction, setBirthdayAction, writeCapsuleAction } from '../../../lib/money/life-actions';

export const metadata: Metadata = { title: 'Life', robots: { index: false } };

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
const longDate = (d: string) => `${Number(d.slice(8))} ${monthName(d.slice(0, 7), true)} ${d.slice(0, 4)}`;

// The Life page: who you are becoming with your money. Age and birthdays,
// saving from today, goals, what saving grows into, and what the spending
// says about the way you live.
export default async function LifePage() {
  const { me, forecast: fc, entries, cats } = await loadMoney(91);
  const cur = me.currency;
  const m = (c: number) => money(c, cur);
  const [goals, deposits, capsules] = await Promise.all([
    db.orm.public.SavingGoal.where({ userId: me.id }).orderBy((g) => g.createdAt.asc()).all(),
    db.orm.public.SavingDeposit.where({ userId: me.id }).orderBy([(d) => d.date.desc(), (d) => d.createdAt.desc()]).all(),
    db.orm.public.Capsule.where({ userId: me.id }).orderBy((c) => c.openOn.asc()).all(),
  ]);

  const age = me.birthday ? ageOn(me.birthday, me.today) : null;
  const firstName = me.name.split(/\s+/)[0] || 'you';
  const totalSaved = deposits.reduce((s, d) => s + d.amount, 0);
  const savedFor = (id: string) => deposits.filter((d) => d.goalId === id).reduce((s, d) => s + d.amount, 0);
  const ins = deposits.filter((d) => d.amount > 0);
  const firstDay = ins.length ? ins[ins.length - 1]!.date : null;
  const streak = savingStreak(deposits.filter((d) => d.amount > 0).map((d) => d.date), me.today);
  const safe = safeToSave(fc);
  const habits = habitsOf(entries, cats, me.today);
  const last30 = ins.filter((d) => diffDays(d.date, me.today) < 30).reduce((s, d) => s + d.amount, 0);
  // What to plan with: the pace of the last 30 days, or a tenth of income, at least €25.
  const monthly = last30 || Math.max(2500, Math.round(habits.inPerMonth * 0.1 / 500) * 500);
  const emergency = Math.max(30000, Math.round((habits.outPerMonth * 3) / 5000) * 5000);
  const nextBirthday = age?.next ?? null;
  const hasEmergency = goals.some((g) => g.kind === 'emergency');
  const hasRainy = goals.some((g) => g.kind === 'rainy');
  // A month of everyday spending (not bills), at least €100.
  const everyday = habits.top.filter((t) => !['Housing', 'Bills & insurance', 'Subscriptions'].includes(t.name)).reduce((s, t) => s + t.perMonth, 0);
  const rainy = Math.max(10000, Math.round(everyday / 5000) * 5000);
  const hasBirthdayGoal = goals.some((g) => g.kind === 'birthday' && !g.doneAt);
  const hours = (c: number) => (habits.hourly ? Math.round(c / habits.hourly) : null);

  return (
    <>
      {age?.isBirthday && <Celebrate id={`birthday-${me.today}`} />}
      <PageHead title="Life" sub={age ? `${age.years} years · ${age.isBirthday ? 'happy birthday' : `${age.daysToNext} days to your ${ordinal(age.years + 1)}`}` : 'Your money, your years'} icon="sprout" />

      {/* Who you are now */}
      {!age ? (
        <form action={setBirthdayAction} className={`${styles.card} ${styles.lifeHero}`}>
          <strong className={styles.cardTitle}>When is your birthday?</strong>
          <p className={styles.note}>Life plans with your age: what to have saved by each birthday, letters that open on your next one, and what saving now grows into by 25 and 30.</p>
          <div className={styles.row}>
            <input className={styles.input} type="date" name="birthday" max={me.today} required aria-label="Date of birth" style={{ flex: '0 1 220px' }} />
            <Submit className={styles.btn}>Save</Submit>
          </div>
        </form>
      ) : (
        <section className={`${styles.card} ${styles.lifeHero}`} data-birthday={age.isBirthday || undefined}>
          <span className={styles.lifeAge}>
            <b>{age.years}</b>
            <small>years</small>
          </span>
          <span>
            <strong className={styles.lifeTitle}>{age.isBirthday ? `Happy ${ordinal(age.years)} birthday, ${firstName}.` : `${firstName}, ${age.years} and ${age.daysSince} ${age.daysSince === 1 ? 'day' : 'days'}.`}</strong>
            <p className={styles.note}>
              {age.isBirthday
                ? totalSaved
                  ? `This year starts with ${m(totalSaved)} saved. Next birthday: ${longDate(age.next)}.`
                  : 'The best gift for future you: start saving today, even €5. The year starts now.'
                : firstDay
                  ? `Saving since ${short(firstDay)} · ${m(totalSaved)} so far · next birthday in ${age.daysToNext} days.`
                  : `${age.daysToNext} days to your ${ordinal(age.years + 1)} birthday. Start saving today and arrive there with something.`}
            </p>
          </span>
        </section>
      )}

      {/* Start today */}
      <div className={styles.split2}>
        <section className={styles.card} aria-label="Save today">
          <div className={styles.cardHead}>
            <span>
              <strong className={styles.cardTitle}>
                <I d="jar" size={16} /> Save today
              </strong>
              <span className={styles.cardSub} style={{ display: 'block' }}>
                Move it to your savings account in your bank, then tell Pursecast here.
              </span>
            </span>
          </div>
          <div className={styles.lifeStats}>
            <span>
              <small>Safe to save now</small>
              <b className={styles.pos}>{m(safe)}</b>
              <em>{safe ? 'without a storm in the next 30 days' : 'the next 30 days are tight; start with €1'}</em>
            </span>
            <span>
              <small>Saved so far</small>
              <b>{m(totalSaved)}</b>
              <em>{ins.length ? `${ins.length} ${ins.length === 1 ? 'time' : 'times'}` : 'day one starts with the first euro'}</em>
            </span>
            <span>
              <small>Streak</small>
              <b>
                {streak} {streak === 1 ? 'week' : 'weeks'}
              </b>
              <em>{streak ? 'in a row with something saved' : 'save once this week to start it'}</em>
            </span>
          </div>
          <form action={saveAction} className={styles.lifeSave}>
            <MoneyInput name="amount" currency={cur} placeholder={safe ? String(Math.min(safe, 2000) / 100) : '5'} label="Amount saved" required />
            <select key={goals.map((g) => g.id).join()} name="goalId" className={styles.select} defaultValue={goals.find((g) => !g.doneAt)?.id ?? ''} aria-label="Towards">
              <option value="">No goal, just saving</option>
              {goals
                .filter((g) => !g.doneAt)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
            </select>
            <Submit className={styles.btn}>
              <I d="plus" size={14} stroke={2.6} /> I saved it
            </Submit>
          </form>
          {goals.some((g) => savedFor(g.id) > 0) && (
            <details className={styles.more}>
              <summary>A rainy day came: take money out of a pocket</summary>
              <form action={saveAction} className={styles.lifeSave}>
                <input type="hidden" name="direction" value="out" />
                <MoneyInput name="amount" currency={cur} placeholder="20" label="Amount taken out" required />
                <select name="goalId" className={styles.select} defaultValue={goals.find((g) => g.kind === 'rainy')?.id ?? goals.find((g) => savedFor(g.id) > 0)?.id} aria-label="From">
                  {goals
                    .filter((g) => savedFor(g.id) > 0)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} · {exact(savedFor(g.id), cur)}
                      </option>
                    ))}
                </select>
                <Submit className={styles.btnGhost}>Take out</Submit>
              </form>
            </details>
          )}
          {deposits.slice(0, 4).map((d) => (
            <div key={d.id} className={styles.bill}>
              <span>
                <b>{d.note || goals.find((g) => g.id === d.goalId)?.name || 'Saved'}</b>
                <small>{short(d.date)}</small>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <b className={d.amount > 0 ? styles.pos : undefined}>{exact(d.amount, cur, { sign: d.amount > 0 })}</b>
                <form action={deleteSavingAction}>
                  <input type="hidden" name="id" value={d.id} />
                  <ConfirmX label="Remove this saving" />
                </form>
              </span>
            </div>
          ))}
        </section>

        {/* Goals */}
        <section className={styles.card} aria-label="Goals">
          <div className={styles.cardHead}>
            <strong className={styles.cardTitle}>
              <I d="trend" size={16} /> Pockets and goals
            </strong>
          </div>
          {goals.length === 0 && <p className={styles.note}>Pockets for your savings. Start small: a rainy day pocket first, then an emergency fund, then a sum by your next birthday.</p>}
          {goals.map((g) => {
            const saved = savedFor(g.id);
            const pct = Math.min(100, Math.round((saved / g.target) * 100));
            const pace = weeklyPace(g.target - saved, me.today, g.byDate);
            return (
              <div key={g.id} className={styles.goalRow} data-done={Boolean(g.doneAt) || undefined}>
                <span className={styles.goalTop}>
                  <b>{g.name}</b>
                  <span>
                    {exact(saved, cur)} <small>of {exact(g.target, cur)}</small>
                  </span>
                  <form action={deleteGoalAction}>
                    <input type="hidden" name="id" value={g.id} />
                    <ConfirmX label={`Remove ${g.name}`} icon="trash" />
                  </form>
                </span>
                <span className={styles.meter}>
                  <span style={{ width: `${pct}%`, background: g.doneAt ? 'var(--pos)' : undefined }} />
                </span>
                <small className={styles.cardSub}>
                  {g.doneAt ? 'Reached' : pace ? `${exact(pace, cur)} a week reaches it by ${short(g.byDate!)}` : `${pct}% there`}
                  {g.kind === 'emergency' && !g.doneAt ? ' · for big surprises: losing a job, a dentist, moving' : ''}
                  {g.kind === 'rainy' ? ' · for small surprises; take from it when needed' : ''}
                </small>
              </div>
            );
          })}
          {!hasRainy && (
            <form action={addGoalAction} className={styles.goalSuggest}>
              <input type="hidden" name="name" value="Rainy day pocket" />
              <input type="hidden" name="kind" value="rainy" />
              <input type="hidden" name="target" value={(rainy / 100).toFixed(2)} />
              <span>
                <b>Rainy day pocket · {m(rainy)}</b>
                <small>A month of everyday spending for small surprises: a broken charger, a fine, a forgotten gift. Use it, then fill it again.</small>
              </span>
              <Submit className={`${styles.btnGhost} ${styles.btnSmall}`}>Add</Submit>
            </form>
          )}
          {!hasEmergency && (
            <form action={addGoalAction} className={styles.goalSuggest}>
              <input type="hidden" name="name" value="Emergency fund" />
              <input type="hidden" name="kind" value="emergency" />
              <input type="hidden" name="target" value={(emergency / 100).toFixed(2)} />
              <span>
                <b>Emergency fund · {m(emergency)}</b>
                <small>Three months of what you spend. The first goal of everyone who is good with money.</small>
              </span>
              <Submit className={`${styles.btnGhost} ${styles.btnSmall}`}>Add</Submit>
            </form>
          )}
          {nextBirthday && !hasBirthdayGoal && (
            <form action={addGoalAction} className={styles.goalSuggest}>
              <input type="hidden" name="name" value={`By my ${ordinal((age?.years ?? 0) + 1)} birthday`} />
              <input type="hidden" name="kind" value="birthday" />
              <input type="hidden" name="byDate" value={nextBirthday} />
              <span>
                <b>By your {ordinal((age?.years ?? 0) + 1)} birthday</b>
                <small>Pick a sum; Pursecast shows what to put aside each week until {short(nextBirthday)}.</small>
              </span>
              <MoneyInput name="target" currency={cur} placeholder="1000" label="Target" required />
              <Submit className={`${styles.btnGhost} ${styles.btnSmall}`}>Add</Submit>
            </form>
          )}
          <details className={styles.more}>
            <summary>
              <I d="plus" size={14} stroke={2.6} /> Your own goal
            </summary>
            <form action={addGoalAction} className={styles.form}>
              <input className={styles.input} name="name" placeholder="A laptop, a trip, moving out" maxLength={60} required aria-label="Goal" />
              <div className={styles.row}>
                <MoneyInput name="target" currency={cur} placeholder="1500" label="Target" required />
                <input className={styles.input} type="date" name="byDate" min={me.today} aria-label="By (optional)" title="By (optional)" />
              </div>
              <Submit className={styles.btn}>Add goal</Submit>
            </form>
          </details>
        </section>
      </div>

      {/* Future you */}
      <section className={styles.card} aria-label="Future you">
        <div className={styles.cardHead}>
          <span>
            <strong className={styles.cardTitle}>
              <I d="sun" size={16} /> Future you
            </strong>
            <span className={styles.cardSub} style={{ display: 'block' }}>
              Saving {m(monthly)} a month{last30 ? ', your pace this month' : ''}. Time does most of the work.
            </span>
          </span>
        </div>
        <div className={styles.futureGrid}>
          {(age ? [20, 25, 30, 40].filter((a) => a > age.years) : [1, 5, 10, 20]).map((at) => {
            const years = age ? at - age.years - age.daysSince / 365 : at;
            return (
              <span key={at} className={styles.futureCell}>
                <small>{age ? `At ${at}` : `In ${at} ${at === 1 ? 'year' : 'years'}`}</small>
                <b>{m(grows(monthly, years, 0.04, totalSaved))}</b>
                <em>{m(grows(monthly, years, 0, totalSaved))} in a plain savings account</em>
              </span>
            );
          })}
        </div>
        <p className={styles.note}>The bold figure assumes a careful 4% a year, about what a broad index fund has averaged after inflation over long periods. It is a picture, not a promise or advice; past returns can differ from future ones.</p>
      </section>

      {/* What your money says */}
      <section className={styles.card} aria-label="What your money says">
        <div className={styles.cardHead}>
          <span>
            <strong className={styles.cardTitle}>
              <I d="bulb" size={16} /> What your money says
            </strong>
            <span className={styles.cardSub} style={{ display: 'block' }}>
              The last 3 months{habits.hourly ? `, and what it costs in hours of your life (about ${exact(habits.hourly, cur)} an hour)` : ''}.
            </span>
          </span>
        </div>
        {habits.outPerMonth === 0 && habits.inPerMonth === 0 ? (
          <p className={styles.note}>Nothing logged in the last 3 months yet. Connect your bank or log spending, and this fills in by itself.</p>
        ) : (
          <>
            <div className={styles.lifeStats}>
              <span>
                <small>Comes in a month</small>
                <b className={styles.pos}>{m(habits.inPerMonth)}</b>
              </span>
              <span>
                <small>Goes out a month</small>
                <b>{m(habits.outPerMonth)}</b>
              </span>
              <span>
                <small>You keep</small>
                <b className={habits.keptRate !== null && habits.keptRate < 0 ? styles.neg : styles.pos}>{habits.keptRate === null ? '–' : `${Math.round(habits.keptRate * 100)}%`}</b>
                <em>{habits.keptRate === null ? 'no income logged' : habits.keptRate >= 0.2 ? 'great: 20% or more' : habits.keptRate >= 0.1 ? 'good start; 20% is the classic aim' : 'aim for 10%, then 20%'}</em>
              </span>
            </div>
            {habits.top.map((t) => (
              <div key={t.name} className={styles.goalRow}>
                <span className={styles.goalTop}>
                  <b>{t.name}</b>
                  <span>
                    {m(t.perMonth)} <small>a month{hours(t.perMonth) !== null ? ` · ${hours(t.perMonth)} h of work` : ''}</small>
                  </span>
                </span>
                <span className={styles.meter}>
                  <span style={{ width: `${Math.round(t.share * 100)}%` }} />
                </span>
              </div>
            ))}
            <ul className={styles.insights}>
              {habits.eatingOutPerMonth > 0 && (
                <li>
                  Eating out, takeaway and coffee: {m(habits.eatingOutPerMonth)} a month. Half of that saved instead is {m(grows(Math.round(habits.eatingOutPerMonth / 2), 10, 0.04))} in ten years.
                </li>
              )}
              {habits.subscriptionsPerYear > 0 && <li>Subscriptions cost {m(habits.subscriptionsPerYear)} a year. Cancel one you forgot, and save its price every month.</li>}
              <li>€5 a day not spent is {m(grows(15200, age ? Math.max(1, 30 - age.years) : 10, 0.04))} {age ? 'by 30' : 'in ten years'}.</li>
              <li>Pay yourself first: on payday, move the savings before anything else. What is left is what you spend.</li>
            </ul>
          </>
        )}
      </section>

      {/* Time capsule */}
      <section id="capsule" className={styles.card} aria-label="Time capsule" style={{ scrollMarginTop: 80 }}>
        <div className={styles.cardHead}>
          <span>
            <strong className={styles.cardTitle}>
              <I d="cal" size={16} /> Time capsule
            </strong>
            <span className={styles.cardSub} style={{ display: 'block' }}>
              A letter to future you, sealed until the day you choose. It opens here, and Pursecast reminds you.
            </span>
          </span>
        </div>
        {capsules.map((c) =>
          c.openOn > me.today ? (
            <div key={c.id} className={styles.capsule} data-sealed>
              <I d="file" size={18} />
              <span>
                <b>Sealed letter</b>
                <small>
                  Written {short(c.writtenOn)} · opens {longDate(c.openOn)} · in {diffDays(me.today, c.openOn)} days
                </small>
              </span>
            </div>
          ) : c.openedAt ? (
            <div key={c.id} className={styles.capsule}>
              <span>
                <small>
                  From you on {longDate(c.writtenOn)}
                </small>
                <p className={styles.capsuleText}>{c.text}</p>
              </span>
            </div>
          ) : (
            <form key={c.id} action={openCapsuleAction} className={styles.capsule} data-ready>
              <input type="hidden" name="id" value={c.id} />
              <I d="file" size={18} />
              <span>
                <b>A letter from {short(c.writtenOn)} is ready</b>
                <small>You wrote it {Math.round(diffDays(c.writtenOn, me.today) / 30.44)} months ago.</small>
              </span>
              <Submit className={styles.btn}>Open</Submit>
            </form>
          ),
        )}
        <form action={writeCapsuleAction} className={styles.form}>
          <textarea className={styles.input} name="text" rows={4} maxLength={4000} required placeholder={age ? `Dear ${firstName} at ${age.years + 1}: today I am ${age.years}. I want to have saved… I hope you…` : 'Dear future me: today I want…'} aria-label="Your letter" />
          <div className={styles.row}>
            <label className={styles.field} style={{ flex: '0 1 220px' }}>
              Opens on
              <input className={styles.input} type="date" name="openOn" min={me.today} defaultValue={nextBirthday ?? addMonths(me.today, 12)} required />
            </label>
            <Submit className={styles.btn} pending="Sealing…">
              Seal the letter
            </Submit>
          </div>
        </form>
      </section>
    </>
  );
}
