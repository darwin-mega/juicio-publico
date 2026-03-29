'use client';

// ============================================================
// app/resolution/page.tsx
// Resolución de ronda — muestra el veredicto de la votación,
// detecta condición de victoria y conecta a la siguiente ronda
// o a la pantalla de fin de partida.
// ============================================================

import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { ROLE_LABELS } from '@/lib/game/state';
import { ROLE_COLORS, ROLE_EMOJIS } from '@/lib/modes/table';

export default function ResolutionPage() {
  const router = useRouter();
  const { state, dispatch, clearSave } = useGame();

  if (state.players.length === 0) {
    router.replace('/');
    return null;
  }

  const lastReport = state.reports[state.reports.length - 1];
  const expelled = lastReport?.expelled ?? null;
  const expelledWasKiller = lastReport?.expelledWasKiller ?? null;
  const expelledPlayer = state.players.find((p) => p.name === expelled);

  const alivePlayers = state.players.filter((p) => p.isAlive);
  const aliveKillers = alivePlayers.filter((p) => p.role === 'killer').length;

  function handleNewRound() {
    dispatch({ type: 'NEXT_PHASE' }); // resolution → operative + incrementa ronda
    router.push('/operative');
  }

  function handleRestart() {
    clearSave(); // Limpia localStorage y resetea estado
    router.push('/');
  }

  // ── Pantalla de FIN DE PARTIDA ───────────────────────────
  if (state.isOver) {
    const townWon = state.winnerFaction === 'town';
    return (
      <main className="page-shell" style={{ justifyContent: 'center' }}>
        <div className="page-content" style={{ justifyContent: 'center' }}>
          {/* Tarjeta de ganador */}
          <div
            className="card"
            style={{
              textAlign: 'center',
              borderColor: townWon ? 'var(--success)' : 'var(--danger)',
              padding: 'var(--sp-xl)',
            }}
          >
            <div style={{ fontSize: 72, marginBottom: 'var(--sp-sm)', lineHeight: 1 }}>
              {townWon ? '🏆' : '☠️'}
            </div>
            <div style={{
              fontSize: 'var(--text-xs)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: townWon ? 'var(--success)' : 'var(--danger)',
              marginBottom: 'var(--sp-sm)',
              fontWeight: 700,
            }}>
              {townWon ? 'El pueblo ganó' : 'Los asesinos ganaron'}
            </div>
            <h2 style={{ marginBottom: 'var(--sp-sm)' }}>
              {townWon ? '¡Justicia!' : '¡La ciudad cayó!'}
            </h2>
            <p style={{ fontSize: 'var(--text-sm)' }}>
              {townWon
                ? 'Todos los asesinos fueron eliminados. El pueblo venció al crimen.'
                : 'Los asesinos tomaron el control. Nadie está a salvo.'}
            </p>

            {/* Expulsado de esta última ronda */}
            {expelled && expelledPlayer && (
              <div style={{
                marginTop: 'var(--sp-lg)',
                padding: 'var(--sp-sm) var(--sp-md)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-elevated)',
                display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)',
              }}>
                <div
                  className="player-avatar"
                  style={{ borderColor: ROLE_COLORS[expelledPlayer.role] }}
                >
                  {expelled[0]?.toUpperCase()}
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Último expulsado</div>
                  <div style={{ fontWeight: 700 }}>{expelled}</div>
                </div>
                <span className={`role-badge role-${expelledPlayer.role}`} style={{ marginLeft: 'auto' }}>
                  {ROLE_LABELS[expelledPlayer.role]}
                </span>
              </div>
            )}
          </div>

          {/* Todos los roles revelados */}
          <div>
            <span className="form-label">Roles de todos los jugadores</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)', marginTop: 'var(--sp-sm)' }}>
              {state.players.map((player) => (
                <div
                  key={player.id}
                  className={`player-card ${!player.isAlive ? 'eliminated' : ''}`}
                >
                  <div
                    className="player-avatar"
                    style={{
                      opacity: player.isAlive ? 1 : 0.4,
                      borderColor: ROLE_COLORS[player.role],
                    }}
                  >
                    {player.name[0]?.toUpperCase()}
                  </div>
                  <span className="player-name">{player.name}</span>
                  <span style={{ fontSize: 18 }}>{ROLE_EMOJIS[player.role]}</span>
                  <span className={`role-badge role-${player.role}`}>
                    {ROLE_LABELS[player.role]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="page-footer">
          <button className="btn btn-primary" onClick={handleRestart}>
            Nueva Partida
          </button>
        </div>
      </main>
    );
  }

  // ── Pantalla de RESOLUCIÓN DE RONDA (juego continúa) ─────
  return (
    <main className="page-shell">
      <div className="page-header">
        <div className="phase-badge">🏛️ Veredicto</div>
        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginLeft: 'auto' }}>
          Ronda {state.round}
        </span>
      </div>

      <div className="page-content">

        {/* Resultado de la votación */}
        {expelled && expelledPlayer ? (
          <div
            className="card"
            style={{
              textAlign: 'center',
              borderColor: expelledWasKiller ? 'var(--success)' : 'var(--warning)',
              padding: 'var(--sp-xl)',
            }}
          >
            <div style={{ fontSize: 52, marginBottom: 'var(--sp-sm)', lineHeight: 1 }}>
              {expelledWasKiller ? '✅' : '❌'}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: 4 }}>
              El pueblo expulsó a
            </p>
            <h2 style={{ marginBottom: 'var(--sp-sm)' }}>{expelled}</h2>
            <div style={{ marginBottom: 'var(--sp-md)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 22 }}>{ROLE_EMOJIS[expelledPlayer.role]}</span>
              <span className={`role-badge role-${expelledPlayer.role}`}>
                {ROLE_LABELS[expelledPlayer.role]}
              </span>
            </div>
            <div
              style={{
                padding: 'var(--sp-sm) var(--sp-md)',
                borderRadius: 'var(--radius-md)',
                background: expelledWasKiller ? 'rgba(34,197,94,0.1)' : 'rgba(234,179,8,0.1)',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: expelledWasKiller ? 'var(--success)' : 'var(--warning)',
              }}
            >
              {expelledWasKiller ? '¡Era uno de los asesinos!' : 'Era un inocente. El pueblo se equivocó.'}
            </div>
          </div>
        ) : (
          // Empate: nadie expulsado
          <div
            className="card"
            style={{ textAlign: 'center', borderColor: 'var(--accent)', padding: 'var(--sp-xl)' }}
          >
            <div style={{ fontSize: 52, marginBottom: 'var(--sp-sm)' }}>⚖️</div>
            <h3 style={{ marginBottom: 'var(--sp-sm)' }}>Empate en la votación</h3>
            <p style={{ fontSize: 'var(--text-sm)' }}>
              Nadie fue expulsado esta ronda. La ciudad sigue en peligro.
            </p>
          </div>
        )}

        {/* Estado del juego */}
        <div
          className="card"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 'var(--sp-sm)',
            padding: 'var(--sp-md)',
            textAlign: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{alivePlayers.length}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Vivos</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--danger)' }}>{aliveKillers}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Asesinos</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{state.round}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ronda</div>
          </div>
        </div>

        {/* Lista de jugadores vivos */}
        <div>
          <span className="form-label">Jugadores vivos</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)', marginTop: 'var(--sp-sm)' }}>
            {alivePlayers.map((player) => (
              <div key={player.id} className="player-card">
                <div className="player-avatar">{player.name[0]?.toUpperCase()}</div>
                <span className="player-name">{player.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="page-footer" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
        <button className="btn btn-primary" onClick={handleNewRound}>
          ▶ Iniciar Ronda {state.round + 1} →
        </button>
        <button className="btn btn-ghost" onClick={handleRestart} style={{ fontSize: 'var(--text-sm)' }}>
          Terminar partida
        </button>
      </div>
    </main>
  );
}
