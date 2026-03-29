'use client';

// ============================================================
// app/reveal/page.tsx
// Secuencia de revelación privada de roles — Modo Mesa e Individual.
//
// Flujo por jugador (estado local, sin tocar GameContext):
//   'handoff' → pantalla neutra "Pasá el dispositivo a X"
//   'reveal'  → pantalla privada con rol, descripción y compañeros
//
// Cuando todos los jugadores vieron su rol → navega a /operative.
// ============================================================

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { ROLE_LABELS } from '@/lib/game/state';
import { useLocalPlayer } from '@/lib/hooks/useLocalPlayer';
import {
  ROLE_DESCRIPTIONS,
  ROLE_EMOJIS,
  ROLE_COLORS,
  getTeammates,
  getTeammateLabel,
} from '@/lib/modes/table';

type RevealStep = 'handoff' | 'reveal';

export default function RevealPage() {
  const router = useRouter();
  const { state } = useGame();
  const { playerId } = useLocalPlayer();

  const [playerIndex, setPlayerIndex] = useState(0);
  const [step, setStep] = useState<RevealStep>('handoff');

  const isIndividual = state.config.mode === 'individual';
  const noGame = state.players.length === 0 || state.phase === 'lobby';
  const needsIdentity = isIndividual && !playerId;

  // ── TODOS LOS HOOKS PRIMERO — antes de cualquier return ───
  // En modo individual, siempre saltamos el handoff
  useEffect(() => {
    if (isIndividual) setStep('reveal');
  }, [isIndividual]);

  // Redirecciones (via useEffect para no romper las reglas de hooks)
  useEffect(() => {
    if (noGame) router.replace('/');
  }, [noGame, router]);

  useEffect(() => {
    if (!noGame && needsIdentity) router.replace('/room');
  }, [noGame, needsIdentity, router]);
  // ─────────────────────────────────────────────────────────

  // Pantalla de espera mientras se procesa el redirect
  if (noGame || needsIdentity) {
    return null;
  }

  // Usar fixedPassOrder para el modo mesa; en individual, el orden de players
  const passOrder = isIndividual
    ? state.players
    : state.fixedPassOrder.map((id) => state.players.find((p) => p.id === id)!);

  // Índice efectivo
  const effectiveIndex = isIndividual
    ? passOrder.findIndex((p) => p.id === playerId)
    : playerIndex;

  const currentPlayer = passOrder[effectiveIndex >= 0 ? effectiveIndex : 0];
  const isLastPlayer = isIndividual ? true : playerIndex === passOrder.length - 1;

  if (!currentPlayer) return null;

  const teammates = getTeammates(currentPlayer, passOrder);
  const teammateLabel = getTeammateLabel(currentPlayer.role);
  const roleColor = ROLE_COLORS[currentPlayer.role];
  const roleEmoji = ROLE_EMOJIS[currentPlayer.role];
  const roleDesc = ROLE_DESCRIPTIONS[currentPlayer.role];

  function handleReady() {
    if (isLastPlayer) {
      router.push('/operative');
    } else {
      setPlayerIndex((i) => i + 1);
      setStep('handoff');
    }
  }

  // ── Pantalla de traspaso (neutra) ──────────────────────────
  if (!isIndividual && step === 'handoff') {
    return (
      <main className="page-shell" style={{ justifyContent: 'center', textAlign: 'center' }}>
        {/* Indicador de progreso */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 'var(--sp-xl)' }}>
          {passOrder.map((_, i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background:
                  i < playerIndex
                    ? 'var(--success)'
                    : i === playerIndex
                    ? 'var(--accent)'
                    : 'var(--border)',
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-lg)', alignItems: 'center' }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 40,
            }}
          >
            📱
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
            <h2>Pasá el dispositivo</h2>
            <p>
              Es el turno de{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{currentPlayer.name}</strong>
            </p>
            <p className="text-muted" style={{ fontSize: 'var(--text-sm)' }}>
              No muestres la pantalla mientras lo pasás.
            </p>
          </div>

          <span className="text-muted" style={{ fontSize: 'var(--text-sm)' }}>
            Jugador {playerIndex + 1} de {passOrder.length}
          </span>

          <button
            className="btn btn-primary"
            style={{ minWidth: 240 }}
            onClick={() => setStep('reveal')}
          >
            Soy {currentPlayer.name} — Mostrar mi rol
          </button>
        </div>
      </main>
    );
  }

  // ── Pantalla de revelación (privada) ─────────────────────
  return (
    <main className="page-shell">
      <div className="page-header">
        <div className="phase-badge">Revelación de rol</div>
        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginLeft: 'auto' }}>
          {isIndividual ? currentPlayer.name : `${playerIndex + 1}/${passOrder.length}`}
        </span>
      </div>

      <div className="page-content">
        {/* Tarjeta principal del rol */}
        <div className="card" style={{ borderColor: roleColor, textAlign: 'center', padding: 'var(--sp-xl)' }}>
          {/* Avatar */}
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'var(--bg-elevated)',
              border: `2px solid ${roleColor}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: '0 auto var(--sp-md)',
            }}
          >
            {currentPlayer.name[0]?.toUpperCase()}
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: 4 }}>
            Tu nombre en el juego
          </p>
          <h3 style={{ marginBottom: 'var(--sp-md)' }}>{currentPlayer.name}</h3>

          <div className="divider" style={{ marginBottom: 'var(--sp-md)' }} />

          <div style={{ fontSize: 48, marginBottom: 'var(--sp-sm)' }}>{roleEmoji}</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: 4 }}>
            Tu rol
          </p>
          <h2 style={{ color: roleColor, fontSize: 'var(--text-xl)', marginBottom: 'var(--sp-md)' }}>
            {ROLE_LABELS[currentPlayer.role]}
          </h2>
        </div>

        {/* Descripción del rol */}
        <div className="card-section">
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
            {roleDesc}
          </p>
        </div>

        {/* Compañeros de equipo */}
        {teammates.length > 0 && (
          <div style={{ textAlign: 'center' }}>
            <span
              className="form-label"
              style={{ color: roleColor, display: 'block', marginBottom: 'var(--sp-md)' }}
            >
              {teammateLabel}{' '}
              <strong>{teammates.map((t) => t.name).join(', ')}</strong>
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
              {teammates.map((tm) => (
                <div key={tm.id} className="player-card">
                  <div className="player-avatar" style={{ borderColor: roleColor }}>
                    {tm.name[0]?.toUpperCase()}
                  </div>
                  <span className="player-name">{tm.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mensaje si es el único de su rol */}
        {teammates.length === 0 &&
          (currentPlayer.role === 'killer' || currentPlayer.role === 'cop') && (
            <div className="info-box">
              Sos el único {ROLE_LABELS[currentPlayer.role].toLowerCase()} en esta partida. Actuá solo.
            </div>
          )}
      </div>

      {/* Footer */}
      <div className="page-footer">
        <button className="btn btn-primary" onClick={handleReady}>
          {isIndividual
            ? 'Ir al operativo →'
            : isLastPlayer
            ? 'Todos listos — Comenzar partida →'
            : 'Ocultar y pasar al siguiente →'}
        </button>
      </div>
    </main>
  );
}
