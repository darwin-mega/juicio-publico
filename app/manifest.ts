import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Juicio Publico',
    short_name: 'Juicio',
    description: 'Juego social presencial de deduccion y engano.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'fullscreen', 'minimal-ui'],
    background_color: '#0d0f14',
    theme_color: '#0d0f14',
    orientation: 'any',
    categories: ['games', 'entertainment'],
    lang: 'es',
    icons: [
      {
        src: '/img/Juicio-logo.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/img/Juicio-logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
