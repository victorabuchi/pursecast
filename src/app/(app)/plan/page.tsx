import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '../../../components/app/app.module.css';
import I from '../../../components/app/Icon';
import PageHead from '../../../components/app/PageHead';
import Submit from '../../../components/app/Submit';
import { MoneyInput } from '../../../components/app/Fields';
import { CloseButton, SheetButton, UrlSheet } from '../../../components/app/Sheet';
import { loadMoney, type EventRow } from '../../../lib/money/load';
import WantToBuy from './WantToBuy';
import MoneyLands from './MoneyLands';
import { jarAccrued, saveSuggestion } from '../../../lib/money/forecast';
import { monthLabel, monthName, monthOf, short, todayIn } from '../../../lib/money/dates';
import { money } from '../../../lib/money/format';
import { personalInflation } from '../../../lib/money/inflation';
import { TAGS, planWindow } from '../../../lib/money/plan';
import { hideEventAction, saveEventAction, startSavingAction, stopSavingAction } from '../../../lib/money/actions';
import { connectCalendarAction, disconnectCalendarAction, syncCalendarAction } from '../../../lib/money/account-actions';

export const metadata: Metadata = { title: 'Plan ahead', robots: { index: false } };

// Optional: the national rate to compare with, e.g. NATIONAL_INFLATION="3.1".
const NATIONAL = Number(process.env['NATIONAL_INFLATION'] ?? '');

