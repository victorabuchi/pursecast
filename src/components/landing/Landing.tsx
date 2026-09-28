import Link from 'next/link';
import styles from './landing.module.css';
import ProductFilm from './film/ProductFilm';
import Mark from '../Mark';
import RoleCards from './RoleCards';
import HowItWorks from './HowItWorks';
import LandingNav from './LandingNav';
import { ICONS } from '../../lib/icons';

const CONTACT = 'hello@pursecast.com';

// Each signature feature floats with its own colored glow.
const FEATURES: Array<{ icon: string; color: string; title: string; desc: string }> = [
  { icon: 'sun', color: '#f59e0b', title: 'Money Weather', desc: 'A 90-day forecast of your cash, shown as a weather report. Storm warnings come weeks early, with a fix attached.' },
  { icon: 'fork', color: '#0f7a63', title: 'Timeline Forks', desc: 'Split your finances into "what if" futures, such as a new city or a new job, and watch them update with every real purchase.' },
  { icon: 'cal', color: '#0ea5e9', title: 'Calendar planning', desc: 'Weddings, trips and birthdays on your calendar are priced ahead of time, and money is set aside a little each month.' },
  { icon: 'heart', color: '#f43f5e', title: 'Worth-It Score', desc: 'One tap, two days after you buy something. Your budget shifts toward what actually makes you happy.' },
  { icon: 'trend', color: '#8b5cf6', title: 'Personal inflation', desc: 'Your own inflation rate from your own receipts, next to the national one, with the prices that drove it.' },
  { icon: 'mic', color: '#14b8a6', title: 'Future-self notes', desc: 'Record a note to yourself. It plays back when you are about to overspend where you have regretted it before.' },
  { icon: 'bolt', color: '#e0a526', title: 'Two-second logging', desc: 'Add an expense with an amount and a word. Pursecast fills in the category, the date and the forecast.' },
  { icon: 'shield', color: '#c2255c', title: 'Private by design', desc: 'No bank login needed to start. Your data is yours, and you can export or delete it at any time.' },
];

