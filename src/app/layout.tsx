import type { Metadata, Viewport } from 'next';
import { Figtree } from 'next/font/google';
import './globals.css';

const figtree = Figtree({ subsets: ['latin', 'latin-ext'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: { default: 'Pursecast | Budget the future', template: '%s | Pursecast' },
  description: 'Pursecast forecasts your money like the weather, lets you try big decisions before you make them, and learns which spending makes you happy.',
  applicationName: 'Pursecast',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0d1015' },
  ],
};

// Light or dark as picked in Settings. Automatic follows the device, and is
// dark from 7 pm to 7 am even on devices that stay light; checked again every
// few minutes so it turns at 7 without a reload.
const THEME_SCRIPT = `(function(){function a(){var t=null;try{t=localStorage.getItem('pursecast:theme')}catch(e){}var r=document.documentElement;if(t==='light'||t==='dark'){r.setAttribute('data-theme',t);return}var h=new Date().getHours();if(h>=19||h<7)r.setAttribute('data-theme','dark');else r.removeAttribute('data-theme')}a();setInterval(a,300000);window.__pursecastTheme=a})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={figtree.variable} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* Light or dark as picked in Settings, set before the first paint. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
