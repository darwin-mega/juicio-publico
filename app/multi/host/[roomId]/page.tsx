'use client';

// ============================================================
// app/multi/host/[roomId]/page.tsx
// Sala de espera del host.
//
// Muestra QR + enlace copiable, lista de jugadores conectados.
// El host puede iniciar la partida cuando hay suficientes jugadores.
// ============================================================

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useMultiRoom } from '@/context/MultiRoomContext';
import { startGame } from '@/lib/multi/api';
import QRCode from '@/components/QRCode';
import { playSound, startMatchAmbience } from '@/lib/sounds';



export default function MultiHostPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId as string;
  const { room, deviceId, isHost, loading, error, joinRoom } = useMultiRoom();
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Iniciar polling para esta sala
  useEffect(() => {
    if (roomId) joinRoom(roomId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Si la partida inicia → navegar al juego
  useEffect(() => {
    if (room?.status === 'playing' && room.game) {
      router.replace(`/multi/game/${roomId}`);
    }
  }, [room, roomId, router]);

  const inviteUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/join/${roomId}`
      : `/join/${roomId}`;

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      void playSound('ui.confirm');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      void playSound('game.error');
    }
  }

  async function handleStart() {
    setStarting(true);
    setStartError(null);
    const result = await startGame({ roomId, deviceId });
    if (!result.ok) {
      void playSound('game.error');
      setStartError(result.error);
      setStarting(false);
      return;
    }
    void playSound('game.start');
    void startMatchAmbience({ restart: true });
    router.push(`/multi/game/${roomId}`);
  }

  const playerCount = room?.players.length ?? 0;
  const canStart = playerCount >= 4;

  if (loading && !room) {
    return (
      <main className="page-shell" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', gap: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 40 }}>⏳</div>
          <p>Cargando sala...</p>
        </div>
      </main>
    );
  }

  if (error && !room) {
    return (
      <main className="page-shell" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--sp-xl)' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>❌</div>
          <p style={{ color: 'var(--danger)' }}>{error}</p>
          <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => router.push('/multi/create')}>
            ← Crear nueva sala
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="page-header">
        <button className="btn btn-ghost btn-sm" style={{ width: 'auto' }} onClick={() => router.push('/')}>
          ← Inicio
        </button>
        <div className="phase-badge">🌐 Sala de espera</div>
      </div>

      <div className="page-content">

        {/* Código de sala */}
        <div style={{ textAlign: 'center' }}>
          <p className="text-muted" style={{ marginBottom: 4, fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Código de sala
          </p>
          <div style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 900,
            letterSpacing: '0.15em',
            color: 'var(--accent)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {roomId}
          </div>
        </div>

        {/* QR y enlace */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-md)' }}>
          <QRCode value={inviteUrl} size={180} />

          <button
            id="btn-copiar-enlace"
            className="btn btn-ghost"
            style={{ fontSize: 'var(--text-sm)' }}
            onClick={handleCopyLink}
          >
            {copied ? '✅ Enlace copiado' : '🔗 Copiar enlace de invitación'}
          </button>

          <div className="info-box" style={{ fontSize: 'var(--text-xs)', textAlign: 'center', wordBreak: 'break-all' }}>
            {inviteUrl}
          </div>
        </div>

        {/* Lista de jugadores */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-sm)' }}>
            <span className="form-label">
              Jugadores conectados
            </span>
            <span style={{
              fontSize: 'var(--text-xs)', fontWeight: 700,
              color: playerCount >= 4 ? 'var(--success)' : 'var(--text-muted)',
            }}>
              {playerCount} / necesarios 4+
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
            {room?.players.map((player, i) => (
              <div key={player.deviceId} className="player-card" style={{
                borderColor: player.deviceId === deviceId ? 'var(--accent)' : undefined,
              }}>
                <div className="player-avatar" style={{
                  borderColor: player.deviceId === deviceId ? 'var(--accent)' : undefined,
                }}>
                  {player.name[0]?.toUpperCase() ?? '?'}
                </div>
                <span className="player-name">
                  {player.name}
                  {player.deviceId === deviceId && (
                    <span style={{ color: 'var(--accent)', marginLeft: 8, fontSize: 'var(--text-xs)' }}>
                      (Vos — Host)
                    </span>
                  )}
                </span>
                <span style={{ color: 'var(--success)', fontSize: 'var(--text-xs)' }}>● Conectado</span>
              </div>
            ))}
          </div>

          {!canStart && (
            <div className="info-box" style={{ marginTop: 'var(--sp-md)' }}>
              Faltan {Math.max(0, 4 - playerCount)} jugadores como mínimo para iniciar.
            </div>
          )}
        </div>

        {startError && (
          <div className="info-box" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
            ⚠️ {startError}
          </div>
        )}
      </div>

      <div className="page-footer">
        {isHost && (
          <button
            id="btn-iniciar-partida"
            className="btn btn-primary"
            onClick={handleStart}
            disabled={!canStart || starting}
            style={{ fontSize: 'var(--text-md)', padding: '16px' }}
          >
            {starting ? 'Iniciando...' : `⚖️ Iniciar Partida (${playerCount} jugadores)`}
          </button>
        )}
        {!isHost && (
          <div className="info-box" style={{ textAlign: 'center' }}>
            Esperando que el host inicie la partida...
          </div>
        )}
      </div>
    </main>
  );
}
