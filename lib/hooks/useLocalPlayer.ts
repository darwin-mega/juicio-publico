'use client';

import { useState, useEffect } from 'react';

export function useLocalPlayer() {
  const [playerId, setPlayerId] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('juicio-player-id');
    // Sincronización inicial con la identidad persistida del jugador.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlayerId(stored);
  }, []);

  const savePlayerId = (id: string) => {
    localStorage.setItem('juicio-player-id', id);
    setPlayerId(id);
  };

  return { playerId, savePlayerId };
}
