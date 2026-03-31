'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { GameMode } from '@/lib/game/state';
import { getRecommendedBalance } from '@/lib/game/rules';
import { playSound } from '@/lib/sounds';

export default function SetupPage() {
  const router = useRouter();
  const { dispatch } = useGame();

  const [playerCount, setPlayerCount] = useState(6);
  const [killerCount, setKillerCount] = useState(1);
  const [copCount, setCopCount] = useState(1);
  const [mode, setMode] = useState<GameMode>('table');
  const [names, setNames] = useState<string[]>(Array(6).fill(''));
  const [trialDuration, setTrialDuration] = useState(120);

  const recommended = getRecommendedBalance(playerCount);

  function handlePlayerCountChange(n: number) {
    void playSound('ui.select', { bypassCooldown: true, volume: 0.6 });
    setPlayerCount(n);
    setNames((prev) => Array(n).fill('').map((_, i) => prev[i] ?? ''));
    // Ajustar roles al nuevo conteo usando el balance recomendado
    const rec = getRecommendedBalance(n);
    setKillerCount(rec.killers);
    setCopCount(rec.cops);
  }

  function handleNameChange(index: number, value: string) {
    setNames((prev) => prev.map((n, i) => (i === index ? value : n)));
  }

  function applyRecommended() {
    void playSound('ui.confirm');
    setKillerCount(recommended.killers);
    setCopCount(recommended.cops);
  }

  function handleConfirm() {
    void playSound('ui.confirm');
    const filledNames = names.map((n, i) => n.trim() || `Jugador ${i + 1}`);
    dispatch({
      type: 'CONFIGURE_GAME',
      config: { mode, playerCount, killerCount, copCount, trialDurationSeconds: trialDuration },
    });
    dispatch({ type: 'SET_PLAYERS', names: filledNames });
    router.push('/room');
  }

  const isValid = playerCount >= 4;
  const maxKillers = Math.max(1, Math.floor(playerCount / 3));

  return (
    <main className="page-shell">
      <div className="page-header">
        <button className="btn btn-ghost btn-sm" style={{ width: 'auto' }} onClick={() => router.push('/')}>
          ← Volver
        </button>
        <div className="phase-badge">Configuración</div>
      </div>

      <div className="page-content">
        <div>
          <h2>Nueva Partida</h2>
          <p className="mt-sm">Configurá los parámetros antes de empezar.</p>
        </div>

        {/* Modo de juego */}
        <div className="form-group">
          <span className="form-label">Modo de juego</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-sm)' }}>
            <div
              className={`mode-option ${mode === 'table' ? 'active' : ''}`}
              onClick={() => {
                void playSound('ui.select');
                setMode('table');
              }}
            >
              <span className="mode-option-title">📱 Mesa</span>
              <span className="mode-option-desc">Un dispositivo circula entre jugadores</span>
            </div>
            <div
              className={`mode-option ${mode === 'individual' ? 'active' : ''}`}
              onClick={() => {
                void playSound('ui.select');
                setMode('individual');
              }}
            >
              <span className="mode-option-title">👥 Individual</span>
              <span className="mode-option-desc">Cada jugador usa su propio celular</span>
            </div>
          </div>
        </div>

        {/* Cantidad de jugadores */}
        <div className="form-group">
          <span className="form-label">Número de jugadores — {playerCount}</span>
          <input
            type="range"
            min={4}
            max={20}
            value={playerCount}
            onChange={(e) => handlePlayerCountChange(Number(e.target.value))}
            style={{ accentColor: 'var(--accent)', width: '100%' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="text-muted">4</span>
            <span className="text-muted">20</span>
          </div>
        </div>

        {/* Balance sugerido */}
        <div
          className="card"
          style={{
            padding: 'var(--sp-md)',
            borderColor: 'var(--border)',
            background: 'var(--bg-elevated)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 'var(--sp-sm)',
            }}
          >
            <span
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              ⚖️ Balance sugerido para {playerCount} jugadores
            </span>
            <button
              className="btn btn-ghost btn-sm"
              style={{ width: 'auto', fontSize: 'var(--text-xs)', padding: '4px 10px' }}
              onClick={applyRecommended}
            >
              Aplicar
            </button>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 'var(--sp-sm)',
              textAlign: 'center',
            }}
          >
            {[
              { label: '🔪 Asesinos', value: recommended.killers, color: 'var(--role-killer)' },
              { label: '🔍 Policías', value: recommended.cops, color: 'var(--role-cop)' },
              { label: '🩺 Doctor', value: recommended.doctor, color: 'var(--role-doctor)' },
              { label: '🏘️ Pueblo', value: recommended.town, color: 'var(--role-town)' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Cantidad de asesinos */}
        <div className="form-group">
          <span className="form-label">Asesinos — {killerCount}</span>
          <input
            type="range"
            min={1}
            max={maxKillers}
            value={killerCount}
            onChange={(e) => setKillerCount(Number(e.target.value))}
            style={{ accentColor: 'var(--danger)', width: '100%' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="text-muted">1</span>
            <span className="text-muted">{maxKillers}</span>
          </div>
        </div>

        {/* Cantidad de policías */}
        <div className="form-group">
          <span className="form-label">Policías — {copCount}</span>
          <input
            type="range"
            min={1}
            max={2}
            value={copCount}
            onChange={(e) => setCopCount(Number(e.target.value))}
            style={{ accentColor: 'var(--role-cop)', width: '100%' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="text-muted">1</span>
            <span className="text-muted">2</span>
          </div>
        </div>

        {/* Tiempo de juicio */}
        <div className="form-group">
          <span className="form-label">
            Tiempo de debate — {trialDuration >= 60 ? `${Math.floor(trialDuration / 60)}min ${trialDuration % 60 > 0 ? `${trialDuration % 60}s` : ''}` : `${trialDuration}s`}
          </span>
          <input
            type="range"
            min={30}
            max={300}
            step={30}
            value={trialDuration}
            onChange={(e) => setTrialDuration(Number(e.target.value))}
            style={{ accentColor: 'var(--accent)', width: '100%' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="text-muted">30s</span>
            <span className="text-muted">5 min</span>
          </div>
        </div>

        {/* Nombres de jugadores */}
        <div className="form-group">
          <span className="form-label">Nombres de jugadores</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
            {Array.from({ length: playerCount }, (_, i) => (
              <input
                key={i}
                className="input"
                placeholder={`Jugador ${i + 1}`}
                value={names[i] ?? ''}
                onChange={(e) => handleNameChange(i, e.target.value)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="page-footer">
        <button className="btn btn-primary" onClick={handleConfirm} disabled={!isValid}>
          Confirmar y ver sala →
        </button>
      </div>
    </main>
  );
}
