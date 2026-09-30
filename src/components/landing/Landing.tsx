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
  { icon: 'sun', color: '#f59e0b', title: 'Money Weather', desc: 'A forecast of your cash for the next month, three months or a whole year, shown as a weather report. Storm warnings come early, with a fix attached.' },
  { icon: 'fork', color: '#0f7a63', title: 'Timeline Forks', desc: 'Split your finances into "what if" futures, such as a new city or a new job, and watch them update with every real purchase.' },
  { icon: 'cal', color: '#0ea5e9', title: 'Calendar planning', desc: 'Weddings, trips and birthdays on your calendar are priced ahead of time, and money is set aside a little each month.' },
  { icon: 'heart', color: '#f43f5e', title: 'Worth-It Score', desc: 'One tap, two days after you buy something. Your budget shifts toward what actually makes you happy.' },
  { icon: 'mic', color: '#8b5cf6', title: 'Future-self notes', desc: 'Record a note to yourself, in your own voice. It plays back right before you spend where you have regretted it before.' },
  { icon: 'file', color: '#22c55e', title: 'Statements, as a story', desc: 'Upload a year of bank statements, screenshots or an export. See where money came from, where it went, and every regular charge.' },
  { icon: 'cart', color: '#e0a526', title: 'Want to buy', desc: 'Add what you want and see the first day it fits your forecast without a storm after. Save for it a little each month.' },
  { icon: 'hand', color: '#0891b2', title: 'Money owed and advances', desc: 'Who owes you, who you owe, banks included, with due dates. Salary advances come off the right payday by themselves.' },
  { icon: 'trend', color: '#6366f1', title: 'Personal inflation', desc: 'Your own inflation rate from your own receipts, next to the national one, with the prices that drove it.' },
  { icon: 'bolt', color: '#f97316', title: 'Two-second logging', desc: 'Type "12.50 lunch" or even "200 + 10 + 45". Pursecast does the sum, picks the category and updates the forecast.' },
  { icon: 'calc', color: '#64748b', title: 'Calculator and notes', desc: 'A calculator and a note pad float over every page. Drag them anywhere; they follow your light or dark theme.' },
  { icon: 'wallet', color: '#10b981', title: 'When money lands', desc: 'A to-do list for payday: pay someone back, book the train, fill a jar. Must-dos first, and what it all costs next to your pay.' },
  { icon: 'bell', color: '#ef4444', title: 'Reminders that matter', desc: 'A nudge at 8 when pay lands, a subscription renews tomorrow, a debt is due or a storm is coming. On your phone, or a Monday email.' },
  { icon: 'globe', color: '#0ea5e9', title: 'Every account, any currency', desc: 'Savings, a dollar card, cash, and bills priced in dollars next to euro rent. Pick what counts; the forecast uses today’s rate.' },
  { icon: 'moon', color: '#475569', title: 'Light by day, dark at night', desc: 'Follows your phone, or turns dark from 7 pm. Install it on your home screen and it opens like an app.' },
  { icon: 'shield', color: '#c2255c', title: 'Private by design', desc: 'No bank login needed. Bills that change every month, like cloud hosting, are fine too. Export or delete your data any time.' },
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
                  { title: 'Money Weather', desc: 'A month, three months or a year ahead', href: '#showcase', icon: 'sun' },
                  { title: 'Timeline Forks', desc: 'Try a decision before you make it', href: '#showcase', icon: 'fork' },
                  { title: 'Calendar planning', desc: 'Costs priced before they arrive', href: '#showcase', icon: 'cal' },
                  { title: 'When money lands', desc: 'A to-do list for payday', href: '#showcase', icon: 'wallet' },
                ],
              },
              {
                heading: 'Spend wisely',
                items: [
                  { title: 'Worth-It Score', desc: 'Budget by joy, not by category', href: '#showcase', icon: 'heart' },
                  { title: 'Future-self notes', desc: 'A word from you, at the right moment', href: '#showcase', icon: 'mic' },
                  { title: 'Want to buy', desc: 'The first day it fits your forecast', href: '#showcase', icon: 'cart' },
                  { title: 'Any currency', desc: 'A dollar plan next to euro rent', href: '#features', icon: 'globe' },
                ],
              },
              {
                heading: 'Know your money',
                items: [
                  { title: 'Statements', desc: 'A year of spending, told as a story', href: '#showcase', icon: 'file' },
                  { title: 'Money owed', desc: 'Lent, borrowed, advances, due dates', href: '#features', icon: 'hand' },
                  { title: 'Reminders', desc: 'On your phone, or a Monday email', href: '#features', icon: 'bell' },
                  { title: 'Calculator and notes', desc: 'Always at hand, on every page', href: '#features', icon: 'calc' },
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
            Pursecast forecasts your money like the weather, tells you when you can afford what you want, reminds you what to do when pay lands, turns a year of bank statements into a story, and learns which spending actually makes you happy.
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
            {FEATURES.slice(0, 8).map((f) => (
              <div key={f.icon} className={styles.glowTile} style={{ ['--glow' as string]: f.color }}>
                <Icon name={f.icon} />
              </div>
            ))}
          </div>
        </div>
        <div className={`${styles.wrap} ${styles.filmWrap} ${styles.fadeUp} ${styles.d3}`}>
          <ProductFilm scenes={['weather', 'fork', 'plan', 'wish', 'payday']} />
        </div>
      </header>

      <section id="story" className={styles.story}>
        <div className={styles.wrap}>
          <div className={styles.storyHead}>
            <span className={styles.storyKicker}>Spend wisely · Look back</span>
            <h2>
              Spend on what you love. <span>Know where it all went.</span>
            </h2>
            <p className={styles.storyLede}>Rate what you buy, hear a note from your future self at the right moment, and turn a year of statements into a story.</p>
          </div>
          <div className={styles.filmPanel}>
            <div className={styles.panelGlow} aria-hidden="true" />
            <ProductFilm scenes={['worth', 'future', 'statements']} />
          </div>
          <div className={styles.storyCards}>
            <div className={styles.storyCard}>
              <p>
                <b>Your money, told as a story.</b> Drop in a year of statements, rate what you buy, and leave notes for the moments you usually regret.
              </p>
              <a href="#features" className={styles.storyLink}>
                Explore every feature <span aria-hidden="true">›</span>
              </a>
            </div>
            <div className={styles.storyCard}>
              <span className={styles.storyBadge}>
                <Icon name="shield" size={20} /> Private by design
              </span>
              <p>No bank login needed to start. Your data stays yours: export or delete everything any time.</p>
              <a href="#how" className={styles.storyLink}>
                See how it works <span aria-hidden="true">›</span>
              </a>
            </div>
          </div>
        </div>
      </section>

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
            <h2>Look ahead. Spend on what matters. Know where it went.</h2>
            <p>Three ideas behind every screen: know what is coming, put your money where your happiness is, and understand your past.</p>
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
                  { title: 'When you can buy it', desc: 'Add something you want and see the first day it fits, then save for it a little each month.' },
                  { title: 'A plan for payday', desc: 'Jot down what waits for the money, then get a nudge the morning it lands.' },
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
              {
                title: 'Understand where it went',
                items: [
                  { title: 'A year in one upload', desc: 'Drop a bank statement, screenshots or an Excel export. Every transaction is read and sorted.' },
                  { title: 'The story of your money', desc: 'Money in and out by month, where it went, where you paid most, and what you kept.' },
                  { title: 'Charges you forgot', desc: 'Regular payments are found for you, with what they cost in a year, and added as a subscription in one tap.' },
                  { title: 'Owed and borrowed', desc: 'Friends, family or the bank: amounts, due dates and paybacks in one place.' },
                ],
                cta: 'Try it free',
                href: '/signup',
                dark: false,
                icon: ICONS['file']!,
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
                  { title: 'List your bills', desc: 'Rent, subscriptions and insurance, picked from a list, and what you owe. Bills whose price changes are fine.' },
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
              {
                label: 'Payday',
                steps: [
                  { title: 'Jot it down', desc: 'Pay back a friend, book a ticket, fill a jar. Pick the payday, or any date.' },
                  { title: 'Get a nudge', desc: 'The morning the pay lands, your phone says what is waiting. Bills due tomorrow too.' },
                  { title: 'Tick it off', desc: 'One tap each. Must-dos come first, and you see what it all costs next to your pay.' },
                  { title: 'Read your Monday email', desc: 'Optional. The week ahead, bills, and what waits for payday, in one short email.' },
                ],
              },
              {
                label: 'Look back',
                steps: [
                  { title: 'Download a statement', desc: 'Any period from your bank, as a PDF, Excel or CSV. Screenshots work too.' },
                  { title: 'Drop it in', desc: 'Pursecast reads every transaction and sorts it into categories.' },
                  { title: 'Read your story', desc: 'Where money came from, where it went, and what you kept, month by month.' },
                  { title: 'Track what repeats', desc: 'Turn regular charges into bills, so your forecast knows about them.' },
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
            <p>Start with a forecast, or drop in last year&rsquo;s statement and see where it all went. Two minutes, no bank login.</p>
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
              <a href="#features">Statements</a>
              <a href="#features">Want to buy</a>
              <a href="#features">When money lands</a>
              <a href="#features">Reminders</a>
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
