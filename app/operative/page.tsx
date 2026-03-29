'use client';

// ============================================================
// app/operative/page.tsx — Operativo Encubierto
//
// PROTECCIÓN DE IDENTIDAD:
//   Todos — pueblo, asesinos, doctor, policía — hacen
//   exactamente las mismas interacciones:
//     1. Handoff → "Soy X — Empezar"
//     2. Picker  → tocar un jugador
//     3. Confirmar → botón de confirmar
//   No hay timer de espera. La selección del pueblo no afecta el juego.
// ============================================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { Player } from '@/lib/game/state';
import { getOperativeAction, ROLE_COLORS } from '@/lib/modes/table';
import { useLocalPlayer } from '@/lib/hooks/useLocalPlayer';
import { playClick, playSelect, playDeselect, playHandoff, playConfirm, playTransition } from '@/lib/sounds';

export default function OperativePage() {
  const router = useRouter();
  const { state, dispatch } = useGame();
  const { playerId: localPlayerId } = useLocalPlayer();

  const isIndividual = state.config.mode === 'individual';
  const alivePlayers = state.players.filter((p) => p.isAlive);
  const aliveKillerCount = alivePlayers.filter((p) => p.role === 'killer').length;
  const aliveCopCount    = alivePlayers.filter((p) => p.role === 'cop').length;

  const passOrderIds = state.fixedPassOrder.filter(
    (id) => state.players.find((p) => p.id === id)?.isAlive
  );

  const [currentIdx,             setCurrentIdx]            = useState(0);
  const [showHandoff,            setShowHandoff]           = useState(!isIndividual);
  const [killerProposals,        setKillerProposals]       = useState<string[]>([]);
  const [killerActedCount,       setKillerActedCount]      = useState(0);
  const [copActedCount,          setCopActedCount]         = useState(0);
  const [collectedKillTarget,    setCollectedKillTarget]   = useState<string | null>(null);
  const [collectedSaveTarget,    setCollectedSaveTarget]   = useState<string | null>(null);
  const [collectedInspectTarget, setCollectedInspectTarget]= useState<string | null>(null);
  const [selected,               setSelected]              = useState<string[]>([]);

  if (state.players.length === 0 || state.phase === 'lobby') {
    router.replace('/');
    return null;
  }

  const currentPlayerId = isIndividual ? localPlayerId : passOrderIds[currentIdx];
  const currentPlayer   = state.players.find((p) => p.id === currentPlayerId);

  if (!currentPlayer) {
    if (isIndividual) return (
      <main className="page-shell" style={{ justifyContent: 'center', textAlign: 'center' }}>
        <div className="card" style={{ padding: 'var(--sp-xl)' }}>
          <div style={{ fontSize: 44, marginBottom: 16 }}>❓</div>
          <h3>Identidad no vinculada</h3>
          <p className="text-muted" style={{ marginTop: 8 }}>Este dispositivo no está vinculado a ningún jugador.</p>
          <button className="btn btn-ghost" style={{ marginTop: 24 }} onClick={() => router.push('/room')}>← Volver a sala</button>
        </div>
      </main>
    );
    return null;
  }

  const actionType  = getOperativeAction(currentPlayer, aliveKillerCount, killerActedCount, aliveCopCount, copActedCount);
  const isLastPlayer = isIndividual ? true : currentIdx === passOrderIds.length - 1;

  function finishAndGoToNews(k: string | null, s: string | null, i: string | null) {
    if (k) dispatch({ type: 'SET_KILL_TARGET',    targetId: k });
    if (s) dispatch({ type: 'SET_SAVE_TARGET',    targetId: s });
    if (i) dispatch({ type: 'SET_INSPECT_TARGET', targetId: i });
    dispatch({ type: 'NEXT_PHASE' });
    playTransition();
    router.push('/news');
  }

  function advance(k?: string | null, s?: string | null, i?: string | null) {
    const fk = k !== undefined ? k : collectedKillTarget;
    const fs = s !== undefined ? s : collectedSaveTarget;
    const fi = i !== undefined ? i : collectedInspectTarget;
    if (isLastPlayer || isIndividual) {
      finishAndGoToNews(fk, fs, fi);
    } else {
      if (k != null) setCollectedKillTarget(k);
      if (s != null) setCollectedSaveTarget(s);
      if (i != null) setCollectedInspectTarget(i);
      setCurrentIdx((n) => n + 1);
      setShowHandoff(true);
      setSelected([]);
    }
  }

  // ── 1. Pantalla de handoff ───────────────────────────────
  if (showHandoff) {
    return (
      <main className="page-shell" style={{ justifyContent: 'center', textAlign: 'center' }}>
        <div className="anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-lg)', alignItems: 'center' }}>
          <div className="phase-badge">🌙 Clandestinidad</div>
          <div style={{
            width: 88, height: 88, borderRadius: '50%',
            background: 'var(--bg-surface)', border: '2px solid var(--border)',
            fontSize: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'float 3s ease-in-out infinite',
          }}>📱</div>
          <div>
            <h2>Pasá el dispositivo</h2>
            <p style={{ marginTop: 8 }}>
              Entregalo a <strong style={{ color: 'var(--accent)' }}>{currentPlayer.name}</strong>
            </p>
            <p className="text-muted" style={{ fontSize: 'var(--text-xs)', marginTop: 6 }}>
              {currentIdx + 1} de {passOrderIds.length} · No muestres la pantalla
            </p>
          </div>
          <button
            className="btn btn-primary"
            style={{ minWidth: 240, fontSize: 'var(--text-md)' }}
            onClick={() => { playHandoff(); setShowHandoff(false); }}
          >
            Soy {currentPlayer.name} — Empezar
          </button>
        </div>
      </main>
    );
  }

  // ── 2. Pantalla de acción (todos ven el mismo tipo de UI) ─

  // Pueblo y roles extras → picker "de patrullaje" sin efecto real
  const isNeutral = actionType === 'town' || actionType === 'killer-done' || actionType === 'cop-done';
  if (isNeutral) {
    return (
      <PickerScreen
        title="Turno nocturno"
        instruction="Seleccioná un jugador para pasar al siguiente."
        emoji="🌙"
        color="var(--border)"
        players={alivePlayers.filter((p) => p.id !== currentPlayer.id)}
        maxSelectable={1}
        selected={selected}
        onToggle={(id) => {
          selected.includes(id) ? (playDeselect(), setSelected([])) : (playSelect(), setSelected([id]));
        }}
        confirmLabel={isLastPlayer ? 'Finalizar →' : 'Continuar →'}
        onConfirm={() => { playConfirm(); advance(); }}
        idx={currentIdx + 1}
        total={passOrderIds.length}
      />
    );
  }

  if (actionType === 'killer-single') {
    return (
      <PickerScreen
        title="Elegí tu objetivo"
        instruction="Esta noche, ¿a quién atacás?"
        emoji="🔪"
        color={ROLE_COLORS.killer}
        players={alivePlayers.filter((p) => p.id !== currentPlayer.id)}
        maxSelectable={1}
        selected={selected}
        onToggle={(id) => {
          selected.includes(id) ? (playDeselect(), setSelected([])) : (playSelect(), setSelected([id]));
        }}
        confirmLabel={isLastPlayer ? 'Confirmar y cerrar →' : 'Confirmar ataque →'}
        onConfirm={() => {
          playConfirm();
          setKillerActedCount((c) => c + 1);
          advance(selected[0]);
        }}
        idx={currentIdx + 1}
        total={passOrderIds.length}
      />
    );
  }

  if (actionType === 'killer-propose') {
    const max = Math.min(3, alivePlayers.length - 2);
    return (
      <PickerScreen
        title="Proponer candidatos"
        instruction={`Elegí hasta ${max} posibles objetivos. Tu cómplice decide el final.`}
        emoji="🔪"
        color={ROLE_COLORS.killer}
        players={alivePlayers.filter((p) => p.id !== currentPlayer.id)}
        maxSelectable={max}
        selected={selected}
        onToggle={(id) => {
          if (selected.includes(id)) { playDeselect(); setSelected((p) => p.filter((x) => x !== id)); }
          else if (selected.length < max) { playSelect(); setSelected((p) => [...p, id]); }
        }}
        confirmLabel="Enviar propuestas →"
        onConfirm={() => {
          playConfirm();
          setKillerProposals(selected);
          setKillerActedCount((c) => c + 1);
          advance();
        }}
        idx={currentIdx + 1}
        total={passOrderIds.length}
      />
    );
  }

  if (actionType === 'killer-vote') {
    const candidates = killerProposals.length > 0
      ? alivePlayers.filter((p) => killerProposals.includes(p.id))
      : alivePlayers.filter((p) => p.id !== currentPlayer.id);
    return (
      <PickerScreen
        title="Objetivo final"
        instruction="Tu cómplice propuso estos candidatos. Vos elegís quién cae."
        emoji="🔪"
        color={ROLE_COLORS.killer}
        players={candidates}
        maxSelectable={1}
        selected={selected}
        onToggle={(id) => {
          selected.includes(id) ? (playDeselect(), setSelected([])) : (playSelect(), setSelected([id]));
        }}
        confirmLabel={isLastPlayer ? 'Confirmar y cerrar →' : 'Confirmar objetivo →'}
        onConfirm={() => {
          playConfirm();
          setKillerActedCount((c) => c + 1);
          advance(selected[0]);
        }}
        idx={currentIdx + 1}
        total={passOrderIds.length}
      />
    );
  }

  if (actionType === 'doctor') {
    return (
      <PickerScreen
        title="Proteger"
        instruction="¿A quién protegés esta noche?"
        emoji="🩺"
        color={ROLE_COLORS.doctor}
        players={alivePlayers}
        maxSelectable={1}
        selected={selected}
        onToggle={(id) => {
          selected.includes(id) ? (playDeselect(), setSelected([])) : (playSelect(), setSelected([id]));
        }}
        confirmLabel={isLastPlayer ? 'Confirmar y cerrar →' : 'Confirmar protección →'}
        onConfirm={() => { playConfirm(); advance(undefined, selected[0]); }}
        idx={currentIdx + 1}
        total={passOrderIds.length}
      />
    );
  }

  if (actionType === 'cop') {
    const isTwoCopsFirst = aliveCopCount > 1 && copActedCount === 0;
    return (
      <PickerScreen
        title="Investigar"
        instruction={
          isTwoCopsFirst
            ? 'Elegí un sospechoso. Tu compañero lo confirmará.'
            : 'El resultado se revelará mañana para todos.'
        }
        emoji="🔍"
        color={ROLE_COLORS.cop}
        players={alivePlayers.filter((p) => p.id !== currentPlayer.id)}
        maxSelectable={1}
        selected={selected}
        onToggle={(id) => {
          selected.includes(id) ? (playDeselect(), setSelected([])) : (playSelect(), setSelected([id]));
        }}
        confirmLabel={isLastPlayer ? 'Confirmar y cerrar →' : 'Confirmar investigación →'}
        onConfirm={() => {
          playConfirm();
          if (isTwoCopsFirst) {
            setKillerProposals(selected);
            setCopActedCount((c) => c + 1);
            advance();
          } else {
            setCopActedCount((c) => c + 1);
            advance(undefined, undefined, selected[0]);
          }
        }}
        idx={currentIdx + 1}
        total={passOrderIds.length}
      />
    );
  }

  return null;
}

