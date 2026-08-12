'use client';

// ============================================================
// app/join/[roomId]/page.tsx
// Página de ingreso a sala para jugadores que escanean el QR.
//
// 1. Obtiene el roomId de la URL
// 2. Verifica que la sala existe
// 3. Pide el nombre del jugador
// 4. Llama a POST /api/multi/join
// 5. Redirige a /multi/game/[roomId]
// ============================================================

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useMultiRoom } from '@/context/MultiRoomContext';
import { getRoomState, joinRoom as apiJoinRoom } from '@/lib/multi/api';
import { saveLastRoom } from '@/lib/multi/device';
import { playSound } from '@/lib/sounds';

export default function JoinPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = (params.roomId as string)?.toUpperCase();
  const { deviceId } = useMultiRoom();

  const [name, setName] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomStatus, setRoomStatus] = useState<'checking' | 'ok' | 'notfound' | 'started'>('checking');

  // Verificar que la sala existe
  useEffect(() => {
    if (!roomId || !deviceId) return;
    getRoomState(roomId, deviceId).then((result) => {
      if (!result.ok) {
        setRoomStatus('notfound');
        return;
      }
      const room = result.data;
      // Si el jugador ya estaba en la sala (reconexión)
      const existing = room.players.find((p) => p.deviceId === deviceId);
      if (existing) {
        saveLastRoom(roomId);
        router.replace(`/multi/game/${roomId}`);
        return;
      }
      setRoomStatus(room.status === 'lobby' ? 'ok' : 'started');
    });
  }, [roomId, deviceId, router]);

  async function handleJoin() {
    if (!name.trim()) {
      void playSound('game.error');
      setError('Ingresá tu nombre para continuar.');
      return;
    }
    if (!deviceId) {
      void playSound('game.error');
      setError('No se pudo identificar tu dispositivo. Recargá la página.');
      return;
    }

    setJoining(true);
    setError(null);

    const result = await apiJoinRoom({
      roomId,
      name: name.trim(),
      deviceId,
    });

    if (!result.ok) {
      void playSound('game.error');
      setError(result.error);
      setJoining(false);
      return;
    }

    saveLastRoom(roomId);
    void playSound('ui.joinRoom');
    router.push(`/multi/game/${roomId}`);
  }

  // Estados de carga / error
  if (roomStatus === 'checking') {
    return (
      <main className="page-shell" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 40 }}>🔍</div>
          <p>Verificando sala <strong>{roomId}</strong>...</p>
        </div>
      </main>
    );
  }

  if (roomStatus === 'notfound') {
    return (
      <main className="page-shell" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--sp-xl)' }}>
          <div style={{ fontSize: 44, marginBottom: 16 }}>❌</div>
          <h3>Sala no encontrada</h3>
          <p className="text-muted" style={{ marginTop: 8 }}>
            El código <strong>{roomId}</strong> no existe o expiró.
          </p>
          <button className="btn btn-ghost" style={{ marginTop: 24 }} onClick={() => router.push('/')}>
            ← Volver al inicio
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="page-header">
        <div className="phase-badge">🌐 Unirse a sala</div>
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
          {roomId}
        </span>
      </div>

      <div className="page-content" style={{ justifyContent: 'center', flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--sp-lg)' }}>

        {/* Bienvenida */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)', alignItems: 'center' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'var(--accent-dim)', border: '2px solid var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
          }}>
            ⚖️
          </div>
          <h2>Juicio Público</h2>
          <p className="text-muted">
            Sala <strong style={{ color: 'var(--accent)' }}>{roomId}</strong>
          </p>
          <p style={{ fontSize: 'var(--text-sm)' }}>
            {roomStatus === 'started'
              ? 'Si ya estabas en esta partida, ingresá el mismo nombre o entrá con tu cuenta para reconectar.'
              : 'Ingresá tu nombre para participar en la partida.'}
          </p>
        </div>

        {/* Input de nombre */}
        <div className="form-group">
          <span className="form-label">Tu nombre</span>
          <input
            id="player-name-input"
            className="input"
            placeholder="¿Cómo te llamás?"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter' && !joining) handleJoin(); }}
            style={{ fontSize: 'var(--text-md)', padding: '14px 16px' }}
          />
        </div>

        {error && (
          <div className="info-box" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
            ⚠️ {error}
          </div>
        )}

        <div className="info-box">
          {roomStatus === 'started'
            ? 'La sala sigue activa mientras dure la partida. El reingreso evita duplicados si es el mismo dispositivo o la misma cuenta.'
            : 'Tu dispositivo quedará vinculado a tu jugador. Si recargás la página, volvés automáticamente a la partida.'}
        </div>
      </div>

      <div className="page-footer">
        <button
          id="btn-unirse-sala"
          className="btn btn-primary"
          onClick={handleJoin}
          disabled={joining || !name.trim()}
          style={{ fontSize: 'var(--text-md)', padding: '16px' }}
        >
          {joining ? 'Entrando...' : roomStatus === 'started' ? 'Reingresar a la partida →' : '🚀 Entrar a la sala →'}
        </button>
      </div>
    </main>
  );
}
