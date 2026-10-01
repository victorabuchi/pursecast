import { AnimatePresence, motion } from 'motion/react';
import styles from './film.module.css';
import Mark from '../../Mark';
import MoodIcon from '../../app/MoodIcon';

// The scenes of the landing page film. Each one is a pure function of the
// scene clock t (milliseconds), so pausing, seeking and reduced motion are free.

export type SceneProps = { t: number; phone: boolean; brand: string };
// [at ms, data-target the cursor rests on (null hides it), press length ms]
export type Beat = [number, string | null, number?];

export const BRAND = '#0f7a63';
const SUN = '#f5a524';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const within = (t: number, a: number, b: number) => t >= a && t < b;
const prog = (t: number, a: number, b: number) => ease((t - a) / (b - a));
// Text typed out between two times, one character at a time.
const typed = (text: string, t: number, from: number, to: number) => text.slice(0, Math.floor(clamp01((t - from) / (to - from)) * text.length));
const eur = (n: number) => `${n < 0 ? '−' : ''}€${Math.abs(Math.round(n)).toLocaleString('en-US')}`;

const P = {
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41',
  partly: 'M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41M15.95 12.65a4 4 0 0 0-5.93-4.61M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z',
  cloud: 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z',
  storm: 'M6 16.33A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24M13 11l-4 6h6l-4 6',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  heart: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z',
  fork: 'M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM18 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM12 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9M12 12v3',
  cal: 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  check: 'M20 6 9 17l-5-5',
  plus: 'M12 5v14M5 12h14',
  bulb: 'M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Z',
  trend: 'M22 7l-8.5 8.5-5-5L2 17M16 7h6v6',
  jar: 'M19 10c.6-.4 1-1 1-1.8M5 11a7 7 0 0 1 7-5h2a6 6 0 0 1 5.6 4H21v4h-1.6a6 6 0 0 1-1.9 2.4V19h-3v-1.5h-4V19H7.5v-2.3A6 6 0 0 1 5 12ZM15.5 11h.01M9.5 6.3V4.5a1.5 1.5 0 0 1 2.2-1.3',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  file: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9ZM14 3v6h6M8 13h8M8 17h5',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  mic: 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM19 10v2a7 7 0 0 1-14 0v-2M12 19v3',
  play: 'M7 4l13 8-13 8Z',
  cart: 'M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L21 8H6.2M10 20.5h.01M17 20.5h.01',
  wallet: 'M20 12V8H6a2 2 0 0 1 0-4h12v4M4 6v12a2 2 0 0 0 2 2h14v-4M18 12a2 2 0 0 0 0 4h4v-4Z',
};

