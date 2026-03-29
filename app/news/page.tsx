'use client';

// ============================================================
// app/news/page.tsx
// Noticias de Último Momento — muestra el reporte real de
// la ronda recién resuelta por el Operativo encubierto.
// ============================================================

import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { ROLE_LABELS } from '@/lib/game/state';
import { deriveNewsEvent, NEWS_ICONS, NEWS_COLORS } from '@/lib/game/news';

export default function NewsPage() {
  const router = useRouter();
  const { state, dispatch } = useGame();

  if (state.players.length === 0) {
    router.replace('/');
    return null;
  }

  const lastReport = state.reports[state.reports.length - 1];
  const newsEvent = lastReport ? deriveNewsEvent(lastReport) : null;
  const alivePlayers = state.players.filter((p) => p.isAlive);
  const eliminatedThisRound = state.players.filter(
    (p) => !p.isAlive && lastReport?.victim === p.name
  );

  const eventColor = newsEvent ? NEWS_COLORS[newsEvent.type] : 'var(--accent)';
  const eventIcon  = newsEvent ? NEWS_ICONS[newsEvent.type] : '📡';

  function handleGoToTrial() {
    dispatch({ type: 'NEXT_PHASE' }); // news → trial
    router.push('/trial');
  }

  function handleGoToResolution() {
    router.push('/resolution');
  }

  return (
    <main className="page-shell">
      {/* Header */}
      <div className="page-header">
        <div className="phase-badge">📰 Noticias</div>
        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginLeft: 'auto' }}>
          Ronda {lastReport?.round ?? state.round}
        </span>
      </div>

      <div className="page-content">

        {/* Etiqueta estilo noticiero */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 10px',
            borderRadius: 'var(--radius-full)',
            background: eventColor,
            color: '#fff',
            fontSize: 'var(--text-xs)',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            ● EN VIVO
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
            Parte oficial — Operativo Encubierto
          </span>
        </div>

        {/* Titular principal */}
        {newsEvent && (
          <div
            className="card"
            style={{
              borderColor: eventColor,
              padding: 'var(--sp-lg)',
            }}
          >
            {/* Ícono del evento */}
            <div style={{
              fontSize: 52,
              textAlign: 'center',
              marginBottom: 'var(--sp-md)',
              lineHeight: 1,
            }}>
              {eventIcon}
            </div>

            {/* Headline */}
            <h2
              style={{
                textAlign: 'center',
                fontSize: 'var(--text-lg)',
                lineHeight: 1.3,
                marginBottom: 'var(--sp-sm)',
              }}
            >
              {newsEvent.headline}
            </h2>

            {/* Detalle */}
            <p style={{ textAlign: 'center', fontSize: 'var(--text-sm)' }}>
              {newsEvent.detail}
            </p>

            {/* Víctima nombrada con ROL */}
            {newsEvent.victimName && (
              <div
                style={{
                  marginTop: 'var(--sp-md)',
                  padding: 'var(--sp-sm) var(--sp-md)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-elevated)',
                  border: `1px solid ${eventColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--sp-sm)',
                }}
              >
                <div
                  className="player-avatar"
                  style={{ borderColor: eventColor, flexShrink: 0 }}
                >
                  {newsEvent.victimName[0]?.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Identidad confirmada
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: eventColor }}>
                    {newsEvent.victimName}
                    {newsEvent.victimRole && (
                      <span style={{ fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 6 }}>
                        ({ROLE_LABELS[newsEvent.victimRole]})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Información policial */}
            {newsEvent.cop && (
              <div
                className={`info-box ${newsEvent.cop.isKiller ? 'success' : ''}`}
                style={{
                  marginTop: 'var(--sp-md)',
                  textAlign: 'center',
                  borderColor: 'var(--role-cop)',
                  background: newsEvent.cop.isKiller
                    ? 'rgba(76,175,130,0.1)'
                    : 'rgba(91,154,245,0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <span style={{ fontSize: 18 }}>🔍</span>
                <span style={{ fontWeight: 600, color: 'var(--role-cop)' }}>
                  {newsEvent.cop.message}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Aviso de fin de partida (tras muerte nocturna) */}
        {state.isOver && (
          <div
            className={`info-box ${state.winnerFaction === 'town' ? 'success' : 'danger'}`}
            style={{ textAlign: 'center' }}
          >
            {state.winnerFaction === 'town'
              ? '🏆 ¡El pueblo ganó! Todos los asesinos fueron eliminados.'
              : '💀 ¡Los asesinos ganaron! La ciudad cayó en sus manos.'}
          </div>
        )}

        {/* Separador — Estado de la partida */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Jugadores en pie
          </span>
          <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
        </div>

        {/* Lista de jugadores */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
          {state.players.map((player) => {
            const isVictimThisRound = eliminatedThisRound.some((p) => p.id === player.id);
            return (
              <div
                key={player.id}
                className={`player-card ${!player.isAlive ? 'eliminated' : ''}`}
              >
                <div
                  className="player-avatar"
                  style={{
                    opacity: player.isAlive ? 1 : 0.35,
                    borderColor: isVictimThisRound ? 'var(--danger)' : undefined,
                  }}
                >
                  {player.name[0]?.toUpperCase()}
                </div>
                <span className="player-name">{player.name}</span>
                {isVictimThisRound && (
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      fontWeight: 700,
                      color: 'var(--danger)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Eliminado esta noche
                  </span>
                )}
                {!player.isAlive && !isVictimThisRound && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    Fuera
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Conteo rápido */}
        <div
          className="card"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--sp-md)',
            padding: 'var(--sp-md)',
            textAlign: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>
              {alivePlayers.length}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Vivos
            </div>
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--danger)' }}>
              {state.players.filter((p) => !p.isAlive).length}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Eliminados
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="page-footer">
        {state.isOver ? (
          <button className="btn btn-primary" onClick={handleGoToResolution}>
            Ver resultado final →
          </button>
        ) : (
          <button className="btn btn-primary" onClick={handleGoToTrial}>
            Ir al Juicio Público →
          </button>
        )}
      </div>
    </main>
  );
}
