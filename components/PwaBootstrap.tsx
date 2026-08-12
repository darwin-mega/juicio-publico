'use client';

import { useEffect } from 'react';

export default function PwaBootstrap() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });
      } catch (error) {
        console.error('[pwa] No se pudo registrar el modo offline', error);
      }
    };

    void register();
  }, []);

  return null;
}
