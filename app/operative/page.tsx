'use client';

// ============================================================
// app/operative/page.tsx — Operativo Encubierto
//
// PROTECCIÓN DE IDENTIDAD:
//   - Todos los jugadores esperan el MISMO tiempo mínimo (MIN_SECONDS)
//     antes de que aparezca el botón de confirmar.
//   - El orden de pase es completamente aleatorio (fixedPassOrder).
//   - Pueblo y roles ya cubiertos ven una pantalla neutra de duración
//     idéntica a la de jugadores con acción.
//   - NO existe un orden estructurado por rol. El doctor puede pasar
//     antes o después del asesino indistintamente.
// ============================================================

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { Player, ROLE_LABELS } from '@/lib/game/state';
import { getOperativeAction, ROLE_COLORS } from '@/lib/modes/table';
import { useLocalPlayer } from '@/lib/hooks/useLocalPlayer';
import { playClick } from '@/lib/sounds';

// Tiempo mínimo uniforme en segundos antes de que aparezca
// el botón de confirmar, para TODOS los jugadores sin excepción.
const MIN_SECONDS = 6;

type ScreenStep = 'handoff' | 'action';

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

  const [currentIdx,         setCurrentIdx]         = useState(0);
  const [screenStep,         setScreenStep]         = useState<ScreenStep>('handoff');
  const [killerProposals,    setKillerProposals]    = useState<string[]>([]);
  const [killerActedCount,   setKillerActedCount]   = useState(0);
  const [copActedCount,      setCopActedCount]      = useState(0);
  const [collectedKillTarget,    setCollectedKillTarget]    = useState<string | null>(null);
  const [collectedSaveTarget,    setCollectedSaveTarget]    = useState<string | null>(null);
  const [collectedInspectTarget, setCollectedInspectTarget] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  // Guard
  if (state.players.length === 0 || state.phase === 'lobby') {
    router.replace('/');
    return null;
  }

  const currentPlayerId = isIndividual ? localPlayerId : passOrderIds[currentIdx];
  const currentPlayer   = state.players.find((p) => p.id === currentPlayerId);

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

  // ── Finalizar el operativo ──────────────────────────────
  function finishAndGoToNews(k: string | null, s: string | null, i: string | null) {
    if (k) dispatch({ type: 'SET_KILL_TARGET', targetId: k });
    if (s) dispatch({ type: 'SET_SAVE_TARGET', targetId: s });
    if (i) dispatch({ type: 'SET_INSPECT_TARGET', targetId: i });
    dispatch({ type: 'NEXT_PHASE' });
    router.push('/news');
  }

  function advancePlayer(k?: string | null, s?: string | null, i?: string | null) {
    const finalKill    = k !== undefined ? k : collectedKillTarget;
    const finalSave    = s !== undefined ? s : collectedSaveTarget;
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

  // ── Pantalla de traspaso ──────────────────────────────
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

  // ── Pueblo / roles sin acción ────────────────────────────
  // IMPORTANTE: el pueblo también selecciona un jugador (patrullaje falso).
  // Esto garantiza que TODOS hacen exactamente las mismas interacciones:
  // esperar el timer + tocar un jugador + tocar confirmar.
  // Así observar la cantidad de taps desde afuera no revela ningún rol.
  const isNeutral = actionType === 'town' || actionType === 'killer-done' || actionType === 'cop-done';
  if (isNeutral) {
    return (
      <TimedPickerScreen
        title="Turno nocturno"
        instruction="Seleccioná un jugador para continuar."
        emoji="🌙"
        color="var(--text-muted)"
        players={alivePlayers.filter((p) => p.id !== currentPlayer.id)}
        maxSelectable={1}
        selected={selected}
        onToggle={(id) => setSelected([id])}
        confirmLabel={isLastPlayer ? 'Finalizar operativo →' : 'Continuar →'}
        minSeconds={MIN_SECONDS}
        onConfirm={() => {
          playClick();
          // La selección del pueblo NO se guarda ni afecta el juego
          advancePlayer();
        }}
      />
    );
  }


  // ── Asesino único ────────────────────────────────────
  if (actionType === 'killer-single') {
    return (
      <TimedPickerScreen
        title="Elegí tu objetivo"
        instruction="Esta noche, ¿a quién atacás?"
        emoji="🔪"
        color={ROLE_COLORS.killer}
        players={alivePlayers.filter((p) => p.id !== currentPlayer.id)}
        maxSelectable={1}
        selected={selected}
        onToggle={(id) => setSelected([id])}
        confirmLabel={isLastPlayer ? 'Confirmar y cerrar' : 'Confirmar ataque'}
        minSeconds={MIN_SECONDS}
        onConfirm={() => {
          playClick();
          setKillerActedCount((c) => c + 1);
          advancePlayer(selected[0]);
        }}
      />
    );
  }

  // ── Asesino: proponer candidatos (primero de 2+) ─────
  if (actionType === 'killer-propose') {
    const maxProp = Math.min(3, alivePlayers.length - 2);
    return (
      <TimedPickerScreen
        title="Proponer candidatos"
        instruction={`Proponé hasta ${maxProp} posibles objetivos para que tu cómplice decida.`}
        emoji="🔪"
        color={ROLE_COLORS.killer}
        players={alivePlayers.filter((p) => p.id !== currentPlayer.id)}
        maxSelectable={maxProp}
        selected={selected}
        onToggle={(id) =>
          setSelected((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < maxProp ? [...prev, id] : prev
          )
        }
        confirmLabel="Enviar propuestas"
        minSeconds={MIN_SECONDS}
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

  // ── Asesino: elegir del listado (segundo de 2+) ───────
  if (actionType === 'killer-vote') {
    const proposals = killerProposals.length > 0
      ? alivePlayers.filter((p) => killerProposals.includes(p.id))
      : alivePlayers.filter((p) => p.id !== currentPlayer.id);
    return (
      <TimedPickerScreen
        title="Elegir objetivo final"
        instruction="Tu cómplice propuso estos candidatos. Vos decidís quién cae."
        emoji="🔪"
        color={ROLE_COLORS.killer}
        players={proposals}
        maxSelectable={1}
        selected={selected}
        onToggle={(id) => setSelected([id])}
        confirmLabel={isLastPlayer ? 'Confirmar y cerrar' : 'Confirmar objetivo'}
        minSeconds={MIN_SECONDS}
        onConfirm={() => {
          playClick();
          setKillerActedCount((c) => c + 1);
          advancePlayer(selected[0]);
        }}
      />
    );
  }

  // ── Doctor ────────────────────────────────────────────
  if (actionType === 'doctor') {
    return (
      <TimedPickerScreen
        title="Proteger a alguien"
        instruction="¿A quién protegés esta noche? Si los asesinos lo atacan, lo salvarás."
        emoji="🩺"
        color={ROLE_COLORS.doctor}
        players={alivePlayers}
        maxSelectable={1}
        selected={selected}
        onToggle={(id) => setSelected([id])}
        confirmLabel={isLastPlayer ? 'Confirmar y cerrar' : 'Confirmar protección'}
        minSeconds={MIN_SECONDS}
        onConfirm={() => {
          playClick();
          advancePlayer(undefined, selected[0]);
        }}
      />
    );
  }

  // ── Policía (sin reveal — todos lo ven en noticias) ──
  if (actionType === 'cop') {
    const instr = aliveCopCount > 1 && copActedCount === 0
      ? 'Proponé un sospechoso para investigar. Tu compañero lo confirmará.'
      : '¿A quién investigás esta noche? El resultado se revelará mañana para todos.';

    return (
      <TimedPickerScreen
        title="Investigar"
        instruction={instr}
        emoji="🔍"
        color={ROLE_COLORS.cop}
        players={alivePlayers.filter((p) => p.id !== currentPlayer.id)}
        maxSelectable={1}
        selected={selected}
        onToggle={(id) => setSelected([id])}
        confirmLabel={isLastPlayer ? 'Confirmar y cerrar' : 'Confirmar investigación'}
        minSeconds={MIN_SECONDS}
        onConfirm={() => {
          playClick();
          // Si hay 2 policías y este es el primero, el segundo puede confirmar/cambiar
          // Si es el único o el segundo, guardamos el objetivo
          if (aliveCopCount > 1 && copActedCount === 0) {
            setKillerProposals(selected); // reutilizamos el array de propuestas
            setCopActedCount((c) => c + 1);
            advancePlayer();
          } else {
            setCopActedCount((c) => c + 1);
            advancePlayer(undefined, undefined, selected[0]);
          }
        }}
      />
    );
  }

  return null;
}

// ── Sub-componentes ──────────────────────────────────────────

function HandoffScreen({ name, idx, total, onReady }: {
  name: string; idx: number; total: number; onReady: () => void;
}) {
  return (
    <main className="page-shell" style={{ justifyContent: 'center', textAlign: 'center' }}>
      <div className="anim-fade-in" style={{
        display: 'flex', flexDirection: 'column', gap: 'var(--sp-lg)', alignItems: 'center',
      }}>
        <div className="phase-badge">🌙 Clandestinidad</div>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          fontSize: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'float 3s ease-in-out infinite',
        }}>
          📱
        </div>
        <h2>Pasá el dispositivo</h2>
        <p>Entregalo a <strong style={{ color: 'var(--accent)' }}>{name}</strong></p>
        <p className="text-muted" style={{ fontSize: 'var(--text-xs)' }}>
          {idx} de {total} · No muestres la pantalla
        </p>
        <button className="btn btn-primary" style={{ minWidth: 220 }} onClick={onReady}>
          Soy {name} — Empezar
        </button>
      </div>
    </main>
  );
}

// Pantalla con timer uniforme — todos deben esperar MIN_SECONDS
function TimedScreen({
  minSeconds,
  isLastPlayer,
  onConfirm,
  children,
}: {
  minSeconds: number;
  isLastPlayer: boolean;
  onConfirm: () => void;
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [seconds, setSeconds] = useState(minSeconds);

  useEffect(() => {
    const id = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) { clearInterval(id); setReady(true); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="page-shell">
      <div className="page-header">
        <div className="phase-badge">🌙 Operativo</div>
        {!ready && (
          <span style={{
            marginLeft: 'auto', fontSize: 'var(--text-sm)',
            color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums',
          }}>
            {seconds}s
          </span>
        )}
      </div>
      <div className="page-content" style={{ justifyContent: 'center' }}>
        {children}
      </div>
      <div className="page-footer">
        <button className="btn btn-primary" disabled={!ready} onClick={onConfirm}>
          {ready
            ? (isLastPlayer ? 'Finalizar operativo →' : 'Continuar →')
            : `Esperá ${seconds}s…`}
        </button>
      </div>
    </main>
  );
}

function NeutralContent({ player }: { player: Player }) {
  const [text, setText] = useState('Escaneando alrededores...');
  const texts = [
    'Escaneando alrededores...',
    'Monitoreando cámaras...',
    'Revisando frecuencias...',
    'Verificando movimientos...',
    'Analizando datos...',
  ];
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => { i = (i + 1) % texts.length; setText(texts[i]); }, 1200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="card anim-fade-in" style={{ padding: 'var(--sp-xl)', textAlign: 'center' }}>
      <div style={{ fontSize: 44, marginBottom: 12, animation: 'float 3s ease-in-out infinite' }}>🛰️</div>
      <h3>{player.name}</h3>
      <p className="text-muted" style={{ marginTop: 8, fontSize: 'var(--text-sm)' }}>{text}</p>
      <div className="loading-bar" style={{ marginTop: 24 }}>
        <div className="loading-bar-progress" />
      </div>
    </div>
  );
}

// Pantalla de selección con timer uniforme integrado
function TimedPickerScreen({
  title, instruction, emoji, color, players, maxSelectable,
  selected, onToggle, confirmLabel, minSeconds, canConfirm: canConfirmProp, onConfirm,
}: {
  title: string; instruction: string; emoji: string; color: string;
  players: Player[]; maxSelectable: number;
  selected: string[]; onToggle: (id: string) => void;
  confirmLabel: string; minSeconds: number;
  canConfirm?: boolean; onConfirm: () => void;
}) {
  const [timerDone, setTimerDone] = useState(false);
  const [seconds, setSeconds] = useState(minSeconds);

  useEffect(() => {
    const id = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) { clearInterval(id); setTimerDone(true); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const hasSelection = canConfirmProp !== undefined ? canConfirmProp : selected.length >= 1;
  const canSubmit = timerDone && hasSelection;
  const isDanger = color === ROLE_COLORS.killer;

  return (
    <main className="page-shell">
      <div className="page-header">
        <div className="phase-badge" style={{ color }}>{emoji} {title}</div>
        <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {!timerDone ? `${seconds}s` : `${selected.length}/${maxSelectable}`}
        </span>
      </div>
      <div className="page-content">
        <div className="card anim-fade-in" style={{ borderColor: color }}>
          <p style={{ fontSize: 'var(--text-sm)' }}>{instruction}</p>
          {!timerDone && (
            <div className="loading-bar" style={{ marginTop: 12 }}>
              <div className="loading-bar-progress" />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
          {players.map((p, i) => (
            <button
              key={p.id}
              onClick={() => timerDone && onToggle(p.id)}
              disabled={!timerDone}
              style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left',
                animation: `slideUp 0.3s ${i * 0.05}s both`,
                opacity: timerDone ? 1 : 0.5, transition: 'opacity 0.4s' }}
            >
              <div
                className={`player-card ${selected.includes(p.id) ? 'selected' : ''}`}
                style={selected.includes(p.id) ? { borderColor: color } : {}}
              >
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
        <button
          className={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`}
          disabled={!canSubmit}
          onClick={onConfirm}
        >
          {!timerDone
            ? `Esperá ${seconds}s…`
            : !hasSelection
            ? 'Seleccioná un jugador'
            : confirmLabel}
        </button>
      </div>
    </main>
  );
}
