'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { playSound, playTick } from '@/lib/sounds';

export default function TrialPage() {
  const router = useRouter();
  const { state, dispatch } = useGame();

  const duration = state.config.trialDurationSeconds;
  const [secondsLeft, setSecondsLeft] = useState(duration);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          const next = s - 1;
          // Tick sonoro en los últimos 10 segundos
          if (s <= 11 && s > 1) playTick(s <= 4);
          if (next <= 0) {
            setIsRunning(false);
            clearInterval(intervalRef.current!);
            return 0;
          }
          return next;
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning]);

  useEffect(() => {
    if (state.players.length === 0) {
      router.replace('/');
    }
  }, [state.players.length, router]);

  if (state.players.length === 0) {
    return null;
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const isWarning = secondsLeft <= 30 && secondsLeft > 10;
  const isDanger = secondsLeft <= 10;
  const pct = (secondsLeft / duration) * 100;
  const timeUp = secondsLeft === 0;

  const alivePlayers = state.players.filter((p) => p.isAlive);

  function handleGoToVote() {
    void playSound('ui.confirm');
    dispatch({ type: 'NEXT_PHASE' }); // trial → vote
    router.push('/vote');
  }

  return (
    <main className="page-shell">
      <div className="page-header">
        <div className="phase-badge">⚖️ Juicio Público</div>
        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginLeft: 'auto' }}>
          Ronda {state.round}
        </span>
      </div>

      <div className="page-content">
        <div>
          <h2>Debate abierto</h2>
          <p className="mt-sm">
            Discutí, acusá, defendete. El tiempo corre.
            Cuando termine, hay que votar.
          </p>
        </div>

        {/* Timer */}
        <div className="card" style={{ textAlign: 'center', padding: 'var(--sp-xl)' }}>
          <div className={`timer-display ${isWarning ? 'warning' : isDanger || timeUp ? 'danger' : ''}`}>
            {timeStr}
          </div>
          <div className="timer-label">
            {timeUp ? '¡Tiempo de votar!' : 'tiempo restante'}
          </div>

          {/* Barra de progreso */}
          <div style={{
            marginTop: 'var(--sp-md)',
            height: 4,
            background: 'var(--bg-base)',
            borderRadius: 2,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${pct}%`,
              background: isDanger || timeUp ? 'var(--danger)' : isWarning ? 'var(--warning)' : 'var(--accent)',
              transition: 'width 1s linear, background 0.3s',
            }} />
          </div>

          <div style={{ marginTop: 'var(--sp-md)', display: 'flex', gap: 'var(--sp-sm)', justifyContent: 'center' }}>
            {!isRunning && secondsLeft === duration && (
              <button
                className="btn btn-primary btn-sm"
                style={{ width: 'auto', minWidth: 120 }}
                onClick={() => {
                  void playSound('ui.confirm');
                  setIsRunning(true);
                }}
              >
                ▶ Iniciar
              </button>
            )}
            {isRunning && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ width: 'auto', minWidth: 120 }}
                onClick={() => {
                  void playSound('ui.click');
                  setIsRunning(false);
                }}
              >
                ⏸ Pausar
              </button>
            )}
            {!isRunning && secondsLeft < duration && secondsLeft > 0 && (
              <button
                className="btn btn-primary btn-sm"
                style={{ width: 'auto', minWidth: 120 }}
                onClick={() => {
                  void playSound('ui.confirm');
                  setIsRunning(true);
                }}
              >
                ▶ Reanudar
              </button>
            )}
            {!timeUp && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ width: 'auto' }}
                onClick={() => {
                  void playSound('ui.click');
                  setSecondsLeft(duration);
                  setIsRunning(false);
                }}
              >
                ↺ Reiniciar
              </button>
            )}
          </div>
        </div>

        {/* Aviso de tiempo agotado */}
        {timeUp && (
          <div className="info-box danger" style={{ textAlign: 'center', fontWeight: 600 }}>
            ⏱️ ¡Se acabó el tiempo de debate! Es hora de votar.
          </div>
        )}

        {/* Lista de jugadores vivos */}
        <div>
          <span className="form-label">Jugadores en debate — {alivePlayers.length}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)', marginTop: 'var(--sp-sm)' }}>
            {alivePlayers.map((player) => (
              <div key={player.id} className="player-card">
                <div className="player-avatar">{player.name[0]?.toUpperCase()}</div>
                <span className="player-name">{player.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="page-footer">
        <button className="btn btn-primary" onClick={handleGoToVote}>
          Ir a Votación →
        </button>
      </div>
    </main>
  );
}
