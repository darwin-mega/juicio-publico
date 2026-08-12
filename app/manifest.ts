import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Juicio Público',
    short_name: 'Juicio Público',
    description: 'Juego social presencial de deducción y engaño.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'fullscreen', 'minimal-ui'],
    background_color: '#0d0f14',
    theme_color: '#0d0f14',
    orientation: 'any',
    lang: 'es',
    categories: ['games', 'entertainment'],
    icons: [
      {
        src: '/img/Juicio-logo.png',
        sizes: '1024x1024',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/img/Juicio-logo.png',
        sizes: '1024x1024',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
