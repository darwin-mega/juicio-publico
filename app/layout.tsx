import type { Metadata, Viewport } from 'next';
import './globals.css';
import { GameProvider } from '@/context/GameContext';
import { MultiRoomProvider } from '@/context/MultiRoomContext';
import GlobalAudio from '@/components/GlobalAudio';
import PwaBootstrap from '@/components/PwaBootstrap';

export const metadata: Metadata = {
  title: 'Juicio Público',
  description: 'Juego social presencial de deducción y engaño',
  applicationName: 'Juicio Público',
  manifest: '/manifest.webmanifest',
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
    url: false,
  },
  appleWebApp: {
    capable: true,
    title: 'Juicio Público',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/img/Juicio-logo.png',
    apple: '/img/Juicio-logo.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: '#0d0f14',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <GameProvider>
          <MultiRoomProvider>
            <GlobalAudio />
            <PwaBootstrap />
            {children}
          </MultiRoomProvider>
        </GameProvider>
      </body>
    </html>
  );
}
