'use client';

import { useState, useEffect } from 'react';
import { toggleMute, getIsMuted, startBackgroundMusic } from '@/lib/sounds';

export default function GlobalAudio() {
  const [muted, setMuted] = useState(getIsMuted());

  // Al montar, intentamos iniciar la música
  useEffect(() => {
    const hasSeenIntro = sessionStorage.getItem('jp_intro_seen');
    const isInGame = window.location.pathname.includes('/multi/') || 
                     window.location.pathname.includes('/room') ||
                     window.location.pathname.includes('/join/');
    
    // Si ya hubo una interacción previa o estamos en una partida, intentamos arrancar
    if (hasSeenIntro || isInGame) {
      startBackgroundMusic();
    }
  }, []);

  const handleToggle = () => {
    const newState = toggleMute();
    setMuted(newState);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 'var(--sp-md)',
      right: 'var(--sp-md)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--sp-sm)',
    }}>
      <button 
        onClick={handleToggle}
        className="btn-glass"
        style={{
          width: 44,
          height: 44,
          padding: 0,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}
        title={muted ? "Activar sonido" : "Silenciar"}
      >
        {muted ? '🔇' : '🔊'}
      </button>
    </div>
  );
}
