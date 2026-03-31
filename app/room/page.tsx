'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MobileAtmosphereArt from '@/components/MobileAtmosphereArt';
import { useGame } from '@/context/GameContext';
import { ROLE_LABELS } from '@/lib/game/state';
import { useLocalPlayer } from '@/lib/hooks/useLocalPlayer';
import { playSound, startMatchAmbience } from '@/lib/sounds';

export default function RoomPage() {
  const router = useRouter();
  const { state, dispatch } = useGame();
  const { playerId, savePlayerId } = useLocalPlayer();

  useEffect(() => {
    if (state.players.length === 0) {
      router.replace('/setup');
    }
  }, [state.players.length, router]);

  if (state.players.length === 0) {
    return null;
  }

  function handleStartGame() {
    const isInd = state.config.mode === 'individual';
    if (isInd && !playerId) {
      void playSound('game.error');
      alert('Por favor, selecciona quién sos en la lista antes de empezar.');
      return;
    }
    void playSound('game.start');
    void startMatchAmbience({ restart: true });
    dispatch({ type: 'START_GAME' });
    router.push('/reveal');
  }

  return (
    <main className="page-shell" style={{ position: 'relative', overflow: 'hidden' }}>
      <MobileAtmosphereArt variant="room" />

      <div className="page-header" style={{ position: 'relative', zIndex: 1 }}>
        <button className="btn btn-ghost btn-sm" style={{ width: 'auto' }} onClick={() => router.push('/setup')}>
          ← Configuración
        </button>
        <div className="phase-badge">Sala</div>
      </div>

      <div className="page-content" style={{ position: 'relative', zIndex: 1 }}>
        <div>
          <h2>Sala de espera</h2>
          <p className="mt-sm">
            {state.players.length} jugadores · Modo {state.config.mode === 'table' ? 'Mesa' : 'Individual'}
          </p>
        </div>

        {/* Resumen de configuración */}
        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Jugadores</span>
              <span style={{ fontWeight: 600 }}>{state.config.playerCount}</span>
            </div>
            <div className="divider" />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Asesinos</span>
              <span style={{ fontWeight: 600, color: 'var(--role-killer)' }}>{state.config.killerCount}</span>
            </div>
            <div className="divider" />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Debate</span>
              <span style={{ fontWeight: 600 }}>{state.config.trialDurationSeconds}s</span>
            </div>
            <div className="divider" />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Modo</span>
              <span style={{ fontWeight: 600 }}>{state.config.mode === 'table' ? '📱 Mesa' : '👥 Individual'}</span>
            </div>
          </div>
        </div>

        {/* Lista de jugadores */}
        <div>
          <span className="form-label">Jugadores</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)', marginTop: 'var(--sp-sm)' }}>
            {state.players.map((player, i) => {
              const isMe = playerId === player.id;
              return (
                <div 
                  key={player.id} 
                  className={`player-card ${isMe ? 'selected' : ''}`}
                  onClick={() => {
                    if (state.config.mode !== 'individual') return;
                    void playSound('ui.select');
                    savePlayerId(player.id);
                  }}
                  style={{ cursor: state.config.mode === 'individual' ? 'pointer' : 'default' }}
                >
                  <div className="player-avatar" style={{ borderColor: isMe ? 'var(--accent)' : undefined }}>
                    {player.name[0]?.toUpperCase() ?? '?'}
                  </div>
                  <span className="player-name">
                    {player.name} {isMe && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>(Vos)</span>}
                  </span>
                  <span className="text-muted">#{i + 1}</span>
                </div>
              );
            })}
          </div>
          {state.config.mode === 'individual' && !playerId && (
            <div className="info-box accent" style={{ marginTop: 'var(--sp-md)' }}>
              Tocá sobre tu nombre para vincular este dispositivo a tu jugador.
            </div>
          )}
        </div>

        <div className="info-box">
          Los roles se asignan aleatoriamente al iniciar la partida.
          Nadie sabrá quiénes son los demás.
        </div>
      </div>

      <div className="page-footer" style={{ position: 'sticky', zIndex: 2 }}>
        <button className="btn btn-primary" onClick={handleStartGame}>
          Iniciar Partida ✓
        </button>
      </div>
    </main>
  );
}
