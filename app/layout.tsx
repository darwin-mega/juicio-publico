import type { Metadata } from 'next';
import './globals.css';
import { GameProvider } from '@/context/GameContext';
import { MultiRoomProvider } from '@/context/MultiRoomContext';

export const metadata: Metadata = {
  title: 'Juicio Público',
  description: 'Juego social presencial de deducción y engaño',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <GameProvider>
          <MultiRoomProvider>
            {children}
          </MultiRoomProvider>
        </GameProvider>
      </body>
    </html>
  );
}
