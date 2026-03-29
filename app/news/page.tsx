'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useGame } from '@/context/GameContext';
import { ROLE_LABELS } from '@/lib/game/state';
import { deriveNewsEvent, NEWS_ICONS, NEWS_COLORS } from '@/lib/game/news';
import {
  playTension,
  playDeath,
  playSaved,
  playCalm,
  playAccusation,
  playInnocent,
  playClick,
} from '@/lib/sounds';

type RevealStage = 'loading' | 'main' | 'cop' | 'done';

export default function NewsPage() {
  const router = useRouter();
  const { state, dispatch } = useGame();

  const [stage, setStage] = useState<RevealStage>('loading');
  const [showCopResult, setShowCopResult] = useState(false);

  const lastReport = state.reports[state.reports.length - 1];
  const newsEvent = lastReport ? deriveNewsEvent(lastReport) : null;
  const alivePlayers = state.players.filter((p) => p.isAlive);

  if (state.players.length === 0) {
    router.replace('/');
    return null;
  }

  const eventColor = newsEvent ? NEWS_COLORS[newsEvent.type] : 'var(--accent)';
  const eventIcon  = newsEvent ? NEWS_ICONS[newsEvent.type] : '📡';
  const hasCopResult = !!newsEvent?.cop;

  // ── Secuencia de revelación dramática ────────────────────
  useEffect(() => {
    // Fase 1: Tensión mientras "carga" la noticia (2.5s)
    playTension();
    const t1 = setTimeout(() => {
      setStage('main');
      // Sonido según el tipo de evento
      if (newsEvent?.type === 'death')  setTimeout(playDeath,  200);
      if (newsEvent?.type === 'saved')  setTimeout(playSaved,  200);
      if (newsEvent?.type === 'calm')   setTimeout(playCalm,   200);
    }, 2500);

    // Fase 2: Si hay resultado policial, mostrarlo 3s después del evento principal
    const t2 = hasCopResult
      ? setTimeout(() => setStage('cop'), 5500)
      : setTimeout(() => setStage('done'), 5000);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => {
    if (stage === 'cop' && newsEvent?.cop) {
      setTimeout(() => {
        if (newsEvent.cop!.isKiller) playAccusation();
        else playInnocent();
        setShowCopResult(true);
      }, 600);
      setTimeout(() => setStage('done'), 3000);
    }
  }, [stage]);

  function handleGoToTrial() {
    playClick();
    dispatch({ type: 'NEXT_PHASE' });
    router.push('/trial');
  }

  function handleGoToResolution() {
    playClick();
    router.push('/resolution');
  }

  // ── Pantalla de loading / tensión ────────────────────────
  if (stage === 'loading') {
    return (
      <main className="page-shell" style={{ justifyContent: 'center', textAlign: 'center' }}>
        <div className="anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-xl)', alignItems: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '4px 14px', borderRadius: 'var(--radius-full)',
            background: 'var(--danger)', color: '#fff',
            fontSize: 'var(--text-xs)', fontWeight: 800,
            letterSpacing: '0.1em', animation: 'blink 0.9s ease-in-out infinite',
          }}>
            ● EN VIVO
          </div>

          <div style={{ fontSize: 64, animation: 'float 2s ease-in-out infinite' }}>📡</div>

          <div>
            <h2 style={{ marginBottom: 8 }}>Noticias de Último Momento</h2>
            <p className="text-muted" style={{ fontSize: 'var(--text-sm)' }}>
              Aguardá… estamos recibiendo el informe…
            </p>
          </div>

          <div style={{
            display: 'flex', gap: 8, justifyContent: 'center',
          }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{
                width: 10, height: 10, borderRadius: '50%',
                background: 'var(--accent)',
                animation: `blink 1.2s ${i * 0.4}s ease-in-out infinite`,
              }} />
            ))}
          </div>
        </div>
      </main>
    );
  }

  // ── Pantalla principal con revelación ────────────────────
  return (
    <main className="page-shell">
      <div className="page-header">
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '3px 10px', borderRadius: 'var(--radius-full)',
          background: eventColor, color: '#fff',
          fontSize: 'var(--text-xs)', fontWeight: 700,
          letterSpacing: '0.08em', animation: stage === 'main' ? 'blink 1.5s ease-in-out 3' : 'none',
        }}>
          ● EN VIVO
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginLeft: 'auto' }}>
          Ronda {lastReport?.round ?? state.round}
        </span>
      </div>

      <div className="page-content">

        {/* Evento principal */}
        {(stage === 'main' || stage === 'cop' || stage === 'done') && newsEvent && (
          <div className="card anim-reveal" style={{ borderColor: eventColor, padding: 'var(--sp-lg)', textAlign: 'center' }}>
            <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 'var(--sp-md)',
              animation: 'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both' }}>
              {eventIcon}
            </div>
            <h2 style={{ fontSize: 'var(--text-lg)', lineHeight: 1.3, marginBottom: 'var(--sp-sm)' }}>
              {newsEvent.headline}
            </h2>
            <p style={{ fontSize: 'var(--text-sm)' }}>{newsEvent.detail}</p>

            {/* Víctima revelada */}
            {newsEvent.victimName && (
              <div className="anim-slide-up" style={{
                marginTop: 'var(--sp-md)', padding: 'var(--sp-sm) var(--sp-md)',
                borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)',
                border: `1px solid ${eventColor}`, display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)',
              }}>
                <div className="player-avatar" style={{ borderColor: eventColor, flexShrink: 0 }}>
                  {newsEvent.victimName[0]?.toUpperCase()}
                </div>
                <div style={{ textAlign: 'left' }}>
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
          </div>
        )}

        {/* Sección policial — tap para revelar o auto-revela */}
        {(stage === 'cop' || stage === 'done') && hasCopResult && (
          <div className="anim-slide-up">
            {!showCopResult ? (
              /* Suspense antes de revelar */
              <div className="card" style={{ textAlign: 'center', padding: 'var(--sp-xl)', borderColor: 'var(--role-cop)' }}>
                <div style={{ fontSize: 40, animation: 'float 1.5s ease-in-out infinite' }}>🔍</div>
                <h3 style={{ marginTop: 'var(--sp-sm)', color: 'var(--role-cop)' }}>
                  Resultado de la investigación
                </h3>
                <p className="text-muted" style={{ fontSize: 'var(--text-sm)', marginTop: 8 }}>
                  Esta noche la policía investigó a alguien…
                </p>
                <div className="loading-bar" style={{ marginTop: 'var(--sp-md)' }}>
                  <div className="loading-bar-progress" />
                </div>
              </div>
            ) : (
              /* Resultado policial revelado */
              <div
                className={`card anim-reveal`}
                style={{
                  textAlign: 'center', padding: 'var(--sp-xl)',
                  borderColor: newsEvent!.cop!.isKiller ? 'var(--danger)' : 'var(--success)',
                  background: newsEvent!.cop!.isKiller
                    ? 'rgba(224,82,82,0.08)' : 'rgba(76,175,130,0.08)',
                }}
              >
                <div style={{ fontSize: 52, animation: 'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both' }}>
                  {newsEvent!.cop!.isKiller ? '🚨' : '✅'}
                </div>
                <h3 style={{
                  marginTop: 'var(--sp-sm)',
                  color: newsEvent!.cop!.isKiller ? 'var(--danger)' : 'var(--success)',
                }}>
                  {newsEvent!.cop!.isKiller
                    ? '¡La policía tiene un asesino fichado!'
                    : 'La persona investigada es inocente.'}
                </h3>
                <p style={{
                  fontSize: 'var(--text-sm)', marginTop: 8,
                  color: newsEvent!.cop!.isKiller ? 'var(--danger)' : 'var(--text-secondary)',
                  fontWeight: newsEvent!.cop!.isKiller ? 700 : 400,
                }}>
                  {newsEvent!.cop!.message}
                </p>
                <p className="text-muted" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--sp-sm)' }}>
                  Usad esta información en el juicio.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Fin de partida nocturno */}
        {state.isOver && (stage === 'cop' || stage === 'done') && (
          <div className={`info-box ${state.winnerFaction === 'town' ? 'success' : 'danger'} anim-slide-up`}
            style={{ textAlign: 'center' }}>
            {state.winnerFaction === 'town'
              ? '🏆 ¡El pueblo ganó! Todos los asesinos fueron eliminados.'
              : '💀 ¡Los asesinos ganaron! La ciudad cayó en sus manos.'}
          </div>
        )}

        {/* Estado de jugadores */}
        {stage === 'done' && (
          <div className="anim-slide-up">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-sm)' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
              <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase' }}>
                En pie — {alivePlayers.length}
              </span>
              <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
              {state.players.map((player) => (
                <div key={player.id} className={`player-card ${!player.isAlive ? 'eliminated' : ''}`}>
                  <div className="player-avatar" style={{ opacity: player.isAlive ? 1 : 0.35 }}>
                    {player.name[0]?.toUpperCase()}
                  </div>
                  <span className="player-name">{player.name}</span>
                  {!player.isAlive && (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      Eliminado
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer — aparece al final */}
      {stage === 'done' && (
        <div className="page-footer anim-slide-up">
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
      )}
    </main>
  );
}