function I({ d, size = 16, stroke = 2 }: { d: string; size?: number; stroke?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const NAV: Array<[keyof typeof P, string]> = [
  ['sun', 'Forecast'],
  ['list', 'Spending'],
  ['heart', 'Worth-It'],
  ['fork', 'Forks'],
  ['cal', 'Plan'],
  ['file', 'Statements'],
];

// The Pursecast app shell: top bar, icon rail (desktop) or tab bar (phone).
function AppFrame({ phone, active, brand, bell, children }: { phone: boolean; active: number; brand: string; bell?: 'idle' | 'ring'; children: React.ReactNode }) {
  return (
    <div className={styles.app} style={{ ['--b' as string]: brand }} data-phone={phone || undefined}>
      <header className={styles.top}>
        <span className={styles.mark}>
          <Mark />
        </span>
        <span className={styles.slash}>/</span>
        <span className={styles.orgName}>Personal</span>
        <span className={styles.topRight}>
          {bell && (
            <span className={`${styles.iconBtn} ${bell === 'ring' ? styles.bellRing : ''}`}>
              <I d={P.bell} />
              {bell === 'ring' && <i className={styles.bellDot} />}
            </span>
          )}
          {phone ? (
            <span className={styles.iconBtn}>
              <I d={P.search} />
            </span>
          ) : (
            <span className={styles.search}>
              <I d={P.search} size={14} />
              Search
              <kbd>⌘K</kbd>
            </span>
          )}
          <span className={styles.avatar}>AL</span>
        </span>
      </header>
      <div className={styles.body}>
        {!phone && (
          <nav className={styles.rail}>
            {NAV.map(([icon], i) => (
              <span key={icon} className={styles.railItem} data-active={i === active}>
                <I d={P[icon]} size={18} />
              </span>
            ))}
          </nav>
        )}
        <main className={styles.main}>{children}</main>
      </div>
      {phone && (
        <nav className={styles.tabs}>
          {NAV.map(([icon, label], i) => (
            <span key={icon} className={styles.tabItem} data-active={i === active}>
              <I d={P[icon]} size={18} />
              <small>{label}</small>
            </span>
          ))}
        </nav>
      )}
    </div>
  );
}

function Toast({ show, text }: { show: boolean; text: string }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key={text}
          className={styles.toast}
          initial={{ opacity: 0, y: 18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
        >
          <span className={styles.toastOk}>
            <I d={P.check} size={12} stroke={3} />
          </span>
          {text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Sheet({ phone, open, title, children }: { phone: boolean; open: boolean; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className={styles.backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <motion.div
            className={phone ? styles.sheetPhone : styles.sheet}
            initial={phone ? { y: '100%' } : { opacity: 0, y: 24, scale: 0.97 }}
            animate={phone ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={phone ? { y: '100%' } : { opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          >
            {phone && <span className={styles.grabber} />}
            <div className={styles.sheetHead}>
              <strong>{title}</strong>
              <span className={styles.x}>×</span>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PageHead({ title, sub, icon, right }: { title: string; sub: string; icon: keyof typeof P; right?: React.ReactNode }) {
  return (
    <div className={styles.pageHead}>
      <span className={styles.pageIcon}>
        <I d={P[icon]} size={20} />
      </span>
      <div>
        <h3>{title}</h3>
        <small>{sub}</small>
      </div>
      {right && <span className={styles.headRight}>{right}</span>}
    </div>
  );
}

// Line charts are drawn in a 600 x 200 box stretched to fit; dots and labels
// are HTML placed by percentage so they stay round and sharp.
const VB = { w: 600, h: 200 };
type Pt = [number, number];
const toPts = (values: number[], min: number, max: number, from = 0, n = values.length + from): Pt[] =>
  values.map((v, i) => [((i + from) / (n - 1)) * VB.w, VB.h - ((v - min) / (max - min)) * VB.h]);
function smooth(p: Pt[]): string {
  if (p.length < 2) return '';
  let d = `M${p[0]![0]},${p[0]![1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i - 1] ?? p[i]!;
    const b = p[i]!;
    const c = p[i + 1]!;
    const e = p[i + 2] ?? c;
    d += ` C${b[0] + (c[0] - a[0]) / 6},${b[1] + (c[1] - a[1]) / 6} ${c[0] - (e[0] - b[0]) / 6},${c[1] - (e[1] - b[1]) / 6} ${c[0]},${c[1]}`;
  }
  return d;
}
const pct = (p: Pt) => ({ left: `${(p[0] / VB.w) * 100}%`, top: `${(p[1] / VB.h) * 100}%` });

// A small weather icon inside a sentence, in the sky's own colour.
function SkyMark({ sky }: { sky: 'sun' | 'cloud' | 'storm' }) {
  return (
    <span className={styles.skyInline} data-sky={sky} aria-hidden="true">
      <I d={P[sky]} size={13} stroke={2.2} />
    </span>
  );
}

/* ---------- 1. Money Weather ---------- */

type Sky = 'sun' | 'partly' | 'cloud' | 'storm';
const WEEKS: Array<{ label: string; low: number; sky: Sky }> = [
  { label: 'Sep 29', low: 2340, sky: 'sun' },
  { label: 'Oct 6', low: 2070, sky: 'sun' },
  { label: 'Oct 13', low: 1880, sky: 'sun' },
  { label: 'Oct 20', low: 1610, sky: 'partly' },
  { label: 'Oct 27', low: 1336, sky: 'partly' },
  { label: 'Nov 3', low: -86, sky: 'storm' },
  { label: 'Nov 10', low: 2680, sky: 'sun' },
  { label: 'Nov 17', low: 2410, sky: 'sun' },
  { label: 'Nov 24', low: 2150, sky: 'sun' },
  { label: 'Dec 1', low: 1210, sky: 'partly' },
  { label: 'Dec 8', low: 3620, sky: 'sun' },
  { label: 'Dec 15', low: 3180, sky: 'sun' },
  { label: 'Dec 22', low: 2450, sky: 'partly' },
];
const STORM = 5;
const FIX = 150;
const FIXED_AT = 5900;

function WeatherScene({ t, phone, brand }: SceneProps) {
  const fixed = prog(t, FIXED_AT, FIXED_AT + 900);
  const weeks = WEEKS.map((w, i) => {
    const low = i >= STORM ? w.low + FIX * fixed : w.low;
    const sky: Sky = i === STORM && t >= FIXED_AT ? 'cloud' : w.sky;
    return { ...w, low, sky };
  });
  const shown = phone ? weeks.slice(2, 7) : weeks;
  const pts = toPts(
    weeks.map((w) => w.low),
    -600,
    4000,
  );
  const draw = prog(t, 200, 1800);
  const zeroY = pct([0, VB.h - (600 / 4600) * VB.h]).top;
  const low = weeks[STORM]!.low;
  return (
    <AppFrame phone={phone} active={0} brand={brand}>
      <PageHead title="Money Weather" sub="Next 90 days" icon="sun" right={!phone && <b className={styles.pill}>Cushion €0</b>} />
      <div className={phone ? styles.stack : styles.split}>
        <div className={styles.stack}>
          <div className={`${styles.card} ${styles.today}`}>
            <div>
              <small>Balance today</small>
              <strong className={styles.bigNum}>€2,340</strong>
            </div>
            <div className={styles.cond}>
              <span className={styles[`sky_${t >= FIXED_AT ? 'cloud' : 'storm'}`]}>
                <I d={t >= FIXED_AT ? P.cloud : P.storm} size={22} />
              </span>
              <span>
                <b>{t >= FIXED_AT ? 'Covered' : 'Storm ahead'}</b>
                <small>
                  Lowest point <span className={low < 0 ? styles.neg : styles.pos}>{eur(low)}</span> · Nov 7
                </small>
              </span>
            </div>
          </div>
          <div className={styles.strip} style={{ gridTemplateColumns: `repeat(${shown.length}, 1fr)` }}>
            {shown.map((w) => (
              <motion.div
                key={w.label}
                className={`${styles.wk} ${styles[`wk_${w.sky}`]}`}
                data-target={w.label === 'Nov 3' ? 'storm' : undefined}
                animate={w.label === 'Nov 3' && within(t, FIXED_AT, FIXED_AT + 700) ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                <small>{w.label}</small>
                <span className={styles[`sky_${w.sky}`]}>
                  <I d={P[w.sky]} size={phone ? 22 : 20} />
                </span>
                <b>{eur(w.low)}</b>
              </motion.div>
            ))}
          </div>
          <div className={`${styles.card} ${styles.chartCard}`}>
            <div className={styles.chart} style={{ height: phone ? 130 : 150 }}>
              <span className={styles.zero} style={{ top: zeroY }}>
                <em>€0</em>
              </span>
              <svg viewBox={`0 0 ${VB.w} ${VB.h}`} preserveAspectRatio="none" className={styles.chartSvg}>
                <clipPath id="weather-reveal">
                  <rect x={-10} y={-10} width={(VB.w + 20) * draw} height={VB.h + 20} />
                </clipPath>
                <path d={smooth(pts)} clipPath="url(#weather-reveal)" className={styles.lineMain} />
              </svg>
              {draw > 0.45 && (
                <i className={`${styles.dot} ${low < 0 ? styles.dotBad : styles.dotOk}`} style={pct(pts[STORM]!)}>
                  {low < 0 && <i className={styles.dotPing} />}
                </i>
              )}
            </div>
          </div>
        </div>
        {!phone && (
          <div className={styles.stack}>
            <div className={styles.tipCard}>
              {t >= FIXED_AT ? (
                <>
                  <b>
                    <SkyMark sky="cloud" /> Week of Nov 3 is tight but covered.
                  </b>{' '}
                  Sunny again from payday on Nov 10.
                </>
              ) : (
                <>
                  <b>
                    <SkyMark sky="sun" /> Sunny through Oct 31.
                  </b>{' '}
                  <SkyMark sky="storm" /> Storm warning for the week of Nov 3: rent, car insurance and Maya&apos;s birthday land together.
                </>
              )}
            </div>
            <div className={styles.card}>
              <strong className={styles.cardTitle}>Coming up</strong>
              {[
                ['Rent', 'Nov 3', -950],
                ['Car insurance', 'Nov 5', -412],
                ["Maya's birthday", 'Nov 7 · calendar', -60],
                ['Salary', 'Nov 10', 2900],
              ].map(([name, when, amount]) => (
                <div key={name as string} className={styles.bill}>
                  <span>
                    <b>{name}</b>
                    <small>{when}</small>
                  </span>
                  <b className={(amount as number) > 0 ? styles.pos : undefined}>{((amount as number) > 0 ? '+' : '') + eur(amount as number)}</b>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <Sheet phone={phone} open={within(t, 2700, 5700)} title={<span className={styles.skyTitle}><SkyMark sky="storm" /> Storm warning · Nov 3–9</span>}>
        <div className={styles.details}>
          <span>
            Rent <b>€950</b>
          </span>
          <span>
            Car insurance <b>€412</b>
          </span>
          <span>
            Maya&apos;s birthday <small>from your calendar</small> <b>€60</b>
          </span>
        </div>
        <p className={styles.note}>Your balance dips to −€86 on Nov 7, three days before payday.</p>
        <div className={styles.suggest}>
          <I d={P.bulb} size={16} />
          <span>
            Move <b>€150</b> from Fun money this month to cover it.
          </span>
        </div>
        <div className={styles.sheetActions}>
          <span className={styles.btnGhost}>Later</span>
          <span className={`${styles.btn} ${within(t, 5300, 5650) ? styles.pressed : ''}`} data-target="fix">
            Fix it
          </span>
        </div>
      </Sheet>
      <Toast show={within(t, 6000, 9000)} text="Storm cleared · lowest point now €64" />
    </AppFrame>
  );
}

/* ---------- 2. Worth-It Score ---------- */

type Mood = 'love' | 'meh' | 'regret';
const FACES: Array<[Mood, string]> = [
  ['love', 'Loved it'],
  ['meh', 'It was fine'],
  ['regret', 'Regret it'],
];
const BUYS: Array<{ name: string; where: string; amount: number; mood: Mood; at: number }> = [
  { name: 'Concert', where: 'Fri · Tavastia', amount: 64, mood: 'love', at: 1950 },
  { name: 'Thai takeaway', where: 'Sat · Wolt', amount: 38, mood: 'regret', at: 3350 },
  { name: 'Climbing gym', where: 'Sun · Boulderkeskus', amount: 16, mood: 'love', at: 4250 },
  { name: 'Streaming add-on', where: 'Mon · renewal', amount: 12, mood: 'regret', at: 5150 },
];
const MOVE_AT = 7300;

function WorthScene({ t, phone, brand }: SceneProps) {
  const moved = t >= MOVE_AT;
  const shift = prog(t, MOVE_AT, MOVE_AT + 800);
  const bars: Array<[string, number]> = [
    ['Concerts & live', 9.1 + (t >= 1950 ? 0.2 : 0)],
    ['Climbing', 8.2 + (t >= 4250 ? 0.3 : 0)],
    ['Coffee with friends', 7.2],
    ['Groceries', 5.0],
    ['Takeaway', 2.8 - (t >= 3350 ? 0.5 : 0)],
    ['Streaming', 2.1 - (t >= 5150 ? 0.4 : 0)],
  ];
  return (
    <AppFrame phone={phone} active={2} brand={brand} bell={within(t, 500, 2300) ? 'ring' : 'idle'}>
      <PageHead title="Worth-It" sub="Rated two days later" icon="heart" right={!phone && <b className={styles.pill}>Joy per euro</b>} />
      <div className={phone ? styles.stack : styles.split}>
        <div className={styles.stack}>
          <div className={styles.card}>
            <strong className={styles.cardTitle}>Was it worth it?</strong>
            {BUYS.map((b, i) => {
              const picked = t >= b.at ? b.mood : null;
              return (
                <div key={b.name} className={styles.buy}>
                  <span>
                    <b>{b.name}</b>
                    <small>{b.where}</small>
                  </span>
                  <b className={styles.amount}>{eur(b.amount)}</b>
                  <span className={styles.faces}>
                    {FACES.map(([mood]) => (
                      <motion.i
                        key={mood}
                        className={styles.face}
                        data-on={picked === mood || undefined}
                        data-dim={(picked && picked !== mood) || undefined}
                        data-target={mood === b.mood && i > 0 ? `r-${i}` : undefined}
                        animate={picked === mood ? { scale: [1, 1.35, 1] } : { scale: 1 }}
                        transition={{ duration: 0.35 }}
                      >
                        <MoodIcon mood={mood} size={18} />
                      </motion.i>
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
          <AnimatePresence>
            {t >= 5800 && (
              <motion.div className={`${styles.card} ${styles.advice}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }}>
                <span className={styles.adviceIcon}>
                  <I d={P.bulb} size={18} />
                </span>
                <div>
                  <b>Budget by value</b>
                  <p>You regretted takeaway 7 of your last 9 times. Move €40 a month to concerts and live music?</p>
                  <div className={styles.moves}>
                    <span>
                      Takeaway <s data-on={moved || undefined}>€120</s> {moved && <b>€{Math.round(120 - 40 * shift)}</b>}
                    </span>
                    <I d={P.arrow} size={14} />
                    <span>
                      Concerts <s data-on={moved || undefined}>€40</s> {moved && <b>€{Math.round(40 + 40 * shift)}</b>}
                    </span>
                  </div>
                </div>
                <span className={`${styles.btn} ${within(t, 6900, 7250) ? styles.pressed : ''} ${moved ? styles.btnDone : ''}`} data-target="move">
                  {moved ? 'Moved' : 'Move €40'}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {!phone && (
          <div className={styles.card}>
            <strong className={styles.cardTitle}>Joy per euro · 90 days</strong>
            {bars.map(([name, score]) => (
              <div key={name} className={styles.barRow}>
                <span>
                  {name}
                  <b>{score.toFixed(1)}</b>
                </span>
                <div className={styles.meter}>
                  <span style={{ width: `${score * 10}%`, background: score < 4 ? '#e5484d' : score < 6 ? '#f5a524' : undefined }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <AnimatePresence>
        {within(t, 500, 2300) && (
          <motion.div className={styles.notif} initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}>
            <span className={styles.notifIcon}>
              <Mark size={20} />
            </span>
            <div>
              <b>Was Friday&apos;s concert worth it?</b>
              <small>€64 · Tavastia · 2 days ago</small>
              <span className={styles.faces}>
                {FACES.map(([mood]) => (
                  <i key={mood} className={styles.face} data-on={(mood === 'love' && t >= 1950) || undefined} data-target={mood === 'love' ? 'n-love' : undefined}>
                    <MoodIcon mood={mood} size={18} />
                  </i>
                ))}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Toast show={within(t, 7500, 10200)} text="Budget moved toward what you love" />
    </AppFrame>
  );
}

/* ---------- 3. Timeline Forks ---------- */

const MONTHS = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const NOW = 3;
const REAL = [3200, 3650, 4100, 4480, 4970, 5460, 5950, 6440, 6930, 7420, 7910, 8400];
const FORK = REAL.slice(NOW).map((_, i) => 4480 + i * 880);
const WHAT_IF = 'Move to Austin';
const EFFECTS: Array<[string, string, boolean]> = [
  ['Salary', '+€780 / mo', true],
  ['Rent', '−€520 / mo', false],
  ['No car loan', '+€130 / mo', true],
];

function ForkScene({ t, phone, brand }: SceneProps) {
  const typed = WHAT_IF.slice(0, Math.floor(clamp01((t - 1800) / 1100) * WHAT_IF.length));
  const grow = prog(t, 4700, 6500);
  const live = t >= 8300 ? 46 : 0;
  const min = 2500;
  const max = 12500;
  const real = toPts(REAL, min, max);
  const fork = toPts(FORK, min, max, NOW, REAL.length);
  const realEnd = REAL[REAL.length - 1]! - live;
  const forkEnd = Math.round(4480 + (FORK[FORK.length - 1]! - 4480) * grow) - live;
  return (
    <AppFrame phone={phone} active={3} brand={brand}>
      <PageHead
        title="Timeline Forks"
        sub="Savings by next June"
        icon="fork"
        right={
          <span className={`${styles.btn} ${styles.btnSmall} ${within(t, 1250, 1550) ? styles.pressed : ''}`} data-target="newfork">
            <I d={P.plus} size={14} stroke={2.6} />
            New fork
          </span>
        }
      />
      <div className={styles.legend}>
        <div className={styles.legendCard}>
          <i style={{ background: brand }} />
          <span>
            <small>Real life · stay in Helsinki</small>
            <b>{eur(realEnd)}</b>
          </span>
        </div>
        {t >= 4600 && (
          <motion.div className={`${styles.legendCard} ${styles.legendFork}`} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}>
            <i style={{ background: SUN }} />
            <span>
              <small>Fork · {WHAT_IF.toLowerCase()}</small>
              <b>{eur(forkEnd)}</b>
            </span>
            {grow >= 1 && (
              <motion.em className={styles.diff} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                +{eur(forkEnd - realEnd)}
              </motion.em>
            )}
          </motion.div>
        )}
      </div>
      <div className={`${styles.card} ${styles.chartCard}`}>
        <div className={styles.chart} style={{ height: phone ? 250 : 260 }}>
          <span className={styles.nowLine} style={{ left: pct(real[NOW]!).left }}>
            <em>Today</em>
          </span>
          <svg viewBox={`0 0 ${VB.w} ${VB.h}`} preserveAspectRatio="none" className={styles.chartSvg}>
            <path d={smooth(real.slice(0, NOW + 1))} className={styles.lineMain} />
            <path d={smooth(real.slice(NOW))} className={`${styles.lineMain} ${styles.dashed}`} />
            <clipPath id="fork-reveal">
              <rect x={-10} y={-10} width={real[NOW]![0] + 10 + (VB.w - real[NOW]![0] + 10) * grow} height={VB.h + 20} />
            </clipPath>
            {t >= 4700 && <path d={smooth(fork)} clipPath="url(#fork-reveal)" className={styles.lineFork} />}
          </svg>
          <i className={`${styles.dot} ${styles.dotOk}`} style={pct(real[NOW]!)} />
          {grow >= 1 && <i className={`${styles.dot} ${styles.dotSun}`} style={pct(fork[fork.length - 1]!)} />}
        </div>
        <div className={styles.months}>
          {MONTHS.map((m, i) => (
            <span key={m}>{phone && i % 2 ? '' : m}</span>
          ))}
        </div>
      </div>
      <div className={styles.liveBar}>
        <span className={styles.liveDot} />
        <span>
          <b>Live</b> ·{' '}
          <span className={within(t, 8300, 9600) ? styles.flashText : undefined}>{t >= 8300 ? 'Groceries €46 applied to both timelines' : 'Both timelines follow your real spending'}</span>
        </span>
      </div>
      <Sheet phone={phone} open={within(t, 1600, 4500)} title="New fork">
        <div className={styles.input}>
          <small>What if I…</small>
          <span>
            {typed}
            {t < 3100 && <i className={styles.caret} />}
          </span>
        </div>
        <div className={styles.details}>
          {EFFECTS.map(([name, value, good], i) =>
            t >= 3100 + i * 250 ? (
              <motion.span key={name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
                {name} <b className={good ? styles.pos : styles.neg}>{value}</b>
              </motion.span>
            ) : null,
          )}
        </div>
        <div className={styles.sheetActions}>
          <span className={styles.btnGhost}>Cancel</span>
          <span className={`${styles.btn} ${within(t, 4150, 4450) ? styles.pressed : ''}`} data-target="create">
            Create fork
          </span>
        </div>
      </Sheet>
    </AppFrame>
  );
}

/* ---------- 4. Plan ahead ---------- */

const EVENTS: Array<{ date: string; name: string; cost: number; tag: string }> = [
  { date: 'Oct 14', name: 'Dentist check-up', cost: 85, tag: 'Health' },
  { date: 'Nov 7', name: "Maya's birthday", cost: 60, tag: 'Gift' },
  { date: 'Dec 20', name: 'Flight home for the holidays', cost: 310, tag: 'Travel' },
  { date: 'Mar 14', name: "Anna & Jon's wedding · Porto", cost: 620, tag: 'Wedding' },
];
const SAVE_AT = 5900;

function PlanScene({ t, phone, brand }: SceneProps) {
  const saved = t >= SAVE_AT;
  const monthly = 236 + (saved ? Math.round(104 * prog(t, SAVE_AT, SAVE_AT + 700)) : 0);
  return (
    <AppFrame phone={phone} active={4} brand={brand}>
      <PageHead title="Plan ahead" sub="Connected to your calendar" icon="cal" right={!phone && <b className={styles.pill}>Google Calendar</b>} />
      <div className={phone ? styles.stack : styles.split}>
        <div className={styles.card}>
          <strong className={styles.cardTitle}>Costs on your calendar</strong>
          {t < 1500 && (
            <div className={styles.scan}>
              <i style={{ width: `${prog(t, 0, 1500) * 100}%` }} />
              <small>Reading the next 6 months…</small>
            </div>
          )}
          {EVENTS.map((e, i) => {
            const found = t >= 1500 + i * 280;
            const wedding = i === EVENTS.length - 1;
            return (
              <div key={e.name} className={styles.event} data-target={wedding ? 'wedding' : undefined} data-on={(wedding && saved) || undefined}>
                <span className={styles.date}>
                  <b>{e.date.split(' ')[1]}</b>
                  <small>{e.date.split(' ')[0]}</small>
                </span>
                <span>
                  <b>{e.name}</b>
                  <small>{wedding && saved ? '€104 / month set aside' : e.tag}</small>
                </span>
                <AnimatePresence>
                  {found && (
                    <motion.em className={styles.chip} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}>
                      ~{eur(e.cost)}
                    </motion.em>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
        <div className={styles.stack}>
          <div className={styles.card}>
            <strong className={styles.cardTitle}>Set aside each month</strong>
            <strong className={styles.bigNum}>{eur(monthly)}</strong>
            <div className={styles.goal}>
              <span>
                <I d={P.jar} size={14} /> Holiday flight <b>40%</b>
              </span>
              <div className={styles.meter}>
                <span style={{ width: '40%' }} />
              </div>
            </div>
            {saved && (
              <motion.div className={styles.goal} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <span>
                  <I d={P.jar} size={14} /> Porto wedding <b>{Math.round(17 * prog(t, SAVE_AT + 300, SAVE_AT + 1500))}%</b>
                </span>
                <div className={styles.meter}>
                  <span style={{ width: `${17 * prog(t, SAVE_AT + 300, SAVE_AT + 1500)}%`, background: SUN }} />
                </div>
              </motion.div>
            )}
          </div>
          {!phone && (
            <div className={`${styles.card} ${styles.infl}`}>
              <span className={styles.pageIcon}>
                <I d={P.trend} size={18} />
              </span>
              <span>
                <small>Your personal inflation</small>
                <b>
                  7.2% <em>vs 3.1% national</em>
                </b>
              </span>
            </div>
          )}
        </div>
      </div>
      <Sheet phone={phone} open={within(t, 3700, 5800)} title="Anna & Jon's wedding · Mar 14">
        <div className={styles.details}>
          <span>
            Flights to Porto <b>€240</b>
          </span>
          <span>
            Hotel · 2 nights <b>€180</b>
          </span>
          <span>
            Outfit <b>€120</b>
          </span>
          <span>
            Gift <b>€80</b>
          </span>
        </div>
        <div className={styles.suggest}>
          <I d={P.jar} size={16} />
          <span>
            Put aside <b>€104 a month</b> until March and it&apos;s paid before you pack.
          </span>
        </div>
        <div className={styles.sheetActions}>
          <span className={styles.btnGhost}>Edit</span>
          <span className={`${styles.btn} ${within(t, 5450, 5780) ? styles.pressed : ''}`} data-target="save">
            Start saving
          </span>
        </div>
      </Sheet>
      <Toast show={within(t, 6000, 8800)} text="€104 a month set aside for Porto" />
    </AppFrame>
  );
}


/* ---------- 5. Future you ---------- */

const NOTE = "You're saving for Porto. Is this worth a night there?";
const QUICK = '32 wolt pizza';
const SKIP_AT = 6900;

function FutureScene({ t, phone, brand }: SceneProps) {
  const sheet = within(t, 2900, SKIP_AT + 200);
  const kept = t >= SKIP_AT ? Math.round(99 + 32 * prog(t, SKIP_AT + 300, SKIP_AT + 1300)) : 99;
  const words = NOTE.split(' ');
  const spoken = Math.floor(clamp01((t - 3400) / 2400) * words.length);
  return (
    <AppFrame phone={phone} active={1} brand={brand}>
      <PageHead title="Spending" sub="Log it in two seconds" icon="list" right={!phone && <b className={styles.pill}>Kept for Porto {eur(kept)}</b>} />
      <div className={styles.quickBar}>
        <span className={styles.quickText}>
          {typed(QUICK, t, 700, 2000) || <em>12.50 lunch · +2900 salary</em>}
          {within(t, 600, 2300) && <i className={styles.caret} />}
        </span>
        <span className={`${styles.btn} ${styles.btnSmall} ${within(t, 2350, 2650) ? styles.pressed : ''}`} data-target="add">
          <I d={P.plus} size={14} stroke={2.6} /> Add
        </span>
      </div>
      <div className={styles.card}>
        <strong className={styles.cardTitle}>Today</strong>
        {[
          ['Coffee', 'Coffee', 4.2],
          ['K-Market', 'Groceries', 23.5],
          ['HSL ticket', 'Transport', 3.2],
        ].map(([n, c, a]) => (
          <div key={n as string} className={styles.bill}>
            <span>
              <b>{n}</b>
              <small>{c}</small>
            </span>
            <b>−€{(a as number).toFixed(2)}</b>
          </div>
        ))}
      </div>
      {phone || (
        <div className={styles.tipCard}>
          <b>Future-self notes.</b> Record a note to yourself once. It plays back right before you spend where you have regretted it before.
        </div>
      )}
      <Sheet phone={phone} open={sheet} title="Wait. A note from past you.">
        <div className={styles.playback}>
          <span className={styles.wave} aria-hidden="true">
            {Array.from({ length: 28 }, (_, i) => {
              const live = within(t, 3300, 6000);
              const h = live ? 6 + Math.abs(Math.sin(t / 140 + i * 0.9)) * 22 * (0.5 + ((i * 7) % 5) / 8) : 5;
              return <i key={i} style={{ height: h }} />;
            })}
          </span>
          <q>
            {words.map((w, i) => (
              <span key={i} style={{ opacity: i < spoken ? 1 : 0.18, transition: 'opacity .25s' }}>
                {w}{' '}
              </span>
            ))}
          </q>
          <small>
            <I d={P.mic} size={11} /> Your voice · recorded Sep 12
          </small>
        </div>
        <div className={styles.details}>
          <span>
            Wolt pizza <small>Takeaway</small> <b>€32</b>
          </span>
        </div>
        <p className={styles.note}>You regretted takeaway 7 of your last 8 times.</p>
        <div className={styles.sheetActions}>
          <span className={styles.btnGhost}>Log it anyway</span>
          <span className={`${styles.btn} ${within(t, SKIP_AT - 300, SKIP_AT) ? styles.pressed : ''}`} data-target="skip">
            Skip it
          </span>
        </div>
      </Sheet>
      <Toast show={within(t, SKIP_AT + 300, 10600)} text="Skipped · €32 kept for future you" />
    </AppFrame>
  );
}

/* ---------- 6. Want to buy ---------- */

const WISH_ADD = 3500;
const WISH_SAVE = 7000;
// Spendable over the next 12 months (euros) and the laptop's price.
const AHEAD = [1650, 1240, 980, 1420, 1880, 2240, 2610, 2980, 3300, 3700, 4080, 4460];
const LAPTOP = 1800;
const FITS = 4; // February, the first month it fits for good

function WishScene({ t, phone, brand }: SceneProps) {
  const added = t >= WISH_ADD;
  const saving = t >= WISH_SAVE;
  const jar = saving ? Math.round(23 * prog(t, WISH_SAVE + 200, WISH_SAVE + 1400)) : 0;
  const line = toPts(AHEAD, 0, 4600);
  const reveal = prog(t, WISH_ADD + 300, WISH_ADD + 1700);
  const marker = prog(t, WISH_ADD + 1500, WISH_ADD + 2600);
  const fitX = (FITS / (AHEAD.length - 1)) * VB.w;
  const priceY = VB.h - (LAPTOP / 4600) * VB.h;
  const items: Array<{ name: string; price: string; state: string; ok?: boolean; target?: string }> = [
    { name: 'Headphones', price: '€120', state: 'You can afford it now', ok: true },
    { name: 'Weekend in Tallinn', price: '€260', state: 'Fits from Nov 12 · in 44 days' },
  ];
  return (
    <AppFrame phone={phone} active={4} brand={brand}>
      <PageHead
        title="Want to buy"
        sub="When it fits your forecast"
        icon="cart"
        right={
          <span className={`${styles.btn} ${styles.btnSmall} ${within(t, 900, 1200) ? styles.pressed : ''}`} data-target="wadd">
            <I d={P.plus} size={14} stroke={2.6} /> Add
          </span>
        }
      />
      <div className={phone ? styles.stack : styles.split}>
        <div className={styles.card}>
          {items.map((w) => (
            <div key={w.name} className={styles.buy}>
              <span>
                <b>{w.name}</b>
                <small className={w.ok ? styles.pos : undefined}>{w.state}</small>
              </span>
              <b className={styles.amount}>{w.price}</b>
            </div>
          ))}
          {added && (
            <motion.div className={`${styles.buy} ${styles.wishNew}`} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
              <span>
                <b>New laptop</b>
                <small className={saving ? undefined : marker >= 1 ? styles.warn : undefined}>
                  {saving ? `Saving · ${jar}% · €300 a month` : marker >= 1 ? 'Fits from Feb 9 · in 134 days' : 'Checking your forecast…'}
                </small>
                {saving && (
                  <span className={styles.meter} style={{ marginTop: 6 }}>
                    <span style={{ width: `${jar}%`, background: SUN }} />
                  </span>
                )}
              </span>
              <b className={styles.amount}>€1,800</b>
              {!saving && marker >= 1 && (
                <span className={`${styles.btnGhost} ${styles.btnTiny} ${within(t, WISH_SAVE - 350, WISH_SAVE) ? styles.pressed : ''}`} data-target="wsave">
                  Save for it
                </span>
              )}
            </motion.div>
          )}
        </div>
        <div className={`${styles.card} ${styles.chartCard}`}>
          <strong className={styles.cardTitle}>Money left after buying it</strong>
          <div className={styles.chart} style={{ height: phone ? 150 : 190 }}>
            {added && (
              <span className={styles.priceLine} style={{ top: pct([0, priceY]).top }}>
                <em>€1,800</em>
              </span>
            )}
            {added && marker > 0 && <span className={styles.fitZone} style={{ left: `${(fitX / VB.w) * 100}%`, opacity: marker }} />}
            <svg viewBox={`0 0 ${VB.w} ${VB.h}`} preserveAspectRatio="none" className={styles.chartSvg}>
              <clipPath id="wish-reveal">
                <rect x={-10} y={-10} width={(VB.w + 20) * (added ? reveal : 1)} height={VB.h + 20} />
              </clipPath>
              <path d={smooth(line)} clipPath="url(#wish-reveal)" className={styles.lineMain} />
            </svg>
            {added && marker > 0 && (
              <>
                <i className={`${styles.dot} ${styles.dotSun}`} style={{ left: `${(fitX / VB.w) * 100 * marker}%`, top: pct(line[Math.round(FITS * marker)]!).top }} />
                {marker >= 1 && (
                  <motion.span className={styles.fitLabel} style={{ left: `${(fitX / VB.w) * 100}%` }} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                    Fits from Feb 9
                  </motion.span>
                )}
              </>
            )}
          </div>
          <div className={styles.months}>
            {['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'].map((m, i) => (
              <span key={m}>{phone && i % 2 ? '' : m}</span>
            ))}
          </div>
        </div>
      </div>
      <Sheet phone={phone} open={within(t, 1300, WISH_ADD - 100)} title="Something you want to buy">
        <div className={styles.input}>
          <small>What is it</small>
          <span>
            {typed('New laptop', t, 1600, 2300)}
            {within(t, 1500, 2350) && <i className={styles.caret} />}
          </span>
        </div>
        <div className={styles.input}>
          <small>Price</small>
          <span>
            {typed('€1,800', t, 2450, 2900)}
            {within(t, 2400, 3000) && <i className={styles.caret} />}
          </span>
        </div>
        <div className={styles.sheetActions}>
          <span className={styles.btnGhost}>Cancel</span>
          <span className={`${styles.btn} ${within(t, 3100, 3400) ? styles.pressed : ''}`} data-target="wlist">
            Add to list
          </span>
        </div>
      </Sheet>
      <Toast show={within(t, WISH_SAVE + 200, 10600)} text="€300 a month set aside · laptop by Feb 9" />
    </AppFrame>
  );
}

/* ---------- 7. Statements ---------- */

const READ_AT = 1500;
const STORY_AT = 3700;
const STREAM: Array<[string, string, number]> = [
  ['Oct 1', 'Acme Oy · Salary', 2900],
  ['Oct 3', 'Kiinteistö Oy · Rent', -950],
  ['Oct 4', 'K-Market', -42.1],
  ['Oct 5', 'Spotify', -12.99],
  ['Oct 6', 'Wolt', -23.9],
  ['Oct 9', 'HSL', -60],
  ['Oct 12', 'Finnair', -320],
];
const MONTH_OUT = [1297, 1402, 1916, 1350, 1288, 2802, 1310, 1344, 1330, 1390, 1372, 1486];

function StatementScene({ t, phone, brand }: SceneProps) {
  const story = t >= STORY_AT;
  const count = (to: number) => Math.round(to * prog(t, STORY_AT + 100, STORY_AT + 1500));
  const read = Math.round(145 * prog(t, READ_AT, STORY_AT - 200));
  const lines = [
    'You spent the most in March (€2,802), when the laptop arrived.',
    'Rent took 65% of everything you spent.',
    '4 regular charges add up to €1,048 a month.',
    'You kept €17,213, 49% of what came in.',
  ];
  const chip = prog(t, 300, 1300);
  return (
    <AppFrame phone={phone} active={5} brand={brand}>
      <PageHead title="Statements" sub="Where your money went" icon="file" right={!phone && story && <b className={styles.pill}>Oct 2025 – Sep 2026</b>} />
      {!story ? (
        <div className={styles.drop} data-on={chip >= 1 || undefined}>
          {t < READ_AT ? (
            <>
              <I d={P.upload} size={26} />
              <b>Drop a bank statement, screenshots or an export</b>
              <small>PDF · screenshot · Excel · CSV</small>
            </>
          ) : (
            <>
              <span className={styles.scanBar}>
                <i style={{ width: `${(read / 145) * 100}%` }} />
              </span>
              <b>Reading nordea-2025-2026.pdf · {read} transactions</b>
              <div className={styles.stream}>
                {STREAM.slice(0, Math.floor(clamp01((t - READ_AT) / (STORY_AT - READ_AT - 300)) * STREAM.length)).map(([d, n, a]) => (
                  <motion.span key={d + n} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                    <small>{d}</small>
                    {n}
                    <b className={a > 0 ? styles.pos : undefined}>{(a > 0 ? '+' : '−') + '€' + Math.abs(a).toLocaleString('en-US', { minimumFractionDigits: a % 1 ? 2 : 0 })}</b>
                  </motion.span>
                ))}
              </div>
            </>
          )}
          {t < READ_AT && (
            <span className={styles.fileChip} style={{ transform: `translate(${(1 - chip) * 220}px, ${(1 - chip) * -150}px) rotate(${(1 - chip) * 12}deg)`, opacity: chip > 0 ? 1 : 0 }}>
              <I d={P.file} size={16} /> nordea-2025-2026.pdf
            </span>
          )}
        </div>
      ) : (
        <>
          <div className={styles.statRow}>
            {[
              ['Money in', count(34800), styles.pos],
              ['Money out', count(17587), undefined],
              ['You kept', count(17213), styles.pos],
            ].map(([label, n, cls]) => (
              <div key={label as string} className={styles.card}>
                <small className={styles.statLabel}>{label}</small>
                <strong className={`${styles.bigNum} ${cls ?? ''}`}>{eur(n as number)}</strong>
              </div>
            ))}
          </div>
          <div className={phone ? styles.stack : styles.split}>
            <div className={`${styles.card} ${styles.chartCard}`}>
              <strong className={styles.cardTitle}>Month by month</strong>
              <div className={styles.bars}>
                {MONTH_OUT.map((v, i) => (
                  <span key={i}>
                    <i style={{ height: `${(v / 3000) * 100 * prog(t, STORY_AT + 200 + i * 60, STORY_AT + 900 + i * 60)}%`, background: i === 5 ? SUN : brand }} />
                    <small>{'ONDJFMAMJJAS'[i]}</small>
                  </span>
                ))}
              </div>
            </div>
            {!phone && (
              <div className={styles.card}>
                <strong className={styles.cardTitle}>Where it went</strong>
                {[
                  ['Housing', 65, brand],
                  ['Groceries', 14, '#16a34a'],
                  ['Shopping', 8, '#ec4899'],
                  ['Takeaway', 5, '#ef4444'],
                ].map(([n, v, c], i) => (
                  <div key={n as string} className={styles.barRow}>
                    <span>
                      {n}
                      <b>{v}%</b>
                    </span>
                    <div className={styles.meter}>
                      <span style={{ width: `${(v as number) * prog(t, STORY_AT + 600 + i * 150, STORY_AT + 1500 + i * 150)}%`, background: c as string }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <ul className={styles.storyList}>
            {lines.slice(0, Math.floor(clamp01((t - STORY_AT - 1400) / 3200) * lines.length + (t >= STORY_AT + 1400 ? 1 : 0))).map((l) => (
              <motion.li key={l} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                {l}
              </motion.li>
            ))}
          </ul>
        </>
      )}
    </AppFrame>
  );
}

export type SceneDef = {
  id: 'weather' | 'worth' | 'future' | 'fork' | 'plan' | 'wish' | 'statements' | 'payday';
  tab: string;
  title: string;
  caption: string;
  dur: number;
  glow: string;
  url: string;
  beats: Beat[];
  bursts: number[];
  Scene: (p: SceneProps) => React.ReactElement;
};

/* ---------- 8. When money lands ---------- */

const TYPE_AT = 700;
const ADDED_AT = 2400;
const THIRD_AT = 3000;
const LANDS_AT = 4300;
const TICKS = [5700, 6700, 7700];
const ALL_DONE = 8300;

function PaydayScene({ t, phone, brand }: SceneProps) {
  const items: Array<{ text: string; amount: number; must?: boolean; at: number }> = [
    { text: 'Pay back Sam for the concert', amount: 120, must: true, at: -1 },
    { text: 'Book the train to Tampere', amount: 45.9, at: ADDED_AT },
    { text: 'Move €200 to the Porto jar', amount: 200, at: THIRD_AT },
  ];
  const shown = items.filter((i) => t >= i.at);
  const planned = shown.reduce((s, i) => s + i.amount, 0);
  const landed = t >= LANDS_AT;
  const done = TICKS.filter((at) => t >= at).length;
  const all = done === items.length;
  const push = within(t, LANDS_AT, LANDS_AT + 3000);
  return (
    <AppFrame phone={phone} active={4} brand={brand} bell={landed && !all ? 'ring' : 'idle'}>
      <PageHead title="When money lands" sub="A to-do list for payday" icon="wallet" />
      <div className={styles.card}>
        <div className={styles.todoInputs}>
          <span className={`${styles.todoField} ${within(t, TYPE_AT - 100, ADDED_AT) ? styles.todoFocus : ''}`}>
            {within(t, TYPE_AT, ADDED_AT) ? typed('Book the train to Tampere', t, TYPE_AT, TYPE_AT + 1000) : <em>Pay back Sam, book the train…</em>}
            {within(t, TYPE_AT - 100, ADDED_AT - 300) && <i className={styles.caret} />}
          </span>
          {!phone && <span className={styles.todoField}>{within(t, TYPE_AT + 1100, ADDED_AT) ? typed('€45.90', t, TYPE_AT + 1100, TYPE_AT + 1500) : <em>Cost</em>}</span>}
          <span className={styles.todoField}>When Salary lands · Oct 9</span>
          <span className={`${styles.btn} ${styles.btnSmall} ${within(t, ADDED_AT - 250, ADDED_AT + 50) ? styles.pressed : ''}`} data-target="tadd">
            <I d={P.plus} size={13} stroke={2.6} /> Add
          </span>
        </div>
        <div className={styles.todoGroup} data-landed={landed || undefined}>
          <div className={styles.todoHead}>
            <span className={styles.todoBadge}>
              <I d={landed ? P.check : P.wallet} size={14} stroke={2.4} />
            </span>
            <span>
              <b>{landed ? 'Salary is in' : 'When Salary lands'}</b>
              <small>{all ? 'All done' : landed ? 'Landed today · time to do these' : 'Oct 9 · in 3 days'}</small>
            </span>
            <b className={styles.amount}>
              €{planned.toFixed(2).replace('.00', '')} <small>of €2,900</small>
            </b>
          </div>
          <span className={styles.meter}>
            <span style={{ width: `${(planned / 2900) * 100}%` }} />
          </span>
          {shown.map((it, i) => (
            <motion.div key={it.text} className={styles.todoLine} data-done={i < done || undefined} initial={it.at > 0 ? { opacity: 0, y: -6 } : false} animate={{ opacity: 1, y: 0 }}>
              <span className={`${styles.tick} ${within(t, TICKS[i]! - 250, TICKS[i]! + 50) ? styles.pressed : ''}`} data-target={`tick${i}`}>
                <I d={P.check} size={11} stroke={3} />
              </span>
              <span className={styles.todoText}>
                {it.text}
                {it.must && <em className={styles.mustTag}>Must</em>}
              </span>
              <b className={styles.amount}>€{it.amount.toFixed(2).replace('.00', '')}</b>
            </motion.div>
          ))}
        </div>
      </div>
      <AnimatePresence>
        {push && (
          <motion.div className={styles.push} initial={{ opacity: 0, y: -40, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -30 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}>
            <span className={styles.pushIcon}>
              <Mark />
            </span>
            <span>
              <small>PURSECAST · now</small>
              <b>Salary landed · 3 things to do</b>
              <span>Pay back Sam, Book the train and 1 more</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      <Toast show={t >= ALL_DONE} text="All done · €365.90 of your pay had a job" />
    </AppFrame>
  );
}

export const SCENES: SceneDef[] = [
  {
    id: 'weather',
    tab: 'Money Weather',
    title: 'See storms coming.',
    caption: 'A 90-day forecast built from your bills, habits and calendar warns you weeks before money gets tight, and offers a fix.',
    dur: 11000,
    glow: '#14b8a6',
    url: 'app.pursecast.com/forecast',
    beats: [
      [0, null],
      [1900, 'storm'],
      [2450, 'storm', 250],
      [2900, null],
      [4300, 'fix'],
      [5250, 'fix', 350],
      [5900, null],
    ],
    bursts: [5950],
    Scene: WeatherScene,
  },
  {
    id: 'worth',
    tab: 'Worth-It',
    title: 'Budget by joy, not by category.',
    caption: 'One tap two days after you buy something. Pursecast learns what makes you happy and moves money toward it.',
    dur: 11000,
    glow: '#f43f5e',
    url: 'app.pursecast.com/worth-it',
    beats: [
      [0, null],
      [1200, 'n-love'],
      [1750, 'n-love', 250],
      [2300, null],
      [2800, 'r-1'],
      [3200, 'r-1', 200],
      [3700, 'r-2'],
      [4100, 'r-2', 200],
      [4600, 'r-3'],
      [5000, 'r-3', 200],
      [5500, null],
      [6400, 'move'],
      [6900, 'move', 350],
      [7600, null],
    ],
    bursts: [7350],
    Scene: WorthScene,
  },
  {
    id: 'future',
    tab: 'Future you',
    title: 'A word from past you.',
    caption: 'Record a note once. It plays back in your own voice right before you spend where you have regretted it before.',
    dur: 11000,
    glow: '#8b5cf6',
    url: 'app.pursecast.com/spending',
    beats: [
      [0, null],
      [1900, 'add'],
      [2350, 'add', 300],
      [2800, null],
      [5900, 'skip'],
      [6600, 'skip', 300],
      [7100, null],
    ],
    bursts: [7250],
    Scene: FutureScene,
  },
  {
    id: 'fork',
    tab: 'Timeline Forks',
    title: 'Try a life before you live it.',
    caption: 'Fork your finances into a "what if" and watch both futures update with every real transaction.',
    dur: 11500,
    glow: '#f59e0b',
    url: 'app.pursecast.com/forks',
    beats: [
      [0, null],
      [600, 'newfork'],
      [1200, 'newfork', 300],
      [1700, null],
      [3500, 'create'],
      [4100, 'create', 300],
      [4600, null],
    ],
    bursts: [6500],
    Scene: ForkScene,
  },
  {
    id: 'plan',
    tab: 'Plan ahead',
    title: 'No more surprise costs.',
    caption: 'Pursecast reads your calendar, prices what is coming and sets money aside a little each month.',
    dur: 10500,
    glow: '#38bdf8',
    url: 'app.pursecast.com/plan',
    beats: [
      [0, null],
      [2800, 'wedding'],
      [3350, 'wedding', 250],
      [3800, null],
      [4700, 'save'],
      [5400, 'save', 350],
      [6000, null],
    ],
    bursts: [5950],
    Scene: PlanScene,
  },
  {
    id: 'wish',
    tab: 'Want to buy',
    title: 'Know when you can buy it.',
    caption: 'Add what you want and see the first day it fits your forecast without a storm after. Save for it a little each month.',
    dur: 11000,
    glow: '#f59e0b',
    url: 'app.pursecast.com/plan#want',
    beats: [
      [0, null],
      [400, 'wadd'],
      [900, 'wadd', 300],
      [1300, null],
      [2800, 'wlist'],
      [3100, 'wlist', 300],
      [3500, null],
      [6300, 'wsave'],
      [6650, 'wsave', 350],
      [7100, null],
    ],
    bursts: [7250],
    Scene: WishScene,
  },
  {
    id: 'statements',
    tab: 'Statements',
    title: 'Your year, told as a story.',
    caption: 'Drop a bank statement, screenshots or an export. Pursecast reads every transaction and shows where your money came from and where it went.',
    dur: 11500,
    glow: '#22c55e',
    url: 'app.pursecast.com/statements',
    beats: [[0, null]],
    bursts: [5300],
    Scene: StatementScene,
  },
  {
    id: 'payday',
    tab: 'Payday',
    title: 'Know what to do when pay lands.',
    caption: 'Jot down what waits for payday. Pursecast nudges you when the money arrives, and bills or debts are due, even with the app closed.',
    dur: 11000,
    glow: '#10b981',
    url: 'app.pursecast.com/plan#todo',
    beats: [
      [0, null],
      [1900, 'tadd'],
      [2150, 'tadd', 300],
      [2600, null],
      [5200, 'tick0'],
      [5450, 'tick0', 250],
      [6200, 'tick1'],
      [6450, 'tick1', 250],
      [7200, 'tick2'],
      [7450, 'tick2', 250],
      [8000, null],
    ],
    bursts: [8300],
    Scene: PaydayScene,
  },
];