function Icon({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

function Wordmark() {
  return (
    <span className={styles.wordmark}>
      <span className={styles.wordmarkTile}>
        <Mark size={22} />
      </span>
      Pursecast
    </span>
  );
}

export default function Landing() {
  return (
    <div className={styles.page}>
      <LandingNav
        logo={<Wordmark />}
        menuLabel="Menu"
        menus={[
          {
            id: 'product',
            label: 'Product',
            columns: [
              {
                heading: 'See ahead',
                items: [
                  { title: 'Money Weather', desc: 'Your next 90 days as a forecast', href: '#showcase', icon: 'sun' },
                  { title: 'Timeline Forks', desc: 'Try a decision before you make it', href: '#showcase', icon: 'fork' },
                  { title: 'Calendar planning', desc: 'Costs priced before they arrive', href: '#showcase', icon: 'cal' },
                ],
              },
              {
                heading: 'Spend wisely',
                items: [
                  { title: 'Worth-It Score', desc: 'Budget by joy, not by category', href: '#showcase', icon: 'heart' },
                  { title: 'Personal inflation', desc: 'Your cost of living, measured', href: '#features', icon: 'trend' },
                  { title: 'Future-self notes', desc: 'A word from you, at the right moment', href: '#features', icon: 'mic' },
                ],
              },
            ],
            side: {
              heading: 'Explore',
              links: [
                { label: 'See it work', href: '#showcase' },
                { label: 'All features', href: '#features' },
                { label: 'How it works', href: '#how' },
              ],
            },
            footer: { label: 'Start free, no bank login needed', href: '/signup' },
          },
        ]}
        plain={[
          { label: 'Features', href: '#features' },
          { label: 'How it works', href: '#how' },
        ]}
        actions={
          <>
            <Link href="/login" className={styles.btnGhost}>
              Log in
            </Link>
            <Link href="/signup" className={`${styles.btnPrimary} ${styles.navSignup}`}>
              Start free
            </Link>
          </>
        }
        mobileExtra={
          <div className={styles.mobileExtra}>
            <Link href="/signup" className={styles.btnPrimary}>
              Start free
            </Link>
          </div>
        }
      />

      <header id="showcase" className={styles.hero}>
        <div className={styles.aurora} aria-hidden="true" />
        <div className={`${styles.wrap} ${styles.heroInner}`}>
          <h1 className={styles.fadeUp}>
            Stop tracking the past. <span>Budget the future.</span>
          </h1>
          <p className={`${styles.heroLede} ${styles.fadeUp} ${styles.d2}`}>
            Pursecast forecasts your money like the weather, lets you try big decisions before you make them, and learns which spending actually makes you happy.
          </p>
          <div className={`${styles.heroCtas} ${styles.fadeUp} ${styles.d3}`}>
            <Link href="/signup" className={`${styles.btnHero} ${styles.big}`}>
              Start free
            </Link>
            <a href="#how" className={`${styles.btnHeroGhost} ${styles.big}`}>
              How it works
            </a>
          </div>
          <div className={styles.glowRow} aria-hidden="true">
            {FEATURES.slice(0, 6).map((f) => (
              <div key={f.icon} className={styles.glowTile} style={{ ['--glow' as string]: f.color }}>
                <Icon name={f.icon} />
              </div>
            ))}
          </div>
        </div>
        <div className={`${styles.wrap} ${styles.filmWrap} ${styles.fadeUp} ${styles.d3}`}>
          <ProductFilm />
        </div>
      </header>

      <section id="features" className={styles.sectionAlt}>
        <div className={styles.wrap}>
          <div className={styles.head}>
            <h2>Built around what happens next</h2>
            <p>Other apps tell you where your money went. Pursecast shows you where it is going, and whether it is worth it.</p>
          </div>
          <div className={styles.features}>
            {FEATURES.map((f) => (
              <div key={f.icon} className={styles.feature} style={{ ['--glow' as string]: f.color }}>
                <div className={styles.featureIcon}>
                  <Icon name={f.icon} />
                </div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.wrap}>
          <div className={styles.head}>
            <h2>Look ahead. Spend on what matters.</h2>
            <p>Two ideas behind every screen: know what is coming, and put your money where your happiness is.</p>
          </div>
          <RoleCards
            cards={[
              {
                title: 'See what is coming',
                items: [
                  { title: 'A forecast, not a history', desc: 'Your bills, habits and paydays become a 90-day outlook you can read at a glance.' },
                  { title: 'Storms with a fix', desc: 'When a tight week is coming, Pursecast says why and suggests where to find the money.' },
                  { title: 'Calendar costs, priced', desc: 'A wedding in March becomes flights, a hotel and a gift, saved for a little each month.' },
                  { title: 'Futures side by side', desc: 'Compare staying put with moving, a new job or a new car, using your real numbers.' },
                ],
                cta: 'See the forecast',
                href: '#showcase',
                dark: false,
                icon: ICONS['compass']!,
              },
              {
                title: 'Choose what is worth it',
                items: [
                  { title: 'Rate, then learn', desc: 'A quick 😍 😐 😩 after each purchase builds a map of joy per euro.' },
                  { title: 'Budgets that follow joy', desc: 'Money moves from what you regret to what you love, with your approval.' },
                  { title: 'A note from you', desc: 'Your own voice reminds you of your goal right when you are tempted.' },
                  { title: 'Your real inflation', desc: 'See how much your life costs this year compared with last, item by item.' },
                ],
                cta: 'Start free',
                href: '/signup',
                dark: true,
                icon: ICONS['heart']!,
              },
            ]}
          />
        </div>
      </section>

      <section id="how" className={styles.sectionAlt}>
        <div className={styles.wrap}>
          <div className={styles.head}>
            <h2>Two minutes to your first forecast</h2>
            <p>No bank login to start. Add what you know, and the forecast gets sharper every week.</p>
          </div>
          <HowItWorks
            tabs={[
              {
                label: 'Getting started',
                steps: [
                  { title: 'Add your balance', desc: 'Type today’s balance and your payday. That is enough for a first forecast.' },
                  { title: 'List your bills', desc: 'Rent, subscriptions and insurance, each with a date. Pursecast repeats them for you.' },
                  { title: 'Connect your calendar', desc: 'Optional. Upcoming events are priced and added to the forecast.' },
                  { title: 'Read the weather', desc: 'See the next 90 days, and fix any storm with one tap.' },
                ],
              },
              {
                label: 'Every week',
                steps: [
                  { title: 'Log in seconds', desc: 'An amount and a word. The rest is filled in.' },
                  { title: 'Rate last week', desc: 'Tap 😍 😐 or 😩 on what you bought two days ago.' },
                  { title: 'Take a suggestion', desc: 'Move money toward what you love, or skip it.' },
                  { title: 'Check your forks', desc: 'See how your "what if" futures moved this week.' },
                ],
              },
            ]}
          />
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.wrap}>
          <div className={styles.band}>
            <h2>Your future self will thank you.</h2>
            <p>Start with a forecast. It takes two minutes and no bank login.</p>
            <Link href="/signup" className={`${styles.btnLight} ${styles.big}`}>
              Start free
            </Link>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.wrap}>
          <div className={styles.footerCols}>
            <div className={styles.footerCol}>
              <Wordmark />
              <span>Budgeting that looks ahead.</span>
            </div>
            <div className={styles.footerCol}>
              <span className={styles.footerTitle}>Product</span>
              <a href="#showcase">See it work</a>
              <a href="#features">Features</a>
              <a href="#how">How it works</a>
            </div>
            <div className={styles.footerCol}>
              <span className={styles.footerTitle}>Company</span>
              <Link href="/signup">Start free</Link>
              <Link href="/login">Log in</Link>
              <a href={`mailto:${CONTACT}`}>Contact</a>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <span>&copy; {new Date().getFullYear()} Pursecast · pursecast.com</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
