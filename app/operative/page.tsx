'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { Player, ROLE_LABELS } from '@/lib/game/state';
import {
  getOperativeAction,
  ROLE_COLORS,
} from '@/lib/modes/table';
import { useLocalPlayer } from '@/lib/hooks/useLocalPlayer';
import { playClick } from '@/lib/sounds';

type ScreenStep = 'handoff' | 'action';

export default function OperativePage() {
  const router = useRouter();
  const { state, dispatch } = useGame();
  const { playerId: localPlayerId } = useLocalPlayer();

  const isIndividual = state.config.mode === 'individual';

  const alivePlayers = state.players.filter((p) => p.isAlive);
  const aliveKillerCount = alivePlayers.filter((p) => p.role === 'killer').length;
  const aliveCopCount = alivePlayers.filter((p) => p.role === 'cop').length;

  const passOrderIds = state.fixedPassOrder.filter(
    (id) => state.players.find((p) => p.id === id)?.isAlive
  );

  const [currentIdx, setCurrentIdx] = useState(0);
  const [screenStep, setScreenStep] = useState<ScreenStep>('handoff');
  const [killerProposals, setKillerProposals] = useState<string[]>([]);
  const [killerActedCount, setKillerActedCount] = useState(0);
  const [copProposals, setCopProposals] = useState<string[]>([]);
  const [copActedCount, setCopActedCount] = useState(0);
  const [collectedKillTarget, setCollectedKillTarget] = useState<string | null>(null);
  const [collectedSaveTarget, setCollectedSaveTarget] = useState<string | null>(null);
  const [collectedInspectTarget, setCollectedInspectTarget] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  if (state.players.length === 0 || state.phase === 'lobby') {
    router.replace('/');
    return null;
  }

  const currentPlayerId = isIndividual ? localPlayerId : passOrderIds[currentIdx];
  const currentPlayer = state.players.find((p) => p.id === currentPlayerId);

  if (!currentPlayer) {
    if (isIndividual) {
      return (
        <main className="page-shell" style={{ justifyContent: 'center', textAlign: 'center' }}>
          <div className="card" style={{ padding: 'var(--sp-xl)' }}>
            <div style={{ fontSize: 44, marginBottom: 16 }}>❓</div>
            <h3>Identidad no vinculada</h3>
            <p className="text-muted" style={{ marginTop: 8 }}>
              Este dispositivo no está vinculado a ningún jugador.
            </p>
            <button className="btn btn-ghost" style={{ marginTop: 24 }} onClick={() => router.push('/room')}>
              ← Volver a sala
            </button>
          </div>
        </main>
      );
    }
    return null;
  }

  const actionType = getOperativeAction(
    currentPlayer,
    aliveKillerCount,
    killerActedCount,
    aliveCopCount,
    copActedCount
  );

  const isLastPlayer = isIndividual ? true : currentIdx === passOrderIds.length - 1;

  function finishAndGoToNews(k: string | null, s: string | null, i: string | null) {
    if (k) dispatch({ type: 'SET_KILL_TARGET', targetId: k });
    if (s) dispatch({ type: 'SET_SAVE_TARGET', targetId: s });
    if (i) dispatch({ type: 'SET_INSPECT_TARGET', targetId: i });
    dispatch({ type: 'NEXT_PHASE' });
    router.push('/news');
  }

  function advancePlayer(k?: string | null, s?: string | null, i?: string | null) {
    const finalKill = k !== undefined ? k : collectedKillTarget;
    const finalSave = s !== undefined ? s : collectedSaveTarget;
    const finalInspect = i !== undefined ? i : collectedInspectTarget;

    if (isLastPlayer || isIndividual) {
      finishAndGoToNews(finalKill, finalSave, finalInspect);
    } else {
      if (k !== undefined && k !== null) setCollectedKillTarget(k);
      if (s !== undefined && s !== null) setCollectedSaveTarget(s);
      if (i !== undefined && i !== null) setCollectedInspectTarget(i);
      setCurrentIdx((idx) => idx + 1);
      setScreenStep('handoff');
      setSelected([]);
    }
  }

  if (!isIndividual && screenStep === 'handoff') {
    return (
      <HandoffScreen
        name={currentPlayer.name}
        idx={currentIdx + 1}
        total={passOrderIds.length}
        onReady={() => { playClick(); setScreenStep('action'); }}
      />
    );
  }

  if (actionType === 'town' || actionType === 'killer-done' || actionType === 'cop-done') {
    return (
      <NeutralScreen
        player={currentPlayer}
        onContinue={() => { playClick(); advancePlayer(); }}
        isLastPlayer={isLastPlayer}
      />
    );
  }

  if (actionType === 'killer-single') {
    return (
      <PlayerPickerScreen
        title="Elegí tu objetivo"
        instruction="Sos el único asesino. Elegí a quién atacar esta noche."
        emoji="🔪"
        color={ROLE_COLORS.killer}
        players={alivePlayers}
        excludeIds={[currentPlayer.id]}
        maxSelectable={1}
        selected={selected}
        onToggle={(id) => setSelected([id])}
        confirmLabel={isLastPlayer ? 'Confirmar y cerrar operativo' : 'Confirmar ataque'}
        canConfirm={selected.length === 1}
        onConfirm={() => {
          playClick();
          setKillerActedCount((c) => c + 1);
          advancePlayer(selected[0]);
        }}
      />
    );
  }

  if (actionType === 'killer-propose') {
    const maxProp = Math.min(3, alivePlayers.length - 1);
    return (
      <PlayerPickerScreen
        title="Proponer objetivos"
        instruction={`Sos el primer asesino. Proponé hasta ${maxProp} candidatos.`}
        emoji="🔪"
        color={ROLE_COLORS.killer}
        players={alivePlayers}
        excludeIds={[currentPlayer.id]}
        maxSelectable={maxProp}
        selected={selected}
        onToggle={(id) =>
          setSelected((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < maxProp ? [...prev, id] : prev
          )
        }
        confirmLabel="Confirmar propuestas"
        canConfirm={selected.length >= 1}
        onConfirm={() => {
          playClick();
          setKillerProposals(selected);
          setKillerActedCount((c) => c + 1);
          advancePlayer();
        }}
      />
    );
  }

  if (actionType === 'killer-vote') {
    const proposals = killerProposals.length > 0
      ? alivePlayers.filter((p) => killerProposals.includes(p.id))
      : alivePlayers.filter((p) => p.id !== currentPlayer.id);
    return (
      <PlayerPickerScreen
        title="Elegir objetivo final"
        instruction="Tu cómplice propuso candidatos. Vos elegís quién cae."
        emoji="🔪"
        color={ROLE_COLORS.killer}
        players={proposals}
        excludeIds={[]}
        maxSelectable={1}
        selected={selected}
        onToggle={(id) => setSelected([id])}
        confirmLabel={isLastPlayer ? 'Confirmar y cerrar operativo' : 'Confirmar objetivo'}
        canConfirm={selected.length === 1}
        onConfirm={() => {
          playClick();
          setKillerActedCount((c) => c + 1);
          advancePlayer(selected[0]);
        }}
      />
    );
  }

  if (actionType === 'doctor') {
    return (
      <PlayerPickerScreen
        title="Proteger a alguien"
        instruction="Elegí a quién proteger esta noche."
        emoji="🩺"
        color={ROLE_COLORS.doctor}
        players={alivePlayers}
        excludeIds={[]}
        maxSelectable={1}
        selected={selected}
        onToggle={(id) => setSelected([id])}
        confirmLabel={isLastPlayer ? 'Confirmar y cerrar operativo' : 'Confirmar protección'}
        canConfirm={selected.length === 1}
        onConfirm={() => { playClick(); advancePlayer(undefined, selected[0]); }}
      />
    );
  }

  // ── POLICÍA: selecciona objetivo pero NO ve el resultado ──
  // El resultado se revela en la sección de noticias para todos.
  if (actionType === 'cop-single' || actionType === 'cop-propose' || actionType === 'cop-vote') {
    let pickable = alivePlayers;
    let instr = '¿A quién querés investigar esta noche? El resultado se revelará mañana públicamente.';
    let maxS = 1;

    if (actionType === 'cop-propose') {
      const maxProp = Math.min(3, alivePlayers.length - 1);
      instr = `Proponé hasta ${maxProp} sospechosos para que tu compañero investigue.`;
      maxS = maxProp;
    } else if (actionType === 'cop-vote') {
      pickable = copProposals.length > 0
        ? alivePlayers.filter((p) => copProposals.includes(p.id))
        : alivePlayers.filter((p) => p.id !== currentPlayer.id);
      instr = 'Elegí quién será el investigado final. El resultado se conocerá mañana.';
    }

    return (
      <PlayerPickerScreen
        title="Investigación"
        instruction={instr}
        emoji="🔍"
        color={ROLE_COLORS.cop}
        players={pickable}
        excludeIds={actionType !== 'cop-vote' ? [currentPlayer.id] : []}
        maxSelectable={maxS}
        selected={selected}
        onToggle={(id) => {
          if (maxS === 1) setSelected([id]);
          else setSelected((p) =>
            p.includes(id) ? p.filter((x) => x !== id) : p.length < maxS ? [...p, id] : p
          );
        }}
        confirmLabel={
          actionType === 'cop-propose' ? 'Confirmar propuestas' :
          isLastPlayer ? 'Confirmar y cerrar operativo' : 'Confirmar investigación'
        }
        canConfirm={actionType === 'cop-propose' ? selected.length >= 1 : selected.length === 1}
        onConfirm={() => {
          playClick();
          if (actionType === 'cop-propose') {
            setCopProposals(selected);
            setCopActedCount((c) => c + 1);
            advancePlayer();
          } else {
            // Guardar el objetivo — el resultado lo verán todos en noticias
            setCopActedCount((c) => c + 1);
            advancePlayer(undefined, undefined, selected[0]);
          }
        }}
      />
    );
  }

  return null;
}

// ─── Sub-componentes ────────────────────────────────────────

function HandoffScreen({ name, idx, total, onReady }: {
  name: string; idx: number; total: number; onReady: () => void;
}) {
  return (
    <main className="page-shell" style={{ justifyContent: 'center', textAlign: 'center' }}>
      <div className="anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-lg)', alignItems: 'center' }}>
        <div className="phase-badge">🌙 Clandestinidad</div>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          fontSize: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'float 3s ease-in-out infinite',
        }}>📱</div>
        <h2>Pasá el dispositivo</h2>
        <p>Entregalo a <strong style={{ color: 'var(--accent)' }}>{name}</strong></p>
        <p className="text-muted" style={{ fontSize: 'var(--text-xs)' }}>
          {idx} de {total} jugadores · No muestres la pantalla
        </p>
        <button className="btn btn-primary" style={{ minWidth: 220 }} onClick={onReady}>
          Soy {name} — Empezar
        </button>
      </div>
    </main>
  );
}