export default async function PlanPage({ searchParams }: PageProps<'/plan'>) {
  const params = await searchParams;
  // A year ahead, so Want to buy can find the first day each thing fits.
  const { me, events, entries, cats, forecast, recurring } = await loadMoney(366);
  const cur = me.currency;
  const m = (n: number) => money(n, cur);
  const { to } = planWindow(me.today);
  const upcoming = events.filter((e) => !e.hidden && e.date > me.today && e.date <= to);
  const jars = events.filter((e) => !e.hidden && e.saveMonthly && e.date > me.today);
  const monthly = jars.reduce((s, e) => s + e.saveMonthly!, 0);
  const fc = (e: EventRow) => ({ id: e.id, name: e.name, date: e.date, cost: e.cost, saveMonthly: e.saveMonthly, saveFrom: e.saveFrom, source: e.source });
  const justRead = String(params['toast'] ?? '').startsWith('Calendar');

  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const inflation = personalInflation(
    entries.map((e) => ({ date: e.date, amount: e.amount, note: e.note, category: e.categoryId ? (catName.get(e.categoryId) ?? 'Other') : 'Other' })),
    me.today,
  );

  const open = typeof params['event'] === 'string' ? events.find((e) => e.id === params['event']) : undefined;
  const editing = Boolean(open && params['edit']);

  const calendarSheet = (
    <>
      <ol className={styles.note} style={{ paddingLeft: 18, margin: 0, lineHeight: 1.7 }}>
        <li>Open Google Calendar on a computer, then Settings.</li>
        <li>Pick your calendar under “Settings for my calendars”, then “Integrate calendar”.</li>
        <li>Copy the “Secret address in iCal format” and paste it here.</li>
      </ol>
      <form action={connectCalendarAction} className={styles.form}>
        <input className={styles.input} name="url" type="url" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" required autoFocus aria-label="Secret iCal address" />
        <p className={styles.note}>Pursecast only reads events. It keeps ones that cost money, like weddings, trips, birthdays and appointments, and prices them. Outlook and Apple calendars work the same way.</p>
        <div className={styles.sheetActions}>
          <CloseButton className={styles.btnGhost}>Cancel</CloseButton>
          <Submit className={styles.btn} pending="Reading the next 6 months…">
            Connect
          </Submit>
        </div>
      </form>
    </>
  );

  return (
    <>
      <PageHead
        title="Plan ahead"
        sub={me.calendarUrl ? 'Connected to your calendar' : 'Costs before they happen'}
        icon="cal"
        right={
          <>
            {me.calendarUrl ? (
              <form action={syncCalendarAction}>
                <Submit className={styles.pill} pending={<>Reading the next 6 months…</>}>
                  <I d="cal" size={14} /> Google Calendar · read again
                </Submit>
              </form>
            ) : (
              <SheetButton className={styles.pill} initiallyOpen={Boolean(params['calendar'])} label={<><I d="link" size={14} /> Connect calendar</>} title="Connect your calendar" sub="Plan ahead reads the next 6 months." wide>
                {calendarSheet}
              </SheetButton>
            )}
            <Link href="/plan?new=1" scroll={false} className={`${styles.btn} ${styles.btnSmall}`}>
              <I d="plus" size={14} stroke={2.6} /> Add a cost
            </Link>
          </>
        }
      />
      <div className={styles.split}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <strong className={styles.cardTitle}>{me.calendarUrl ? 'Costs on your calendar' : 'Costs coming up'}</strong>
            <span className={styles.cardSub}>Next 6 months</span>
          </div>
          {justRead && (
            <div className={styles.scan}>
              <i />
              <small>Reading the next 6 months…</small>
            </div>
          )}
          {upcoming.length === 0 && (
            <div className={styles.empty}>
              <b>Nothing planned yet.</b>
              {me.calendarUrl ? 'No events that cost money in the next 6 months. Add one yourself, or read the calendar again after adding events.' : 'Connect your calendar and Pursecast finds weddings, trips and birthdays, prices them and helps you save before they arrive. Or add a cost yourself.'}
            </div>
          )}
          {upcoming.map((e, i) => {
            const saving = Boolean(e.saveMonthly);
            return (
              <Link key={e.id} href={`/plan?event=${e.id}`} scroll={false} className={styles.event} data-on={saving || undefined} style={{ color: 'inherit', textDecoration: 'none' }}>
                <span className={styles.date}>
                  <b>{Number(e.date.slice(8, 10))}</b>
                  <small>{monthName(monthOf(e.date))}</small>
                </span>
                <span>
                  <b>{e.name}</b>
                  <small>
                    {saving ? `${m(e.saveMonthly!)} / month set aside` : e.tag}
                    {e.source === 'calendar' ? ' · calendar' : ''}
                  </small>
                </span>
                <em className={styles.chip} style={justRead ? { animationDelay: `${1.5 + i * 0.28}s` } : undefined}>
                  ~{m(e.cost)}
                </em>
              </Link>
            );
          })}
          {me.calendarUrl && (
            <form action={disconnectCalendarAction}>
              <button type="submit" className={styles.linkBtn} style={{ color: 'var(--muted)', fontWeight: 600, fontSize: 13 }}>
                Disconnect calendar
                {me.calendarAt ? ` · last read ${short(todayIn(me.timezone, new Date(me.calendarAt)))}` : ''}
              </button>
            </form>
          )}
        </div>

        <div className={styles.stack}>
          <div className={styles.card}>
            <strong className={styles.cardTitle}>Set aside each month</strong>
            <strong className={styles.bigNum}>{m(monthly)}</strong>
            {jars.length === 0 && <p className={styles.note}>Open a cost and tap Start saving to pay for it a little each month.</p>}
            {jars.map((e, i) => {
              const pctSaved = Math.round((jarAccrued(fc(e), me.today) / e.cost) * 100);
              return (
                <div key={e.id} className={styles.goal}>
                  <span>
                    <I d="jar" size={15} /> {e.name} <b>{pctSaved}%</b>
                  </span>
                  <div className={styles.meter}>
                    <span style={{ width: `${pctSaved}%`, background: i % 2 ? 'var(--b)' : 'var(--sun)' }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className={`${styles.card} ${styles.infl}`}>
            <span className={styles.pageIcon} style={{ width: 42, height: 42 }}>
              <I d="trend" size={20} />
            </span>
            <span>
              <small>Your personal inflation</small>
              {inflation.rate !== null ? (
                <>
                  <b>
                    {inflation.rate.toFixed(1)}% {Number.isFinite(NATIONAL) && NATIONAL > 0 && <em>vs {NATIONAL.toFixed(1)}% national</em>}
                  </b>
                  <small>
                    From {inflation.items} things you buy again and again
                    {inflation.drivers.length ? `. ${inflation.drivers.join(' and ')} drove it.` : '.'}
                  </small>
                </>
              ) : (
                <>
                  <b style={{ fontSize: 16 }}>Measuring…</b>
                  <small>Needs the same purchases a year apart. {inflation.items} found so far.</small>
                </>
              )}
            </span>
          </div>
        </div>
      </div>

      <MoneyLands me={me} recurring={recurring} />

      <WantToBuy me={me} fc={forecast} events={events} openNew={Boolean(params['wish'])} />

      {open && !editing && <EventSheet event={open} currency={cur} today={me.today} fc={fc(open)} />}
      {open && editing && (
        <UrlSheet title={`Edit ${open.name}`} drop={['event', 'edit']} wide>
          <EventForm event={open} currency={cur} today={me.today} />
        </UrlSheet>
      )}
      {params['new'] && (
        <UrlSheet title="Add a cost" sub="Leave the prices empty and Pursecast estimates them from the name." drop={['new']} wide>
          <EventForm currency={cur} today={me.today} />
        </UrlSheet>
      )}
    </>
  );
}

function EventSheet({ event: e, currency, today, fc }: { event: EventRow; currency: string; today: string; fc: Parameters<typeof jarAccrued>[0] }) {
  const m = (n: number) => money(n, currency);
  const s = saveSuggestion(e.cost, today, e.date);
  const saved = jarAccrued(fc, today);
  return (
    <UrlSheet title={`${e.name} · ${short(e.date)}`} sub={`${e.tag}${e.source === 'calendar' ? ' · from your calendar' : ''}`} drop={['event']}>
      <div className={styles.details}>
        {e.items.map((i) => (
          <span key={i.id}>
            {i.name} <b>{m(i.amount)}</b>
          </span>
        ))}
        <span style={{ borderTop: '1px solid rgba(15,122,99,0.2)', paddingTop: 8 }}>
          In total <b>~{m(e.cost)}</b>
        </span>
      </div>
      {e.saveMonthly ? (
        <>
          <div className={styles.suggest}>
            <I d="jar" size={18} />
            <span>
              Setting aside <b>{m(e.saveMonthly)} a month</b>. {m(saved)} saved so far ({Math.round((saved / e.cost) * 100)}%).
            </span>
          </div>
          <form action={stopSavingAction} className={styles.sheetActions}>
            <input type="hidden" name="id" value={e.id} />
            <Link href={`/plan?event=${e.id}&edit=1`} scroll={false} className={styles.btnGhost}>
              Edit
            </Link>
            <Submit className={styles.btnGhost}>Stop saving</Submit>
          </form>
        </>
      ) : (
        <>
          <div className={styles.suggest}>
            <I d="jar" size={18} />
            <span>
              Put aside <b>{m(s.monthly)} a month</b> {s.months > 1 ? `until ${monthLabel(monthOf(e.date), today)}` : 'this month'} and it&apos;s paid before {e.tag === 'Travel' || e.tag === 'Wedding' ? 'you pack' : 'it arrives'}.
            </span>
          </div>
          <form action={startSavingAction} className={styles.sheetActions}>
            <input type="hidden" name="id" value={e.id} />
            <input type="hidden" name="monthly" value={String(s.monthly / 100)} />
            <Link href={`/plan?event=${e.id}&edit=1`} scroll={false} className={styles.btnGhost}>
              Edit
            </Link>
            <Submit className={styles.btn} pending="Starting…">
              Start saving
            </Submit>
          </form>
        </>
      )}
      <form action={hideEventAction}>
        <input type="hidden" name="id" value={e.id} />
        <button type="submit" className={styles.linkBtn} style={{ color: 'var(--muted)', fontWeight: 600, fontSize: 13 }}>
          This won&apos;t cost me anything · remove
        </button>
      </form>
    </UrlSheet>
  );
}

function EventForm({ event, currency, today }: { event?: EventRow; currency: string; today: string }) {
  const rows = [...(event?.items ?? []), ...Array.from({ length: Math.max(1, 5 - (event?.items.length ?? 0)) }, () => null)];
  return (
    <form action={saveEventAction} className={styles.form}>
      {event && <input type="hidden" name="id" value={event.id} />}
      <label className={styles.field}>
        What is it
        <input className={styles.input} name="name" defaultValue={event?.name} placeholder="Anna & Jon's wedding" required autoFocus={!event} maxLength={120} />
      </label>
      <div className={styles.row}>
        <label className={styles.field}>
          Date
          <input className={styles.input} type="date" name="date" defaultValue={event?.date} min={today} required />
        </label>
        <label className={styles.field}>
          Kind
          <select name="tag" className={styles.select} defaultValue={event?.tag ?? 'Other'}>
            {TAGS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        {!event && (
          <label className={styles.field}>
            Where <small>optional, adds travel</small>
            <input className={styles.input} name="location" placeholder="Porto" />
          </label>
        )}
      </div>
      <div className={styles.field}>
        What it will cost
        {rows.map((r, i) => (
          <div key={r?.id ?? `new${i}`} className={styles.row}>
            <input className={styles.input} name={`itemName${i}`} defaultValue={r?.name} placeholder={['Flights', 'Hotel', 'Outfit', 'Gift', 'Other'][i]} aria-label={`Cost ${i + 1}`} />
            <MoneyInput name={`itemAmount${i}`} currency={currency} value={r?.amount ?? null} label={`Cost ${i + 1} amount`} />
          </div>
        ))}
      </div>
      <div className={styles.sheetActions}>
        <CloseButton className={styles.btnGhost}>Cancel</CloseButton>
        <Submit className={styles.btn}>{event ? 'Save' : 'Add to plan'}</Submit>
      </div>
    </form>
  );
}
