'use client';

// ============================================================
// app/multi/game/[roomId]/page.tsx
// Vista principal del juego multidispositivo por dispositivo.
//
// Actúa como router interno de fases: según el estado de la sala
// (obtenido por polling), renderiza la vista correspondiente.
//
// Cada sub-vista es un componente puro que recibe el estado
// y las funciones de acción como props.
// ============================================================

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useMultiRoom } from '@/context/MultiRoomContext';
import {
  confirmReveal,
  submitOperativeAction,
  castVote,
  advancePhase,
  restartGame,
} from '@/lib/multi/api';
import {
  ROLE_LABELS,
} from '@/lib/game/state';
import {
  ROLE_DESCRIPTIONS,
  ROLE_EMOJIS,
  ROLE_COLORS,
} from '@/lib/modes/table';
import type {
  MultiRoomState,
  MultiPlayer,
  PlayerSecret,
} from '@/lib/multi/types';

// =============================================================
// Sub-vista: Sala de espera (antes de que el host inicie)
// =============================================================
function WaitingView({
  room,
  deviceId,
  isHost,
}: {
  room: MultiRoomState;
  deviceId: string;
  isHost: boolean;
}) {
  const router = useRouter();
  const roomId = room.roomId;

  return (
    <main className="page-shell" style={{ justifyContent: 'center' }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 'var(--sp-lg)', padding: 'var(--sp-xl)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 48 }}>⚖️</div>
        <div>
          <h2>Sala {roomId}</h2>
          <p className="text-muted" style={{ marginTop: 8 }}>
            {room.players.length} jugadores conectados — esperando al host
          </p>
        </div>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
          {room.players.map((p) => (
            <div key={p.deviceId} className="player-card" style={{
              borderColor: p.deviceId === deviceId ? 'var(--accent)' : undefined,
            }}>
              <div className="player-avatar" style={{
                borderColor: p.deviceId === deviceId ? 'var(--accent)' : undefined,
              }}>
                {p.name[0]?.toUpperCase()}
              </div>
              <span className="player-name">
                {p.name}
                {p.deviceId === deviceId && (
                  <span style={{ color: 'var(--accent)', marginLeft: 6, fontSize: 'var(--text-xs)' }}>
                    {isHost ? '(Vos — Host)' : '(Vos)'}
                  </span>
                )}
              </span>
              {room.hostId === p.deviceId && (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Host</span>
              )}
            </div>
          ))}
        </div>

        {isHost && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => router.push(`/multi/host/${roomId}`)}
          >
            Ir a la sala del host →
          </button>
        )}

        <p className="text-muted" style={{ fontSize: 'var(--text-xs)' }}>
          La partida comienza cuando el host toca "Iniciar".
        </p>
      </div>
    </main>
  );
}