function NeutralScreen({ player, onContinue, isLastPlayer }: {
  player: Player; onContinue: () => void; isLastPlayer: boolean;
}) {
  const [done, setDone] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDone(true), 2800); return () => clearTimeout(t); }, []);
  const texts = ['Consultando archivos...', 'Monitoreando cámaras...', 'Verificando movimientos...', 'Diligencias completadas.'];
  const [tIdx, setTIdx] = useState(0);
  useEffect(() => {
    if (done) return;
    const i = setInterval(() => setTIdx((v) => (v + 1) % (texts.length - 1)), 900);
    return () => clearInterval(i);
  }, [done]);

  return (
    <main className="page-shell">
      <div className="page-header"><div className="phase-badge">📋 Turno</div></div>
      <div className="page-content" style={{ justifyContent: 'center', textAlign: 'center' }}>
        <div className={`card anim-fade-in`} style={{ padding: 'var(--sp-xl)' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>{done ? '📁' : '🛰️'}</div>
          <h3>{player.name}</h3>
          <p className="text-muted" style={{ marginTop: 8 }}>{done ? texts[texts.length - 1] : texts[tIdx]}</p>
          {!done && <div className="loading-bar" style={{ marginTop: 24 }}><div className="loading-bar-progress" /></div>}
        </div>
      </div>
      <div className="page-footer">
        <button className="btn btn-primary" onClick={onContinue} disabled={!done}>
          {isLastPlayer ? 'Finalizar operativo →' : 'Continuar →'}
        </button>
      </div>
    </main>
  );
}

function PlayerPickerScreen({
  title, instruction, emoji, color, players, excludeIds,
  maxSelectable, selected, onToggle, confirmLabel, canConfirm, onConfirm,
}: {
  title: string; instruction: string; emoji: string; color: string;
  players: Player[]; excludeIds: string[]; maxSelectable: number;
  selected: string[]; onToggle: (id: string) => void;
  confirmLabel: string; canConfirm: boolean; onConfirm: () => void;
}) {
  const pickable = players.filter((p) => !excludeIds.includes(p.id));
  const isDanger = color === ROLE_COLORS.killer;
  return (
    <main className="page-shell">
      <div className="page-header">
        <div className="phase-badge" style={{ color }}>{emoji} {title}</div>
        <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          {selected.length}/{maxSelectable}
        </span>
      </div>
      <div className="page-content">
        <div className="card anim-fade-in" style={{ borderColor: color }}>
          <p style={{ fontSize: 'var(--text-sm)' }}>{instruction}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
          {pickable.map((p, i) => (
            <button key={p.id} onClick={() => onToggle(p.id)}
              style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left',
                animation: `slideUp 0.3s ${i * 0.05}s both` }}>
              <div className={`player-card ${selected.includes(p.id) ? 'selected' : ''}`}
                style={selected.includes(p.id) ? { borderColor: color } : {}}>
                <div className="player-avatar" style={{ borderColor: selected.includes(p.id) ? color : undefined }}>
                  {p.name[0]?.toUpperCase()}
                </div>
                <span className="player-name">{p.name}</span>
                {selected.includes(p.id) && <span style={{ color, marginLeft: 'auto', fontSize: 18 }}>✓</span>}
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="page-footer">
        <button className={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`}
          disabled={!canConfirm} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </main>
  );
}
