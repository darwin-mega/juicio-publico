'use client';

// ============================================================
// app/operative/page.tsx
// Operativo Encubierto — Modo Mesa + Individual
//
// MODO MESA:
//   - El dispositivo pasa por TODOS los jugadores vivos en
//     orden fijo (fixedPassOrder).
//   - Cada jugador ve su acción según su rol.
//   - Pueblo y roles sin acción pendiente ven pantalla neutra.
//   - Las propuestas de asesinos/policías persisten en estado
//     local del componente entre jugadores.
//   - Al terminar el último jugador, se despachan las acciones
//     y se navega a /news.
//
// MODO INDIVIDUAL:
//   - Cada dispositivo ve solo la acción de su jugador.
//   - Al confirmar, despacha su acción y navega directamente.
// ============================================================

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { Player, ROLE_LABELS } from '@/lib/game/state';
import {
  evaluateInspection,
  getOperativeAction,
  ROLE_COLORS,
  OperativeActionType,
} from '@/lib/modes/table';
import { useLocalPlayer } from '@/lib/hooks/useLocalPlayer';

type ScreenStep = 'handoff' | 'action';
type CopScreenState = 'picking' | 'result';

export default function OperativePage() {
  const router = useRouter();
  const { state, dispatch } = useGame();
  const { playerId: localPlayerId } = useLocalPlayer();

  const isIndividual = state.config.mode === 'individual';

  // Jugadores vivos en orden fijo (solo los que siguen vivos)
  const alivePlayers = state.players.filter((p) => p.isAlive);
  const aliveKillerCount = alivePlayers.filter((p) => p.role === 'killer').length;
  const aliveCopCount = alivePlayers.filter((p) => p.role === 'cop').length;

  // Orden fijo filtrado solo por jugadores vivos
  const passOrderIds = state.fixedPassOrder.filter(
    (id) => state.players.find((p) => p.id === id)?.isAlive
  );

  // --- Estado de navegación ---
  const [currentIdx, setCurrentIdx] = useState(0);
  const [screenStep, setScreenStep] = useState<ScreenStep>('handoff');

  // --- Acumuladores de propuestas (persisten entre jugadores) ---
  const [killerProposals, setKillerProposals] = useState<string[]>([]);
  const [killerActedCount, setKillerActedCount] = useState(0);
  const [copProposals, setCopProposals] = useState<string[]>([]);
  const [copActedCount, setCopActedCount] = useState(0);

  // --- Acciones recolectadas durante la ronda ---
  const [collectedKillTarget, setCollectedKillTarget] = useState<string | null>(null);
  const [collectedSaveTarget, setCollectedSaveTarget] = useState<string | null>(null);
  const [collectedInspectTarget, setCollectedInspectTarget] = useState<string | null>(null);

  // --- Estado de resultado de investigación ---
  const [inspectResultType, setInspectResultType] = useState<'killer' | 'innocent' | null>(null);
  const [copScreenState, setCopScreenState] = useState<CopScreenState>('picking');

  // --- Selección temporal (UI local) ---
  const [selected, setSelected] = useState<string[]>([]);

  // Guard: si no hay partida cargada
  if (state.players.length === 0 || state.phase === 'lobby') {
    router.replace('/');
    return null;
  }

  // Identificar jugador actual
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

  // --- Lógica de avance ---

  function finishAndGoToNews(k: string | null, s: string | null, i: string | null) {
    if (k) dispatch({ type: 'SET_KILL_TARGET', targetId: k });
    if (s) dispatch({ type: 'SET_SAVE_TARGET', targetId: s });
    if (i) dispatch({ type: 'SET_INSPECT_TARGET', targetId: i });
    dispatch({ type: 'NEXT_PHASE' }); // operative → news (resuelve acciones)
    router.push('/news');
  }

  function advancePlayer(
    k?: string | null,
    s?: string | null,
    i?: string | null
  ) {
    // Calcular valores finales ANTES de cualquier setState
    const finalKill    = k !== undefined ? k : collectedKillTarget;
    const finalSave    = s !== undefined ? s : collectedSaveTarget;
    const finalInspect = i !== undefined ? i : collectedInspectTarget;

    if (isLastPlayer || isIndividual) {
      // Ir directo al cierre con los valores finales ya computados
      finishAndGoToNews(finalKill, finalSave, finalInspect);
    } else {
      // Guardar los valores acumulados Y avanzar al siguiente jugador
      if (k !== undefined && k !== null) setCollectedKillTarget(k);
      if (s !== undefined && s !== null) setCollectedSaveTarget(s);
      if (i !== undefined && i !== null) setCollectedInspectTarget(i);
      setCurrentIdx((idx) => idx + 1);
      setScreenStep('handoff');
      setSelected([]);
      setCopScreenState('picking');
    }
  }


  // --- Pantalla Handoff ---
  if (!isIndividual && screenStep === 'handoff') {
    return (
      <HandoffScreen
        name={currentPlayer.name}
        idx={currentIdx + 1}
        total={passOrderIds.length}
        onReady={() => setScreenStep('action')}
      />
    );
  }

  // --- Pantallas de acción ---

  // Pueblo / asesino sin acción pendiente / policía sin acción pendiente
  if (
    actionType === 'town' ||
    actionType === 'killer-done' ||
    actionType === 'cop-done'
  ) {
    return (
      <NeutralScreen
        player={currentPlayer}
        onContinue={() => advancePlayer()}
        isLastPlayer={isLastPlayer}
        isIndividual={isIndividual}
      />
    );
  }

  // Asesino único
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
        onToggle={(id: string) => setSelected([id])}
        confirmLabel={isLastPlayer ? 'Confirmar y cerrar operativo' : 'Confirmar ataque'}
        canConfirm={selected.length === 1}
        onConfirm={() => {
          setKillerActedCount((c) => c + 1);
          advancePlayer(selected[0]);
        }}
      />
    );
  }

  // Primer asesino (de 2+) — propone
  if (actionType === 'killer-propose') {
    const maxProp = Math.min(3, alivePlayers.length - 1);
    return (
      <PlayerPickerScreen
        title="Proponer objetivos"
        instruction={`Sos el primer asesino. Elegí hasta ${maxProp} posibles objetivos para que tu cómplice defina el ataque.`}
        emoji="🔪"
        color={ROLE_COLORS.killer}
        players={alivePlayers}
        excludeIds={[currentPlayer.id]}
        maxSelectable={maxProp}
        selected={selected}
        onToggle={(id: string) =>
          setSelected((prev) =>
            prev.includes(id)
              ? prev.filter((x) => x !== id)
              : prev.length < maxProp
              ? [...prev, id]
              : prev
          )
        }
        confirmLabel="Confirmar propuestas"
        canConfirm={selected.length >= 1 && selected.length <= maxProp}
        onConfirm={() => {
          setKillerProposals(selected);
          setKillerActedCount((c) => c + 1);
          advancePlayer();
        }}
      />
    );
  }

  // Segundo asesino — elige del listado
  if (actionType === 'killer-vote') {
    const proposals = killerProposals.length > 0
      ? alivePlayers.filter((p) => killerProposals.includes(p.id))
      : alivePlayers.filter((p) => p.id !== currentPlayer.id); // fallback

    return (
      <PlayerPickerScreen
        title="Elegir objetivo final"
        instruction="Tu cómplice propuso candidatos. Vos elegís quién cae esta noche."
        emoji="🔪"
        color={ROLE_COLORS.killer}
        players={proposals}
        excludeIds={[]}
        maxSelectable={1}
        selected={selected}
        onToggle={(id: string) => setSelected([id])}
        confirmLabel={isLastPlayer ? 'Confirmar y cerrar operativo' : 'Confirmar objetivo'}
        canConfirm={selected.length === 1}
        onConfirm={() => {
          setKillerActedCount((c) => c + 1);
          advancePlayer(selected[0]);
        }}
      />
    );
  }

  // Doctor
  if (actionType === 'doctor') {
    return (
      <PlayerPickerScreen
        title="Proteger a alguien"
        instruction="Elegí a quién proteger esta noche. Si los asesinos lo atacan, lo salvarás."
        emoji="🩺"
        color={ROLE_COLORS.doctor}
        players={alivePlayers}
        excludeIds={[]}
        maxSelectable={1}
        selected={selected}
        onToggle={(id: string) => setSelected([id])}
        confirmLabel={isLastPlayer ? 'Confirmar y cerrar operativo' : 'Confirmar protección'}
        canConfirm={selected.length === 1}
        onConfirm={() => advancePlayer(undefined, selected[0])}
      />
    );
  }

  // Policía (single, propose, vote)
  if (
    actionType === 'cop-single' ||
    actionType === 'cop-propose' ||
    actionType === 'cop-vote'
  ) {
    // Pantalla de resultado de investigación
    if (copScreenState === 'result') {
      const investigated = alivePlayers.find((p) => p.id === selected[0]);
      const isSuspect = inspectResultType === 'killer';
      return (
        <main className="page-shell">
          <div className="page-header">
            <div className="phase-badge" style={{ color: ROLE_COLORS.cop }}>
              🔍 Resultado
            </div>
          </div>
          <div className="page-content" style={{ justifyContent: 'center', textAlign: 'center' }}>
            <div
              className="card"
              style={{
                padding: 'var(--sp-xl)',
                borderColor: isSuspect ? 'var(--danger)' : 'var(--success)',
              }}
            >
              <div style={{ fontSize: 52, marginBottom: 'var(--sp-sm)' }}>
                {isSuspect ? '🚨' : '✅'}
              </div>
              <h3>{investigated?.name}</h3>
              <p
                className={`info-box ${isSuspect ? 'danger' : 'success'}`}
                style={{ marginTop: 'var(--sp-md)' }}
              >
                {isSuspect
                  ? 'SOSPECHOSO — Es asesino.'
                  : 'INOCENTE — No es asesino.'}
              </p>
              <p
                className="text-muted"
                style={{ marginTop: 'var(--sp-md)', fontSize: 'var(--text-xs)' }}
              >
                Esta información es solo tuya. Usala con estrategia en el juicio.
              </p>
            </div>
          </div>
          <div className="page-footer">
            <button
              className="btn btn-primary"
              onClick={() => {
                setCopActedCount((c) => c + 1);
                advancePlayer(undefined, undefined, selected[0]);
              }}
            >
              {isLastPlayer ? 'Cerrar operativo →' : 'Continuar →'}
            </button>
          </div>
        </main>
      );
    }

    // Pantalla de selección
    let pickable = alivePlayers;
    let instr = 'Elegí a quién investigar. El resultado es solo para vos.';
    let maxS = 1;

    if (actionType === 'cop-propose') {
      const maxProp = Math.min(3, alivePlayers.length - 1);
      instr = `Sos el primer policía. Elegí hasta ${maxProp} sospechosos para que tu compañero investigue.`;
      maxS = maxProp;
    } else if (actionType === 'cop-vote') {
      pickable =
        copProposals.length > 0
          ? alivePlayers.filter((p) => copProposals.includes(p.id))
          : alivePlayers.filter((p) => p.id !== currentPlayer.id);
      instr = 'Elegí quién será el investigado final.';
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
        onToggle={(id: string) => {
          if (maxS === 1) setSelected([id]);
          else
            setSelected((p) =>
              p.includes(id)
                ? p.filter((x) => x !== id)
                : p.length < maxS
                ? [...p, id]
                : p
            );
        }}
        confirmLabel={
          actionType === 'cop-propose' ? 'Confirmar propuestas' : 'Ver resultado'
        }
        canConfirm={actionType === 'cop-propose' ? selected.length >= 1 : selected.length === 1}
        onConfirm={() => {
          if (actionType === 'cop-propose') {
            setCopProposals(selected);
            setCopActedCount((c) => c + 1);
            advancePlayer();
          } else {
            const target = alivePlayers.find((p) => p.id === selected[0]);
            if (target) {
              setInspectResultType(evaluateInspection(target));
              setCopScreenState('result');
            }
          }
        }}
      />
    );
  }

  return null;
}

