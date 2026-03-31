'use client';

// ============================================================
// app/multi/create/page.tsx
// Página de creación de sala multidispositivo (vista del host).
//
// El host configura la partida y genera la sala en Redis.
// Al crear → redirige a /multi/host/[roomId].
// ============================================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMultiRoom } from '@/context/MultiRoomContext';
import { createRoom } from '@/lib/multi/api';
import { saveHostRoom, saveLastRoom } from '@/lib/multi/device';
import { getRecommendedBalance } from '@/lib/game/rules';
import { playSound } from '@/lib/sounds';

export default function MultiCreatePage() {
  const router = useRouter();
  const { deviceId } = useMultiRoom();

  const [hostName, setHostName] = useState('');
  const [playerCount, setPlayerCount] = useState(6);
  const [killerCount, setKillerCount] = useState(1);
  const [copCount, setCopCount] = useState(1);
  const [trialDuration, setTrialDuration] = useState(120);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recommended = getRecommendedBalance(playerCount);
  const maxKillers = Math.max(1, Math.floor(playerCount / 3));

  function handlePlayerCountChange(n: number) {
    void playSound('ui.select', { bypassCooldown: true, volume: 0.6 });
    setPlayerCount(n);
    const rec = getRecommendedBalance(n);
    setKillerCount(rec.killers);
    setCopCount(rec.cops);
  }

  async function handleCreate() {
    if (!hostName.trim()) {
      void playSound('game.error');
      setError('Ingresá tu nombre antes de crear la sala.');
      return;
    }
    if (!deviceId) {
      void playSound('game.error');
      setError('Error al identificar tu dispositivo. Recargá la página.');
      return;
    }

    setCreating(true);
    setError(null);

    const result = await createRoom({
      config: { killerCount, copCount, trialDurationSeconds: trialDuration },
      hostName: hostName.trim(),
      deviceId,
    });

    if (!result.ok) {
      void playSound('game.error');
      setError(result.error);
      setCreating(false);
      return;
    }

    const { roomId } = result.data;
    saveHostRoom(roomId);
    saveLastRoom(roomId);

    void playSound('ui.joinRoom');
    router.push(`/multi/host/${roomId}`);
  }

  return (
    <main className="page-shell">
      <div className="page-header">
        <button
          className="btn btn-ghost btn-sm"
          style={{ width: 'auto' }}
          onClick={() => router.push('/')}
        >
          ← Volver
        </button>
        <div className="phase-badge">🌐 Modo Multidispositivo</div>
      </div>

      <div className="page-content">
        <div>
          <h2>Crear sala</h2>
          <p className="mt-sm">
            Configurá la partida. Luego compartís el QR y cada jugador entra desde su celular.
          </p>
        </div>

        {/* Nombre del host */}
        <div className="form-group">
          <span className="form-label">Tu nombre (host)</span>
          <input
            id="host-name-input"
            className="input"
            placeholder="Ej: Ana"
            value={hostName}
            onChange={(e) => setHostName(e.target.value)}
            maxLength={24}
            autoFocus
          />
        </div>

        {/* Cantidad de jugadores esperados */}
        <div className="form-group">
          <span className="form-label">Jugadores esperados — {playerCount}</span>
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
          style={{ padding: 'var(--sp-md)', background: 'var(--bg-elevated)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-sm)' }}>
            <span style={{
              fontSize: 'var(--text-xs)', fontWeight: 700,
              color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              ⚖️ Balance sugerido
            </span>
            <button
              className="btn btn-ghost btn-sm"
              style={{ width: 'auto', fontSize: 'var(--text-xs)', padding: '4px 10px' }}
              onClick={() => {
                void playSound('ui.confirm');
                setKillerCount(recommended.killers);
                setCopCount(recommended.cops);
              }}
            >
              Aplicar
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-sm)', textAlign: 'center' }}>
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

        {/* Asesinos */}
        <div className="form-group">
          <span className="form-label">Asesinos — {killerCount}</span>
          <input
            type="range" min={1} max={maxKillers} value={killerCount}
            onChange={(e) => setKillerCount(Number(e.target.value))}
            style={{ accentColor: 'var(--danger)', width: '100%' }}
          />
        </div>

        {/* Policías */}
        <div className="form-group">
          <span className="form-label">Policías — {copCount}</span>
          <input
            type="range" min={1} max={2} value={copCount}
            onChange={(e) => setCopCount(Number(e.target.value))}
            style={{ accentColor: 'var(--role-cop)', width: '100%' }}
          />
        </div>

        {/* Tiempo de debate */}
        <div className="form-group">
          <span className="form-label">
            Tiempo de debate —{' '}
            {trialDuration >= 60
              ? `${Math.floor(trialDuration / 60)}min${trialDuration % 60 > 0 ? ` ${trialDuration % 60}s` : ''}`
              : `${trialDuration}s`}
          </span>
          <input
            type="range" min={30} max={300} step={30} value={trialDuration}
            onChange={(e) => setTrialDuration(Number(e.target.value))}
            style={{ accentColor: 'var(--accent)', width: '100%' }}
          />
        </div>

        {error && (
          <div className="info-box" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
            ⚠️ {error}
          </div>
        )}

        <div className="info-box">
          🔐 Los roles se asignan en el servidor cuando iniciás la partida. Nadie puede ver los de los demás.
        </div>
      </div>

      <div className="page-footer">
        <button
          id="btn-crear-sala"
          className="btn btn-primary"
          onClick={handleCreate}
          disabled={creating || !hostName.trim()}
          style={{ fontSize: 'var(--text-md)', padding: '16px' }}
        >
          {creating ? 'Creando sala...' : '🌐 Crear sala →'}
        </button>
      </div>
    </main>
  );
}
