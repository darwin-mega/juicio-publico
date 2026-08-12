import type { Metadata, Viewport } from 'next';
import './globals.css';
import { GameProvider } from '@/context/GameContext';
import { MultiRoomProvider } from '@/context/MultiRoomContext';
import GlobalAudio from '@/components/GlobalAudio';
import NativeRuntime from '@/components/NativeRuntime';
import OfflineNotice from '@/components/OfflineNotice';

export const metadata: Metadata = {
  applicationName: 'Juicio Publico',
  title: 'Juicio Publico',
  description: 'Juego social presencial de deduccion y engano',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/img/Juicio-logo.png',
    apple: '/img/Juicio-logo.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Juicio Publico',
  },
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
    url: false,
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
        <NativeRuntime />
        <GameProvider>
          <MultiRoomProvider>
            <OfflineNotice />
            <GlobalAudio />
            {children}
          </MultiRoomProvider>
        </GameProvider>
      </body>
    </html>
  );
}