// ─── Sub-componentes ────────────────────────────────────────

function HandoffScreen({
  name,
  idx,
  total,
  onReady,
}: {
  name: string;
  idx: number;
  total: number;
  onReady: () => void;
}) {
  return (
    <main className="page-shell" style={{ justifyContent: 'center', textAlign: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-lg)', alignItems: 'center' }}>
        <div className="phase-badge">Clandestinidad</div>
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            fontSize: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          📱
        </div>
        <h2>Pasá el dispositivo</h2>
        <p>
          Entregalo a <strong style={{ color: 'var(--accent)' }}>{name}</strong>
        </p>
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

function NeutralScreen({
  player,
  onContinue,
  isLastPlayer,
  isIndividual,
}: {
  player: Player;
  onContinue: () => void;
  isLastPlayer: boolean;
  isIndividual: boolean;
}) {
  const [flavorText, setFlavorText] = useState('Consultando registros municipales...');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const list = [
      'Escaneando alrededores...',
      'Monitoreando cámaras...',
      'Revisando frecuencias...',
      'Analizando datos...',
      'Verificando movimientos...',
    ];
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % list.length;
      setFlavorText(list[i]);
    }, 1200);
    const timer = setTimeout(
      () => {
        setLoading(false);
        setFlavorText('Diligencias completadas.');
      },
      3000 + Math.random() * 1500
    );
    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, []);

  return (
    <main className="page-shell">
      <div className="page-header">
        <div className="phase-badge">📋 Actividad</div>
      </div>
      <div className="page-content" style={{ justifyContent: 'center', textAlign: 'center' }}>
        <div className="card" style={{ padding: 'var(--sp-xl)', opacity: loading ? 0.8 : 1 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>{loading ? '🛰️' : '📁'}</div>
          <h3>{player.name}</h3>
          <p className="text-muted" style={{ marginTop: 8 }}>
            {flavorText}
          </p>
          {loading && (
            <div className="loading-bar" style={{ marginTop: 24 }}>
              <div className="loading-bar-progress" />
            </div>
          )}
        </div>
        {!loading && !isIndividual && (
          <p className="text-muted" style={{ fontSize: 'var(--text-xs)' }}>
            Podés avanzar ahora.
          </p>
        )}
      </div>
      <div className="page-footer">
        <button className="btn btn-primary" onClick={onContinue} disabled={loading}>
          {isLastPlayer ? 'Finalizar operativo →' : 'Continuar →'}
        </button>
      </div>
    </main>
  );
}

function PlayerPickerScreen({
  title,
  instruction,
  emoji,
  color,
  players,
  excludeIds,
  maxSelectable,
  selected,
  onToggle,
  confirmLabel,
  canConfirm,
  onConfirm,
}: {
  title: string;
  instruction: string;
  emoji: string;
  color: string;
  players: Player[];
  excludeIds: string[];
  maxSelectable: number;
  selected: string[];
  onToggle: (id: string) => void;
  confirmLabel: string;
  canConfirm: boolean;
  onConfirm: () => void;
}) {
  const pickable = players.filter((p) => !excludeIds.includes(p.id));
  const isDanger = color === ROLE_COLORS.killer;

  return (
    <main className="page-shell">
      <div className="page-header">
        <div className="phase-badge" style={{ color }}>
          {emoji} {title}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          {selected.length}/{maxSelectable}
        </span>
      </div>
      <div className="page-content">
        <div className="card" style={{ borderColor: color }}>
          <p style={{ fontSize: 'var(--text-sm)' }}>{instruction}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
          {pickable.map((p) => (
            <button
              key={p.id}
              onClick={() => onToggle(p.id)}
              style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left' }}
            >
              <div
                className={`player-card ${selected.includes(p.id) ? 'selected' : ''}`}
                style={selected.includes(p.id) ? { borderColor: color } : {}}
              >
                <div
                  className="player-avatar"
                  style={{ borderColor: selected.includes(p.id) ? color : undefined }}
                >
                  {p.name[0]?.toUpperCase()}
                </div>
                <span className="player-name">{p.name}</span>
                {selected.includes(p.id) && (
                  <span style={{ color, marginLeft: 'auto' }}>✓</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="page-footer">
        <button
          className={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`}
          disabled={!canConfirm}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </main>
  );
}
