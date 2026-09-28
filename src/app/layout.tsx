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
  themeColor: '#0f7a63',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={figtree.variable} data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