// ── PickerScreen ─────────────────────────────────────────────
// Pantalla de selección limpia — sin timer, con feedback visual
function PickerScreen({
  title, instruction, emoji, color, players,
  maxSelectable, selected, onToggle,
  confirmLabel, onConfirm, idx, total,
}: {
  title: string; instruction: string; emoji: string; color: string;
  players: Player[]; maxSelectable: number;
  selected: string[]; onToggle: (id: string) => void;
  confirmLabel: string; onConfirm: () => void;
  idx: number; total: number;
}) {
  const canConfirm = selected.length >= 1;
  const isDanger   = color === ROLE_COLORS.killer;

  return (
    <main className="page-shell">
      <div className="page-header">
        <div className="phase-badge" style={{ color }}>{emoji} {title}</div>
        <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          {idx}/{total}
        </span>
      </div>
      <div className="page-content">
        {/* Instrucción */}
        <div className="card anim-fade-in" style={{ borderColor: color, padding: 'var(--sp-md)' }}>
          <p style={{ fontSize: 'var(--text-sm)' }}>{instruction}</p>
        </div>

        {/* Lista de jugadores */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
          {players.map((p, i) => {
            const isSelected = selected.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => onToggle(p.id)}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  textAlign: 'left', cursor: 'pointer',
                  animation: `slideUp 0.28s ${i * 0.04}s both`,
                }}
              >
                <div
                  className={`player-card ${isSelected ? 'selected' : ''}`}
                  style={{
                    borderColor: isSelected ? color : undefined,
                    transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                    transition: 'transform 0.15s, border-color 0.15s, background 0.15s',
                    background: isSelected ? `${color}18` : undefined,
                  }}
                >
                  <div
                    className="player-avatar"
                    style={{
                      borderColor: isSelected ? color : undefined,
                      transition: 'border-color 0.15s',
                    }}
                  >
                    {p.name[0]?.toUpperCase()}
                  </div>
                  <span className="player-name">{p.name}</span>
                  <span style={{
                    marginLeft: 'auto', color, fontSize: 20,
                    opacity: isSelected ? 1 : 0,
                    transform: isSelected ? 'scale(1)' : 'scale(0.5)',
                    transition: 'opacity 0.15s, transform 0.15s',
                  }}>✓</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="page-footer">
        <button
          className={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`}
          disabled={!canConfirm}
          onClick={onConfirm}
          style={{ transition: 'opacity 0.2s, transform 0.1s' }}
        >
          {canConfirm ? confirmLabel : 'Seleccioná un jugador'}
        </button>
      </div>
    </main>
  );
}
