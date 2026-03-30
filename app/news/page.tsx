'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useGame } from '@/context/GameContext';
import { ROLE_LABELS } from '@/lib/game/state';
import { deriveNewsEvent, NEWS_ICONS, NEWS_COLORS } from '@/lib/game/news';
import {
  playNewsJingle, playDeath, playSaved, playCalm,
  playAccusation, playInnocent, playClick, playTransition,
} from '@/lib/sounds';

type Stage = 'jingle' | 'main' | 'cop' | 'done';

export default function NewsPage() {
  const router = useRouter();
  const { state, dispatch } = useGame();

  const [stage,         setStage]         = useState<Stage>('jingle');
  const [copRevealed,   setCopRevealed]   = useState(false);
  const [headlineReady, setHeadlineReady] = useState(false);

  const lastReport = state.reports[state.reports.length - 1];
  const newsEvent  = lastReport ? deriveNewsEvent(lastReport) : null;
  const alivePlayers = state.players.filter((p) => p.isAlive);
  const hasCop = !!newsEvent?.cop;

  const eventColor = newsEvent ? NEWS_COLORS[newsEvent.type] : 'var(--accent)';
  const eventIcon  = newsEvent ? NEWS_ICONS[newsEvent.type]  : '📡';

  // ── Secuencia de revelación ───────────────────────────────
  useEffect(() => {
    // Redirección segura dentro del hook
    if (state.players.length === 0) {
      router.replace('/');
      return;
    }

    // Jingle inmediato al montar
    playNewsJingle();

    // Después del jingle (~3.2s) → mostrar titular
    const t1 = setTimeout(() => {
      setStage('main');
      setHeadlineReady(true);
      // Sonido según tipo de evento
      if      (newsEvent?.type === 'death') setTimeout(playDeath, 300);
      else if (newsEvent?.type === 'saved') setTimeout(playSaved, 300);
      else                                   setTimeout(playCalm,  300);
    }, 3300);

    // Después del titular (3s) → sección policial (si existe)
    const t2 = hasCop
      ? setTimeout(() => setStage('cop'), 6800)
      : setTimeout(() => setStage('done'), 6500);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Revelar resultado policial con sonido
  useEffect(() => {
    if (stage !== 'cop') return;
    const t = setTimeout(() => {
      setCopRevealed(true);
      if (newsEvent?.cop?.isKiller) playAccusation();
      else                          playInnocent();
      setTimeout(() => setStage('done'), 3200);
    }, 800);
    return () => clearTimeout(t);
  }, [stage, newsEvent?.cop?.isKiller]);

  function goToTrial() { playTransition(); dispatch({ type: 'NEXT_PHASE' }); router.push('/trial'); }
  function goToResolution() { playTransition(); router.push('/resolution'); }

  // Retorno temprano movido aquí para cumplir las reglas de hooks
  if (state.players.length === 0) return null;

  // ── FASE JINGLE — pantalla de apertura ────────────────────
  if (stage === 'jingle') {
    return (
      <main className="page-shell" style={{ justifyContent: 'center', textAlign: 'center', background: 'var(--bg-base)' }}>
        <div className="anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-xl)', alignItems: 'center' }}>

          {/* Indicador EN VIVO pulsante */}
          <div style={{
            display: 'inline-flex', gap: 8, alignItems: 'center',
            padding: '6px 18px', borderRadius: 'var(--radius-full)',
            background: '#e05252', color: '#fff',
            fontSize: 'var(--text-sm)', fontWeight: 800, letterSpacing: '0.12em',
            animation: 'blink 0.8s ease-in-out infinite',
          }}>
            ● EN VIVO
          </div>

          {/* Logo / nombre del noticiero */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            animation: 'revealCard 0.6s 0.4s both',
          }}>
            <div style={{ fontSize: 64, animation: 'float 2.5s ease-in-out infinite' }}>📡</div>
            <h1 style={{
              fontFamily: 'var(--font-heading, Bebas Neue, serif)',
              fontSize: 'clamp(2rem, 8vw, 3.5rem)',
              letterSpacing: '0.08em', color: 'var(--text-primary)',
              textShadow: '0 0 40px rgba(108,99,255,0.4)',
            }}>
              NOTICIAS<br />DE ÚLTIMO MOMENTO
            </h1>
          </div>

          {/* Barra de carga / progreso del jingle */}
          <div style={{ width: '70%', maxWidth: 300 }}>
            <div className="loading-bar">
              <div style={{
                height: '100%',
                background: 'linear-gradient(90deg, var(--accent), #e05252)',
                borderRadius: 2,
                animation: 'jingleProgress 3.2s linear both',
              }} />
            </div>
          </div>

          {/* Puntos de espera */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--accent)',
                animation: `blink 1s ${i * 0.25}s ease-in-out infinite`,
              }} />
            ))}
          </div>
        </div>
      </main>
    );
  }

  // ── FASES MAIN / COP / DONE — contenido de la noticia ─────
  return (
    <main className="page-shell">
      <div className="page-header">
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '3px 12px', borderRadius: 'var(--radius-full)',
          background: '#e05252', color: '#fff',
          fontSize: 'var(--text-xs)', fontWeight: 800, letterSpacing: '0.1em',
          animation: stage === 'main' ? 'blink 1.4s ease-in-out 3' : 'none',
        }}>
          ● EN VIVO
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginLeft: 'auto' }}>
          Ronda {lastReport?.round ?? state.round}
        </span>
      </div>

      <div className="page-content">

        {/* ── Evento principal ── */}
        {headlineReady && newsEvent && (
          <div className="card anim-reveal" style={{ borderColor: eventColor, padding: 'var(--sp-lg)', textAlign: 'center' }}>
            <div style={{
              fontSize: 60, lineHeight: 1, marginBottom: 'var(--sp-md)',
              animation: 'popIn 0.5s 0.1s cubic-bezier(0.34,1.56,0.64,1) both',
            }}>
              {eventIcon}
            </div>
            <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--sp-sm)' }}>
              {newsEvent.headline}
            </h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              {newsEvent.detail}
            </p>

            {/* Víctima */}
            {newsEvent.victimName && (
              <div className="anim-slide-up" style={{
                marginTop: 'var(--sp-md)', padding: 'var(--sp-sm) var(--sp-md)',
                borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)',
                border: `1px solid ${eventColor}`,
                display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)',
              }}>
                <div className="player-avatar" style={{ borderColor: eventColor, flexShrink: 0 }}>
                  {newsEvent.victimName[0]?.toUpperCase()}
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Identidad confirmada
                  </div>
                  <div style={{ fontWeight: 700, color: eventColor }}>
                    {newsEvent.victimName}
                    {newsEvent.victimRole && (
                      <span style={{ fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 8 }}>
                        ({ROLE_LABELS[newsEvent.victimRole]})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Sección policial ── */}
        {(stage === 'cop' || stage === 'done') && hasCop && (
          <div className="anim-slide-up">
            {!copRevealed ? (
              /* Suspense */
              <div className="card" style={{ textAlign: 'center', padding: 'var(--sp-xl)', borderColor: 'var(--role-cop)' }}>
                <div style={{ fontSize: 40, animation: 'float 1.5s ease-in-out infinite' }}>🔍</div>
                <h3 style={{ marginTop: 12, color: 'var(--role-cop)' }}>Informe de la investigación</h3>
                <p className="text-muted" style={{ fontSize: 'var(--text-sm)', marginTop: 8 }}>
                  Esta noche la policía investigó a alguien…
                </p>
                <div className="loading-bar" style={{ marginTop: 20 }}>
                  <div className="loading-bar-progress" />
                </div>
              </div>
            ) : (
              /* Resultado */
              <div className="card anim-reveal" style={{
                textAlign: 'center', padding: 'var(--sp-xl)',
                borderColor: newsEvent!.cop!.isKiller ? 'var(--danger)' : 'var(--success)',
                background: newsEvent!.cop!.isKiller
                  ? 'rgba(224,82,82,0.08)' : 'rgba(76,175,130,0.08)',
                animation: newsEvent!.cop!.isKiller ? 'shake 0.4s 0.1s both, revealCard 0.5s both' : 'revealCard 0.5s both',
              }}>
                <div style={{
                  fontSize: 56,
                  animation: 'popIn 0.5s 0.15s cubic-bezier(0.34,1.56,0.64,1) both',
                }}>
                  {newsEvent!.cop!.isKiller ? '🚨' : '✅'}
                </div>
                <h3 style={{
                  marginTop: 12,
                  color: newsEvent!.cop!.isKiller ? 'var(--danger)' : 'var(--success)',
                }}>
                  {newsEvent!.cop!.isKiller
                    ? '¡La policía tiene un asesino fichado!'
                    : 'La persona investigada es inocente.'}
                </h3>
                <p style={{ fontSize: 'var(--text-sm)', marginTop: 8 }}>
                  {newsEvent!.cop!.message}
                </p>
                <p className="text-muted" style={{ fontSize: 'var(--text-xs)', marginTop: 12 }}>
                  Usá esta información en el juicio.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Fin de partida */}
        {state.isOver && stage === 'done' && (
          <div className={`info-box anim-slide-up`} style={{
            textAlign: 'center',
            borderColor: state.winnerFaction === 'town' ? 'var(--success)' : 'var(--danger)',
            color:       state.winnerFaction === 'town' ? 'var(--success)' : 'var(--danger)',
          }}>
            {state.winnerFaction === 'town'
              ? '🏆 ¡El pueblo ganó! Todos los asesinos fueron eliminados.'
              : '💀 ¡Los asesinos ganaron! La ciudad cayó en sus manos.'}
          </div>
        )}

        {/* Lista de jugadores vivos */}
        {stage === 'done' && (
          <div className="anim-slide-up">
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 'var(--sp-sm)',
            }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
              <span style={{
                color: 'var(--text-muted)', fontSize: 'var(--text-xs)',
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                En pie — {alivePlayers.length}
              </span>
              <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
              {state.players.map((p, i) => (
                <div
                  key={p.id}
                  className={`player-card ${!p.isAlive ? 'eliminated' : ''}`}
                  style={{ animation: `slideUp 0.3s ${i * 0.04}s both` }}
                >
                  <div className="player-avatar" style={{ opacity: p.isAlive ? 1 : 0.3 }}>
                    {p.name[0]?.toUpperCase()}
                  </div>
                  <span className="player-name">{p.name}</span>
                  {!p.isAlive && (
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

      {/* Footer */}
      {stage === 'done' && (
        <div className="page-footer anim-slide-up">
          {state.isOver ? (
            <button className="btn btn-primary" onClick={goToResolution}>Ver resultado final →</button>
          ) : (
            <button className="btn btn-primary" onClick={goToTrial}>Ir al Juicio Público →</button>
          )}
        </div>
      )}
    </main>
  );
}