// =============================================================
// Sub-vista: Revelación de rol
// =============================================================
function RevealView({
  me,
  secret,
  room,
  deviceId,
  onReady,
  isReady,
}: {
  me: MultiPlayer;
  secret: PlayerSecret | null;
  room: MultiRoomState;
  deviceId: string;
  onReady: () => void;
  isReady: boolean;
}) {
  useEffect(() => {
    if (!secret) return;
    void playRoleSound(secret.role);
  }, [secret?.deviceId, secret?.role]);

  if (!secret) {
    return (
      <main className="page-shell" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', gap: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 36 }}>🔐</div>
          <p>Cargando tu rol...</p>
        </div>
      </main>
    );
  }

  const roleColor = ROLE_COLORS[secret.role];
  const roleEmoji = ROLE_EMOJIS[secret.role];
  const roleDesc  = ROLE_DESCRIPTIONS[secret.role];

  // Compañeros de equipo
  const teammates = room.players.filter((p) => secret.teammateIds.includes(p.deviceId));

  // Cuántos jugadores ya confirmaron estar listos
  const readyCount = room.players.filter((p) => p.isAlive && p.readyForOperative).length;
  const totalAlive = room.players.filter((p) => p.isAlive).length;

  return (
    <main className="page-shell">
      <div className="page-header">
        <div className="phase-badge">🎴 Tu rol secreto</div>
        <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          {room.roomId}
        </span>
      </div>

      <div className="page-content">
        {/* Tarjeta de rol */}
        <div className="card anim-fade-in" style={{ borderColor: roleColor, textAlign: 'center', padding: 'var(--sp-xl)' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'var(--bg-elevated)', border: `2px solid ${roleColor}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 700, margin: '0 auto var(--sp-md)',
            color: 'var(--text-primary)',
          }}>
            {me.name[0]?.toUpperCase()}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: 4 }}>Tu nombre</p>
          <h3 style={{ marginBottom: 'var(--sp-md)' }}>{me.name}</h3>
          <div className="divider" style={{ marginBottom: 'var(--sp-md)' }} />
          <div style={{ fontSize: 48, marginBottom: 'var(--sp-sm)' }}>{roleEmoji}</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: 4 }}>Tu rol</p>
          <h2 style={{ color: roleColor, fontSize: 'var(--text-xl)', marginBottom: 'var(--sp-md)' }}>
            {ROLE_LABELS[secret.role]}
          </h2>
        </div>

        {/* Descripción */}
        <div className="card-section">
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
            {roleDesc}
          </p>
        </div>

        {/* Compañeros */}
        {teammates.length > 0 && (
          <div style={{ textAlign: 'center' }}>
            <span className="form-label" style={{ color: roleColor, display: 'block', marginBottom: 'var(--sp-md)' }}>
              {secret.role === 'killer' ? '🔪 Tu cómplice es' : '🔍 Tu compañero es'}{' '}
              <strong>{teammates.map((t) => t.name).join(', ')}</strong>
            </span>
            {teammates.map((tm) => (
              <div key={tm.deviceId} className="player-card">
                <div className="player-avatar" style={{ borderColor: roleColor }}>
                  {tm.name[0]?.toUpperCase()}
                </div>
                <span className="player-name">{tm.name}</span>
              </div>
            ))}
          </div>
        )}

        {teammates.length === 0 && (secret.role === 'killer' || secret.role === 'cop') && (
          <div className="info-box">
            Sos el único {ROLE_LABELS[secret.role].toLowerCase()} en esta partida. Actuá solo.
          </div>
        )}

        {/* Progreso de listos */}
        {isReady && (
          <div className="info-box" style={{ textAlign: 'center', borderColor: 'var(--success)', color: 'var(--success)' }}>
            ✅ Listo — {readyCount}/{totalAlive} jugadores confirmaron su rol
          </div>
        )}
      </div>

      <div className="page-footer">
        <button
          id="btn-reveal-listo"
          className="btn btn-primary"
          onClick={() => {
            void playSound('ui.confirm');
            onReady();
          }}
          disabled={isReady}
          style={{ fontSize: 'var(--text-md)', padding: '16px' }}
        >
          {isReady ? `Esperando a ${totalAlive - readyCount} más...` : 'Entendido — Estoy listo →'}
        </button>
      </div>
    </main>
  );
}

// =============================================================
// Sub-vista: Operativo Encubierto (acción privada simultánea)
// =============================================================
function OperativeView({
  me,
  secret,
  room,
  deviceId,
  hasActed,
  onAction,
}: {
  me: MultiPlayer;
  secret: PlayerSecret;
  room: MultiRoomState;
  deviceId: string;
  hasActed: boolean;
  onAction: (type: 'kill' | 'save' | 'inspect' | 'neutral', targetId: string | null) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [syncingTargetId, setSyncingTargetId] = useState<string | null>(null);
  const autoCommitSharedTargetRef = useRef<string | null>(null);

  const alivePlayers = room.players.filter((p) => p.isAlive);
  const pendingCount = Object.values(room.game?.pendingActions ?? {}).filter((v) => v === null).length;

  const roleColor = ROLE_COLORS[secret.role];
  const isKiller  = secret.role === 'killer';
  const isTown    = secret.role === 'town';
  const roleTint = secret.role === 'killer'
    ? 'rgba(224,82,82,0.10)'
    : secret.role === 'cop'
      ? 'rgba(87,140,255,0.10)'
      : secret.role === 'doctor'
        ? 'rgba(76,182,124,0.10)'
        : 'rgba(255,255,255,0.04)';
  const aliveTeamMemberIds = [deviceId, ...secret.teammateIds].filter((memberId) =>
    alivePlayers.some((player) => player.deviceId === memberId)
  );
  const teamKey = secret.role === 'killer'
    ? 'killers'
    : secret.role === 'cop'
      ? 'cops'
      : null;
  const sharedSelection = teamKey ? room.game?.teamSelections?.[teamKey] : undefined;
  const sharedTargetId = sharedSelection?.targetPlayerId ?? null;
  const sharedTargetPlayer = sharedTargetId
    ? room.players.find((player) => player.deviceId === sharedTargetId) ?? null
    : null;
  const usesSharedTarget = Boolean(
    teamKey &&
    (secret.role === 'killer' || secret.role === 'cop') &&
    aliveTeamMemberIds.length > 1
  );
  const sharedConfirmed = usesSharedTarget &&
    Boolean(sharedTargetId) &&
    aliveTeamMemberIds.every((memberId) => sharedSelection?.confirmedBy.includes(memberId));
  const iConfirmedSharedTarget = usesSharedTarget && sharedSelection?.confirmedBy.includes(deviceId);

  // Configuración por rol
  const config = {
    killer: {
      title: 'Elegí tu objetivo',
      instruction: usesSharedTarget
        ? 'La primera marca se comparte al instante. Toquen el mismo objetivo para confirmar.'
        : 'Esta noche, ¿a quién atacás?',
      emoji: '🔪',
      actionType: 'kill' as const,
      // Killers no atacan a sus compañeros
      eligibleTargets: alivePlayers.filter(
        (p) => p.deviceId !== deviceId && !secret.teammateIds.includes(p.deviceId)
      ),
    },
    doctor: {
      title: 'Proteger',
      instruction: '¿A quién protegés esta noche?',
      emoji: '🩺',
      actionType: 'save' as const,
      eligibleTargets: alivePlayers,
    },
    cop: {
      title: 'Investigar',
      instruction: usesSharedTarget
        ? 'Tu compañero verá tu sospechoso. Toquen el mismo objetivo para confirmar.'
        : '¿A quién investigás?',
      emoji: '🔍',
      actionType: 'inspect' as const,
      eligibleTargets: alivePlayers.filter((p) => p.deviceId !== deviceId),
    },
    town: {
      title: 'Turno nocturno',
      instruction: 'Está oscuro. Tocá un nombre para marcar tu presencia.',
      emoji: '🌙',
      actionType: 'neutral' as const,
      eligibleTargets: alivePlayers.filter((p) => p.deviceId !== deviceId),
    },
  }[secret.role];

  async function handleConfirm() {
    if (isTown) {
      void playSound('ui.confirm');
      setConfirming(true);
      try {
        await onAction('neutral', null);
      } finally {
        setConfirming(false);
      }
      return;
    }

    if (!selected) return;

    void playSound('ui.confirm');
    setConfirming(true);
    try {
      await onAction(config.actionType, selected);
    } finally {
      setConfirming(false);
    }
  }

  async function handleSharedTargetTap(targetId: string) {
    if (!usesSharedTarget || syncingTargetId) {
      return;
    }

    if (sharedTargetId === targetId && iConfirmedSharedTarget) {
      return;
    }

    if (sharedTargetId === targetId) {
      void playSound('ui.confirm');
    } else {
      void playSound('ui.select');
    }

    setSyncingTargetId(targetId);
    try {
      await onAction(config.actionType, targetId);
    } finally {
      setSyncingTargetId(null);
    }
  }

  useEffect(() => {
    if (!usesSharedTarget || !sharedConfirmed || !sharedTargetId || hasActed || syncingTargetId) {
      if (!sharedConfirmed) {
        autoCommitSharedTargetRef.current = null;
      }
      return;
    }

    if (autoCommitSharedTargetRef.current === sharedTargetId) {
      return;
    }

    autoCommitSharedTargetRef.current = sharedTargetId;
    void onAction(config.actionType, sharedTargetId);
  }, [config.actionType, hasActed, onAction, sharedConfirmed, sharedTargetId, syncingTargetId, usesSharedTarget]);

  if (hasActed) {
    return (
      <main className="page-shell" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-lg)' }}>
          <div style={{ fontSize: 48 }}>✅</div>
          <div>
            <h3>Acción enviada</h3>
            <p className="text-muted" style={{ marginTop: 8 }}>
              Esperando a los demás jugadores...
            </p>
          </div>
          {usesSharedTarget && sharedTargetPlayer && (
            <div
              className="info-box"
              style={{
                width: 'min(320px, 100%)',
                borderColor: 'var(--success)',
                color: 'var(--success)',
                textAlign: 'center',
              }}
            >
              <strong style={{ display: 'block', marginBottom: 6 }}>Objetivo confirmado</strong>
              {sharedTargetPlayer.name}
            </div>
          )}
          <div className="card" style={{ padding: 'var(--sp-md)', minWidth: 200, textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--accent)' }}>
              {pendingCount}
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              jugadores que restan
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="page-header">
        <div className="phase-badge" style={{ color: roleColor }}>
          {config.emoji} {config.title}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          {room.game?.round ? `Ronda ${room.game.round}` : ''}
        </span>
      </div>

      <div className="page-content">
        <div className="card anim-fade-in" style={{ borderColor: roleColor, padding: 'var(--sp-md)' }}>
          <p style={{ fontSize: 'var(--text-sm)' }}>{config.instruction}</p>
        </div>

        {usesSharedTarget && !sharedTargetPlayer && (
          <div className="info-box" style={{ borderColor: roleColor, color: roleColor }}>
            La primera selección se comparte con tu compañero en tiempo real.
          </div>
        )}

        {usesSharedTarget && sharedTargetPlayer && !sharedConfirmed && !iConfirmedSharedTarget && (
          <div className="info-box" style={{ borderColor: roleColor, color: roleColor }}>
            <strong style={{ display: 'block', marginBottom: 6 }}>Tu compañero propone este objetivo</strong>
            {sharedTargetPlayer.name}
          </div>
        )}

        {usesSharedTarget && sharedTargetPlayer && !sharedConfirmed && iConfirmedSharedTarget && (
          <div className="info-box" style={{ borderColor: roleColor, color: roleColor }}>
            <strong style={{ display: 'block', marginBottom: 6 }}>Esperando a tu compañero</strong>
            Marcaste a {sharedTargetPlayer.name}. Falta una confirmación más.
          </div>
        )}

        {usesSharedTarget && sharedTargetPlayer && sharedConfirmed && (
          <div className="info-box" style={{ borderColor: 'var(--success)', color: 'var(--success)' }}>
            <strong style={{ display: 'block', marginBottom: 6 }}>Objetivo confirmado</strong>
            {sharedTargetPlayer.name}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
          {config.eligibleTargets.map((p, i) => (
            <button
              key={p.deviceId}
              disabled={syncingTargetId !== null}
              onClick={() => {
                if (usesSharedTarget) {
                  void handleSharedTargetTap(p.deviceId);
                  return;
                }
                if (isTown) return;
                void playSound('ui.select');
                setSelected(sel => sel === p.deviceId ? null : p.deviceId);
              }}
              style={{
                background: 'none', border: 'none', padding: 0,
                textAlign: 'left', cursor: isTown ? 'default' : 'pointer',
                animation: `slideUp 0.28s ${i * 0.04}s both`,
                opacity: syncingTargetId && syncingTargetId !== p.deviceId ? 0.75 : 1,
              }}
            >
              <div
                className={`player-card ${
                  (usesSharedTarget && sharedTargetId === p.deviceId) || (!usesSharedTarget && selected === p.deviceId)
                    ? 'selected'
                    : ''
                }`}
                style={{
                  borderColor:
                    usesSharedTarget && sharedTargetId === p.deviceId && sharedConfirmed
                      ? 'var(--success)'
                      : (usesSharedTarget && sharedTargetId === p.deviceId) || (!usesSharedTarget && selected === p.deviceId)
                        ? roleColor
                        : undefined,
                  background:
                    usesSharedTarget && sharedTargetId === p.deviceId && sharedConfirmed
                      ? 'rgba(70,186,120,0.12)'
                      : (usesSharedTarget && sharedTargetId === p.deviceId) || (!usesSharedTarget && selected === p.deviceId)
                        ? roleTint
                        : undefined,
                  boxShadow:
                    usesSharedTarget && sharedTargetId === p.deviceId && sharedConfirmed
                      ? '0 0 0 1px var(--success), 0 0 22px rgba(70,186,120,0.22)'
                      : usesSharedTarget && sharedTargetId === p.deviceId
                        ? `0 0 0 1px ${roleColor}, 0 0 22px ${isKiller ? 'rgba(224,82,82,0.18)' : 'rgba(87,140,255,0.18)'}`
                        : undefined,
                  transform:
                    (usesSharedTarget && sharedTargetId === p.deviceId) || (!usesSharedTarget && selected === p.deviceId)
                      ? 'scale(1.02)'
                      : 'scale(1)',
                  transition: 'transform 0.15s, border-color 0.15s, background 0.15s, box-shadow 0.15s',
                }}
              >
                <div
                  className="player-avatar"
                  style={{
                    borderColor:
                      usesSharedTarget && sharedTargetId === p.deviceId && sharedConfirmed
                        ? 'var(--success)'
                        : (usesSharedTarget && sharedTargetId === p.deviceId) || (!usesSharedTarget && selected === p.deviceId)
                          ? roleColor
                          : undefined,
                  }}
                >
                  {p.name[0]?.toUpperCase()}
                </div>
                <span className="player-name">{p.name}</span>
                <span style={{
                  marginLeft: 'auto',
                  color:
                    usesSharedTarget && sharedTargetId === p.deviceId && sharedConfirmed
                      ? 'var(--success)'
                      : roleColor,
                  fontSize: 20,
                  opacity:
                    (usesSharedTarget && sharedTargetId === p.deviceId) || (!usesSharedTarget && selected === p.deviceId)
                      ? 1
                      : 0,
                  transition: 'opacity 0.15s',
                }}>✓</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="page-footer">
        {usesSharedTarget ? (
          <div className="info-box" style={{ textAlign: 'center', borderColor: roleColor, color: roleColor }}>
            {sharedConfirmed
              ? 'Objetivo confirmado. Esperando al resto de la mesa.'
              : 'La acción se ejecuta cuando todo el equipo toca el mismo objetivo.'}
          </div>
        ) : (
          <button
            id="btn-confirmar-accion"
            className={`btn ${isKiller ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => {
              void handleConfirm();
            }}
            disabled={confirming || (!isTown && !selected)}
            style={{ fontSize: 'var(--text-md)', padding: '16px' }}
          >
            {isTown ? 'Confirmar presencia →' : selected ? 'Confirmar →' : 'Seleccioná un jugador'}
          </button>
        )}
      </div>
    </main>
  );
}

