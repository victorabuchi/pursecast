import type { MetadataRoute } from 'next';

// Lets people add Pursecast to their home screen and open it like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pursecast',
    short_name: 'Pursecast',
    description: 'Your money forecast like the weather, reminders when it matters.',
    start_url: '/forecast',
    scope: '/',
    display: 'standalone',
    background_color: '#0f7a63',
    theme_color: '#0f7a63',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