// =============================================================
// Sub-vista: Noticias públicas (Cinemática igual que modo mesa)
// =============================================================
import { deriveNewsEvent, NEWS_ICONS, NEWS_COLORS } from '@/lib/game/news';
import {
  playNewsJingle, playDeath, playSaved, playCalm,
  playAccusation, playInnocent, playTransition,
  startBackgroundMusic, playVictory, playDefeat, playExpelled,
  duckMusic, playRoleSound, playSound, restoreMusic,
} from '@/lib/sounds';

type NewsStage = 'jingle' | 'main' | 'cop' | 'done';

function NewsView({
  room,
  isHost,
  onAdvance,
  advancing,
}: {
  room: MultiRoomState;
  isHost: boolean;
  onAdvance: () => void;
  advancing: boolean;
}) {
  const [stage, setStage] = useState<NewsStage>('jingle');
  const [copRevealed, setCopRevealed] = useState(false);
  const [headlineReady, setHeadlineReady] = useState(false);
  const playedForRoundRef = useRef<number | null>(null);

  const lastReport = room.game?.reports[room.game.reports.length - 1];
  const newsEvent = lastReport ? deriveNewsEvent(lastReport) : null;
  const hasCop = !!newsEvent?.cop;
  const currentRound = room.game?.round ?? 0;

  // ── Secuencia de revelación ───────────────────────────────
  useEffect(() => {
    // Si ya procesamos esta ronda, saltamos al final para no repetir cinemática al recargar
    if (playedForRoundRef.current === currentRound) {
      setStage('done');
      setCopRevealed(true);
      setHeadlineReady(true);
      return;
    }

    // Jingle inmediato
    if (isHost) {
      playNewsJingle();
    }
    playedForRoundRef.current = currentRound;

    // Secuencia igual a Modo Mesa
    const t1 = setTimeout(() => {
      setStage('main');
      setHeadlineReady(true);
      if (!isHost) {
        return;
      }

      if      (newsEvent?.type === 'death') setTimeout(playDeath, 300);
      else if (newsEvent?.type === 'saved') setTimeout(playSaved, 300);
      else                                   setTimeout(playCalm,  300);
    }, 3300);

    const t2 = hasCop
      ? setTimeout(() => setStage('cop'), 6800)
      : setTimeout(() => setStage('done'), 6500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      restoreMusic(700);
    };
  }, [currentRound, newsEvent, hasCop, isHost]);

  // Revelar resultado policial con sonido
  useEffect(() => {
    if (stage !== 'cop' || copRevealed) return;
    const t = setTimeout(() => {
      setCopRevealed(true);
      if (isHost) {
        if (newsEvent?.cop?.isKiller) playAccusation();
        else                          playInnocent();
      }
      setTimeout(() => setStage('done'), 3200);
    }, 800);
    return () => clearTimeout(t);
  }, [stage, copRevealed, newsEvent?.cop?.isKiller, isHost]);

  const eventColor = newsEvent ? NEWS_COLORS[newsEvent.type] : 'var(--accent)';
  const eventIcon  = newsEvent ? NEWS_ICONS[newsEvent.type]  : '📡';

  // --- Renderizado Jingle ---
  if (stage === 'jingle') {
    return (
      <main className="page-shell" style={{ justifyContent: 'center', textAlign: 'center', background: 'var(--bg-base)' }}>
        <div className="anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-xl)', alignItems: 'center' }}>
          <div style={{
            display: 'inline-flex', gap: 8, alignItems: 'center',
            padding: '6px 18px', borderRadius: 'var(--radius-full)',
            background: '#e05252', color: '#fff',
            fontSize: 'var(--text-sm)', fontWeight: 800, letterSpacing: '0.12em',
            animation: 'blink 0.8s ease-in-out infinite',
          }}>
            ● EN VIVO
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 64, animation: 'float 2.5s ease-in-out infinite' }}>📡</div>
            <h1 style={{ fontSize: 'clamp(2rem, 8vw, 3.5rem)', letterSpacing: '0.08em' }}>
              NOTICIAS<br />DE ÚLTIMO MOMENTO
            </h1>
          </div>
          <div style={{ width: '70%', maxWidth: 300 }}>
            <div className="loading-bar">
              <div style={{
                height: '100%', background: 'linear-gradient(90deg, var(--accent), #e05252)',
                animation: 'jingleProgress 3.2s linear both',
              }} />
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="page-header">
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '3px 12px', borderRadius: 'var(--radius-full)',
          background: '#e05252', color: '#fff',
          fontSize: 'var(--text-xs)', fontWeight: 800,
        }}>
          ● EN VIVO
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          Ronda {currentRound}
        </span>
      </div>

      <div className="page-content">
        {headlineReady && newsEvent && (
          <div className="card anim-reveal" style={{ borderColor: eventColor, padding: 'var(--sp-lg)', textAlign: 'center' }}>
            <div style={{ fontSize: 60, marginBottom: 'var(--sp-md)' }}>{eventIcon}</div>
            <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--sp-sm)' }}>{newsEvent.headline}</h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{newsEvent.detail}</p>
            {newsEvent.victimName && (
              <div style={{ marginTop: 'var(--sp-md)', padding: 'var(--sp-sm)', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: `1px solid ${eventColor}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="player-avatar" style={{ borderColor: eventColor }}>{newsEvent.victimName[0]?.toUpperCase()}</div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Identidad confirmada</div>
                  <div style={{ fontWeight: 700, color: eventColor }}>{newsEvent.victimName}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {(stage === 'cop' || stage === 'done') && hasCop && (
          <div className="anim-slide-up">
            {!copRevealed ? (
              <div className="card" style={{ textAlign: 'center', padding: 'var(--sp-xl)', borderColor: 'var(--role-cop)' }}>
                <div style={{ fontSize: 40, animation: 'float 1.5s ease-in-out infinite' }}>🔍</div>
                <h3>Informe de la investigación</h3>
                <div className="loading-bar" style={{ marginTop: 20 }}><div className="loading-bar-progress" /></div>
              </div>
            ) : (
              <div className="card anim-reveal" style={{ textAlign: 'center', padding: 'var(--sp-xl)', borderColor: newsEvent!.cop!.isKiller ? 'var(--danger)' : 'var(--success)', background: newsEvent!.cop!.isKiller ? 'rgba(224,82,82,0.08)' : 'rgba(76,175,130,0.08)' }}>
                <div style={{ fontSize: 56 }}>{newsEvent!.cop!.isKiller ? '🚨' : '✅'}</div>
                <h3 style={{ color: newsEvent!.cop!.isKiller ? 'var(--danger)' : 'var(--success)' }}>
                  {newsEvent!.cop!.isKiller ? '¡La policía tiene un asesino!' : 'La persona es inocente.'}
                </h3>
                <p style={{ fontSize: 'var(--text-sm)', marginTop: 8 }}>{newsEvent!.cop!.message}</p>
              </div>
            )}
          </div>
        )}

        {stage === 'done' && (
          <div className="anim-slide-up">
            <span className="form-label">Jugadores vivos — {room.players.filter(p => p.isAlive).length}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)', marginTop: 'var(--sp-sm)' }}>
              {room.players.map((p) => (
                <div key={p.deviceId} className={`player-card ${!p.isAlive ? 'eliminated' : ''}`}>
                  <div className="player-avatar">{p.name[0]?.toUpperCase()}</div>
                  <span className="player-name">{p.name}</span>
                  {!p.isAlive && <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Eliminado</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {stage === 'done' && (
        <div className="page-footer anim-slide-up">
          {isHost ? (
            <button className="btn btn-primary" onClick={() => { playTransition(); restoreMusic(900); onAdvance(); }} disabled={advancing}>
              {advancing ? 'Avanzando...' : '⚖️ Ir al Juicio Público →'}
            </button>
          ) : (
            <div className="info-box" style={{ textAlign: 'center' }}>Esperando que el host inicie el debate.</div>
          )}
        </div>
      )}
    </main>
  );
}

// =============================================================
// Sub-vista: Juicio Público (debate con temporizador)
// =============================================================
function TrialView({
  room,
  isHost,
  onAdvance,
  advancing,
}: {
  room: MultiRoomState;
  isHost: boolean;
  onAdvance: () => void;
  advancing: boolean;
}) {
  const [elapsed, setElapsed] = useState(0);
  const duration = room.config.trialDurationSeconds;
  const startedAt = room.game?.trialStartedAt ?? Date.now();

  useEffect(() => {
    if (!isHost) {
      return;
    }

    // Al entrar al juicio, el host mantiene la base pública de tensión.
    startBackgroundMusic();
  }, [isHost]);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const remaining = Math.max(0, duration - elapsed);
  const progress = Math.min(100, (elapsed / duration) * 100);
  const isWarning = remaining <= 30;
  const isOver = remaining === 0;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <main className="page-shell">
      <div className="page-header">
        <div className="phase-badge">⚖️ Juicio Público</div>
        <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          Ronda {room.game?.round}
        </span>
      </div>

      <div className="page-content" style={{ alignItems: 'center', textAlign: 'center' }}>
        {/* Timer */}
        <div style={{
          width: 160, height: 160, borderRadius: '50%',
          border: `6px solid ${isWarning ? 'var(--danger)' : 'var(--accent)'}`,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg-surface)',
          boxShadow: isWarning ? '0 0 30px rgba(224,82,82,0.2)' : '0 0 30px rgba(108,99,255,0.15)',
          transition: 'border-color 0.3s, box-shadow 0.3s',
        }}>
          <span style={{
            fontSize: 'var(--text-2xl)', fontWeight: 900,
            color: isWarning ? 'var(--danger)' : 'var(--text-primary)',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
          }}>
            {mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`}
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>
            restantes
          </span>
        </div>

        {/* Barra de progreso */}
        <div style={{
          width: '100%', height: 6, borderRadius: 3,
          background: 'var(--border)', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: isWarning ? 'var(--danger)' : 'var(--accent)',
            transition: 'width 0.5s linear, background 0.3s',
          }} />
        </div>

        {isOver && (
          <div className="info-box" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
            ⏰ ¡Tiempo agotado! El debate terminó.
          </div>
        )}

        <div className="info-box">
          🗣️ Debatan en persona. ¿Quién creen que es el asesino?
        </div>

        {/* Jugadores vivos */}
        <div style={{ width: '100%' }}>
          <span className="form-label" style={{ display: 'block', marginBottom: 'var(--sp-sm)' }}>
            Jugadores vivos
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-xs)', justifyContent: 'center' }}>
            {room.players.filter(p => p.isAlive).map((p) => (
              <div key={p.deviceId} style={{
                padding: '6px 12px', borderRadius: 'var(--radius-full)',
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                fontSize: 'var(--text-sm)', fontWeight: 600,
              }}>
                {p.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="page-footer">
        {isHost ? (
          <button
            id="btn-ir-a-votacion"
            className="btn btn-primary"
            onClick={() => {
              void playSound('ui.confirm');
              onAdvance();
            }}
            disabled={advancing}
            style={{ fontSize: 'var(--text-md)', padding: '16px' }}
          >
            {advancing ? 'Avanzando...' : '🗳️ Ir a Votación →'}
          </button>
        ) : (
          <div className="info-box" style={{ textAlign: 'center' }}>
            El host iniciará la votación.
          </div>
        )}
      </div>
    </main>
  );
}

// =============================================================
// Sub-vista: Votación
// =============================================================
function VoteView({
  me,
  room,
  deviceId,
  isHost,
  hasVoted,
  onVote,
}: {
  me: MultiPlayer;
  room: MultiRoomState;
  deviceId: string;
  isHost: boolean;
  hasVoted: boolean;
  onVote: (targetId: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const alivePlayers = room.players.filter((p) => p.isAlive && p.deviceId !== deviceId);
  const votedCount = Object.keys(room.game?.votes ?? {}).length;
  const totalVoters = room.players.filter((p) => p.isAlive).length;

  useEffect(() => {
    if (!isHost) {
      return;
    }

    void playSound('game.voteStart');
  }, [isHost]);

  async function handleVote() {
    if (!selected) return;
    void playSound('game.voteCast');
    setSubmitting(true);
    await onVote(selected);
  }

  if (!me.isAlive) {
    return (
      <main className="page-shell" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-lg)' }}>
          <div style={{ fontSize: 48 }}>🚫</div>
          <div>
            <h3>No puedes votar</h3>
            <p className="text-muted" style={{ marginTop: 8 }}>
              No puedes votar hasta el proximo juego.
            </p>
          </div>
          <div className="card" style={{ padding: 'var(--sp-md)', minWidth: 220, textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--accent)' }}>
              {votedCount}/{totalVoters}
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              votos emitidos
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (hasVoted) {
    const myTarget = room.game?.votes[deviceId];
    const targetName = room.players.find((p) => p.deviceId === myTarget)?.name ?? '?';

    return (
      <main className="page-shell" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-lg)' }}>
          <div style={{ fontSize: 48 }}>✅</div>
          <div>
            <h3>Voto emitido</h3>
            <p className="text-muted" style={{ marginTop: 8 }}>
              Votaste contra <strong>{targetName}</strong>
            </p>
          </div>
          <div className="card" style={{ padding: 'var(--sp-md)', minWidth: 200, textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--accent)' }}>
              {votedCount}/{totalVoters}
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              votos emitidos
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="page-header">
        <div className="phase-badge">🗳️ Votación</div>
        <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          {votedCount}/{totalVoters} votaron
        </span>
      </div>

      <div className="page-content">
        <div className="card" style={{ padding: 'var(--sp-md)' }}>
          <p style={{ fontSize: 'var(--text-sm)' }}>
            ¿A quién querés expulsar? El jugador con más votos queda eliminado. En empate, nadie es expulsado.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
          {alivePlayers.map((p, i) => (
            <button
              key={p.deviceId}
              onClick={() => {
                void playSound('ui.select');
                setSelected(sel => sel === p.deviceId ? null : p.deviceId);
              }}
              style={{
                background: 'none', border: 'none', padding: 0,
                textAlign: 'left', cursor: 'pointer',
                animation: `slideUp 0.28s ${i * 0.04}s both`,
              }}
            >
              <div className={`player-card ${selected === p.deviceId ? 'selected' : ''}`} style={{
                borderColor: selected === p.deviceId ? 'var(--danger)' : undefined,
                background: selected === p.deviceId ? 'rgba(224,82,82,0.08)' : undefined,
                transform: selected === p.deviceId ? 'scale(1.02)' : 'scale(1)',
                transition: 'all 0.15s',
              }}>
                <div className="player-avatar" style={{ borderColor: selected === p.deviceId ? 'var(--danger)' : undefined }}>
                  {p.name[0]?.toUpperCase()}
                </div>
                <span className="player-name">{p.name}</span>
                <span style={{
                  marginLeft: 'auto', color: 'var(--danger)', fontSize: 20,
                  opacity: selected === p.deviceId ? 1 : 0, transition: 'opacity 0.15s',
                }}>✓</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="page-footer">
        <button
          id="btn-confirmar-voto"
          className="btn btn-danger"
          onClick={handleVote}
          disabled={submitting || !selected}
          style={{ fontSize: 'var(--text-md)', padding: '16px' }}
        >
          {selected ? `Votar contra ${room.players.find(p => p.deviceId === selected)?.name ?? ''}` : 'Seleccioná un jugador'}
        </button>
      </div>
    </main>
  );
}

// =============================================================
// Sub-vista: Resolución de ronda / Fin de partida
// =============================================================
function ResolutionView({
  room,
  isHost,
  onAdvance,
  advancing,
  onRestart,
  restarting,
}: {
  room: MultiRoomState;
  isHost: boolean;
  onAdvance: () => void;
  advancing: boolean;
  onRestart: () => void;
  restarting: boolean;
}) {
  const router = useRouter();
  const lastReport = room.game?.reports[room.game.reports.length - 1];
  const isOver = room.game?.isOver ?? false;
  const winner = room.game?.winnerFaction;

  useEffect(() => {
    if (!isHost) {
      return;
    }

    // 1. Al entrar a la resolución, el host retoma la mezcla pública.
    startBackgroundMusic();
    duckMusic(0.05, 220);

    // 2. Disparar sonidos de veredicto
    const voteEndTimer = window.setTimeout(() => {
      void playSound('game.voteEnd');
    }, 120);

    const t = setTimeout(() => {
      // Nota: Si es multijugador presencial, el host es el que suele tener el sonido alto
      if (isOver) {
        if (winner === 'town') playVictory();
        else playDefeat();
      } else {
        playExpelled();
      }
    }, 400);

    return () => {
      clearTimeout(t);
      clearTimeout(voteEndTimer);
      restoreMusic(900);
    };
  }, [isHost, isOver, winner, lastReport?.expelled]);

  if (isOver) {
    return (
      <main className="page-shell" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-xl)', padding: 'var(--sp-xl)' }}>
          <div style={{ fontSize: 64 }}>
            {winner === 'killers' ? '🔪' : '⚖️'}
          </div>
          <div>
            <h2 style={{ color: winner === 'killers' ? 'var(--danger)' : 'var(--success)' }}>
              {winner === 'killers' ? '¡Los asesinos ganaron!' : '¡El pueblo ganó!'}
            </h2>
            <p className="text-muted" style={{ marginTop: 8 }}>
              {winner === 'killers'
                ? 'El crimen dominó la ciudad.'
                : 'La justicia triunfó.'}
            </p>
          </div>

          <div style={{ width: '100%' }}>
            <span className="form-label" style={{ display: 'block', marginBottom: 'var(--sp-sm)' }}>Resultado final</span>
            {room.players.map((p) => (
              <div key={p.deviceId} className="player-card" style={{ opacity: p.isAlive ? 1 : 0.5, marginBottom: 'var(--sp-xs)' }}>
                <div className="player-avatar">{p.name[0]?.toUpperCase()}</div>
                <span className="player-name">{p.name}</span>
                <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: p.isAlive ? 'var(--success)' : 'var(--text-muted)' }}>
                  {p.isAlive ? 'Vivo' : 'Eliminado'}
                </span>
              </div>
            ))}
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
            <button
              className="btn btn-primary"
              onClick={() => {
                void playSound('ui.confirm');
                onRestart();
              }}
              disabled={!isHost || restarting}
              style={{ fontSize: 'var(--text-md)', padding: '16px' }}
            >
              {isHost
                ? (restarting ? 'Reiniciando...' : 'Reiniciar con los mismos participantes')
                : 'Solo el host puede reiniciar'}
            </button>

            <button
              className="btn btn-ghost"
              onClick={() => {
                void playSound('ui.click', { bypassCooldown: true });
                router.push('/');
              }}
              style={{ fontSize: 'var(--text-md)', padding: '16px' }}
            >
              ← Volver al inicio
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="page-header">
        <div className="phase-badge">📋 Resolución</div>
        <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          Ronda {room.game?.round}
        </span>
      </div>

      <div className="page-content">
        {lastReport?.expelled ? (
          <div className="card" style={{ borderColor: 'var(--danger)', textAlign: 'center', padding: 'var(--sp-xl)' }}>
            <div style={{ fontSize: 48, marginBottom: 'var(--sp-sm)' }}>🚪</div>
            <p className="text-muted" style={{ fontSize: 'var(--text-sm)' }}>Expulsado/a por votación</p>
            <h2 style={{ color: 'var(--danger)', margin: 'var(--sp-sm) 0' }}>{lastReport.expelled}</h2>
            {lastReport.expelledWasKiller !== null && (
              <div className="info-box" style={{ marginTop: 'var(--sp-sm)', borderColor: lastReport.expelledWasKiller ? 'var(--danger)' : 'var(--success)', color: lastReport.expelledWasKiller ? 'var(--danger)' : 'var(--success)' }}>
                {lastReport.expelledWasKiller ? '🔪 Era un asesino.' : '✅ Era inocente.'}
              </div>
            )}
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--sp-xl)' }}>
            <div style={{ fontSize: 48, marginBottom: 'var(--sp-sm)' }}>🤝</div>
            <h3>Sin expulsados</h3>
            <p className="text-muted" style={{ marginTop: 8 }}>La votación terminó en empate. Nadie fue expulsado.</p>
          </div>
        )}

        {/* Jugadores */}
        <div>
          <span className="form-label">Jugadores vivos — {room.players.filter(p => p.isAlive).length}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)', marginTop: 'var(--sp-sm)' }}>
            {room.players.map((p) => (
              <div key={p.deviceId} className="player-card" style={{ opacity: p.isAlive ? 1 : 0.4 }}>
                <div className="player-avatar">{p.name[0]?.toUpperCase()}</div>
                <span className="player-name">{p.name}</span>
                {!p.isAlive && <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Eliminado</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="page-footer">
        {isHost ? (
          <button
            id="btn-siguiente-ronda"
            className="btn btn-primary"
            onClick={() => {
              void playSound('game.phaseTransition');
              onAdvance();
            }}
            disabled={advancing}
            style={{ fontSize: 'var(--text-md)', padding: '16px' }}
          >
            {advancing ? 'Avanzando...' : '🌙 Siguiente Ronda →'}
          </button>
        ) : (
          <div className="info-box" style={{ textAlign: 'center' }}>
            El host iniciará la siguiente ronda.
          </div>
        )}
      </div>
    </main>
  );
}

// =============================================================
// COMPONENTE PRINCIPAL — Router de fases
// =============================================================
export default function MultiGamePage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId as string;

  const {
    room,
    secret,
    deviceId,
    isHost,
    myPlayer,
    hasActed,
    hasVoted,
    loading,
    error,
    joinRoom,
    refresh,
  } = useMultiRoom();

  const [revealDone, setRevealDone] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [restarting, setRestarting] = useState(false);

  // Iniciar polling para esta sala
  useEffect(() => {
    if (roomId) joinRoom(roomId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Detectar si el jugador ya marcó su reveal en el estado de la sala
  useEffect(() => {
    setRevealDone(Boolean(myPlayer?.readyForOperative));
  }, [myPlayer]);

  if (loading && !room) {
    return (
      <main className="page-shell" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', gap: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 40 }}>⏳</div>
          <p>Cargando...</p>
        </div>
      </main>
    );
  }

  if (error && !room) {
    return (
      <main className="page-shell" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--sp-xl)' }}>
          <p style={{ color: 'var(--danger)' }}>{error}</p>
          <button className="btn btn-ghost" onClick={() => router.push('/')} style={{ marginTop: 16 }}>
            ← Volver al inicio
          </button>
        </div>
      </main>
    );
  }

  if (!room) return null;

  // Estado lobby → espera
  if (room.status === 'lobby' || !room.game) {
    return <WaitingView room={room} deviceId={deviceId} isHost={isHost} />;
  }

  const phase = room.game.phase;
  const me = myPlayer ?? room.players[0];

  // Acciones
  async function handleRevealReady() {
    await confirmReveal(roomId, deviceId);
    setRevealDone(true);
    await refresh();
  }

  async function handleAction(type: 'kill' | 'save' | 'inspect' | 'neutral', targetId: string | null) {
    await submitOperativeAction({ roomId, deviceId, action: { type, targetId } });
    await refresh();
  }

  async function handleVote(targetId: string) {
    await castVote({ roomId, deviceId, targetId });
    await refresh();
  }

  async function handleAdvance() {
    setAdvancing(true);
    await advancePhase({ roomId, deviceId });
    await refresh();
    setAdvancing(false);
  }

  async function handleRestart() {
    if (!isHost) {
      return;
    }

    setRestarting(true);
    const result = await restartGame({ roomId, deviceId });
    if (!result.ok) {
      void playSound('game.error');
      setRestarting(false);
      return;
    }

    void playSound('game.start');
    setRevealDone(false);
    await refresh();
    setRestarting(false);
  }

  // Router de fases
  if (phase === 'reveal') {
    return (
      <RevealView
        me={me}
        secret={secret}
        room={room}
        deviceId={deviceId}
        onReady={handleRevealReady}
        isReady={revealDone}
      />
    );
  }

  if (phase === 'operative') {
    if (!secret) return null;
    return (
      <OperativeView
        me={me}
        secret={secret}
        room={room}
        deviceId={deviceId}
        hasActed={hasActed}
        onAction={handleAction}
      />
    );
  }

  if (phase === 'news') {
    return (
      <NewsView
        room={room}
        isHost={isHost}
        onAdvance={handleAdvance}
        advancing={advancing}
      />
    );
  }

  if (phase === 'trial') {
    return (
      <TrialView
        room={room}
        isHost={isHost}
        onAdvance={handleAdvance}
        advancing={advancing}
      />
    );
  }

  if (phase === 'vote') {
    return (
      <VoteView
        me={me}
        room={room}
        deviceId={deviceId}
        isHost={isHost}
        hasVoted={hasVoted}
        onVote={handleVote}
      />
    );
  }

  if (phase === 'resolution') {
    return (
      <ResolutionView
        room={room}
        isHost={isHost}
        onAdvance={handleAdvance}
        advancing={advancing}
        onRestart={handleRestart}
        restarting={restarting}
      />
    );
  }

  return null;
}
