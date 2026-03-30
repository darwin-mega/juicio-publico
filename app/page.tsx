'use client';

import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import Image from 'next/image';

export default function HomePage() {
  const router = useRouter();
  const { dispatch, clearSave, hasSave, state } = useGame();

  function handleNewGame() {
    dispatch({ type: 'RESET' });
    router.push('/setup');
  }

  function handleResumeGame() {
    // Continuar desde donde quedó, según la fase actual
    const phase = state.phase;
    const phaseRoutes: Record<string, string> = {
      operative: '/operative',
      news: '/news',
      trial: '/trial',
      vote: '/vote',
      resolution: '/resolution',
      lobby: '/room',
    };
    router.push(phaseRoutes[phase] ?? '/operative');
  }

  function handleClearSave() {
    if (confirm('¿Seguro? Se borrará la partida guardada y no podrás recuperarla.')) {
      clearSave();
    }
  }

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        maxWidth: 480,
        margin: '0 auto',
        padding: '0 var(--sp-md)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ── Fondo atmosférico ── */}
      <div aria-hidden style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        background:
          'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(108,99,255,0.18) 0%, transparent 70%),' +
          'radial-gradient(ellipse 60% 40% at 80% 100%, rgba(224,82,82,0.12) 0%, transparent 60%)',
      }} />

      {/* Línea horizontal superior decorativa */}
      <div aria-hidden style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
        zIndex: 1,
      }} />

      {/* ── Contenido central ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--sp-xl)',
        zIndex: 2,
        paddingTop: 'var(--sp-2xl)',
      }}>

        {/* Logo */}
        <div style={{ position: 'relative' }}>
          <div aria-hidden style={{
            position: 'absolute',
            inset: -20,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(108,99,255,0.22) 0%, transparent 70%)',
            filter: 'blur(12px)',
            animation: 'pulseGlow 3s ease-in-out infinite',
          }} />
          <Image
            src="/img/Juicio-logo.png"
            alt="Juicio Público"
            width={220}
            height={220}
            priority
            style={{
              borderRadius: 'var(--radius-lg)',
              position: 'relative',
              zIndex: 1,
              filter: 'drop-shadow(0 0 28px rgba(108,99,255,0.4))',
            }}
          />
        </div>

        {/* Tagline */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            justifyContent: 'center',
          }}>
            <div style={{ height: 1, width: 40, background: 'linear-gradient(90deg, transparent, var(--border))' }} />
            <span style={{
              fontSize: 'var(--text-xs)',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              fontWeight: 600,
            }}>
              El juego de la ciudad
            </span>
            <div style={{ height: 1, width: 40, background: 'linear-gradient(90deg, var(--border), transparent)' }} />
          </div>

          <p style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-muted)',
            lineHeight: 1.6,
          }}>
            Deducción · Engaño · Estrategia presencial
          </p>

          {/* Roles visuales */}
          <div style={{
            display: 'flex',
            gap: 'var(--sp-sm)',
            justifyContent: 'center',
            marginTop: 'var(--sp-xs)',
            flexWrap: 'wrap',
          }}>
            {[
              { label: 'Asesino',  color: 'var(--role-killer)', icon: '🔪' },
              { label: 'Doctor',   color: 'var(--role-doctor)', icon: '🩺' },
              { label: 'Policía',  color: 'var(--role-cop)',    icon: '🔍' },
              { label: 'Pueblo',   color: 'var(--role-town)',   icon: '🏘️' },
            ].map(({ label, color, icon }) => (
              <div key={label} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 10px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--bg-elevated)',
                border: `1px solid ${color}22`,
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                color,
              }}>
                <span>{icon}</span> {label}
              </div>
            ))}
          </div>
        </div>

        {/* Banner de partida guardada */}
        {hasSave && state.players.length > 0 && (
          <div
            style={{
              width: '100%',
              padding: 'var(--sp-md)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-dim)',
              border: '1px solid rgba(108,99,255,0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--sp-sm)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 'var(--text-sm)' }}>
                🔄 Partida en curso
              </span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Ronda {state.round} · {state.players.filter(p => p.isAlive).length} vivos
              </span>
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>
              {state.players.filter(p => p.isAlive).slice(0, 4).map(p => p.name).join(', ')}
              {state.players.filter(p => p.isAlive).length > 4 && ` y ${state.players.filter(p => p.isAlive).length - 4} más`}
            </p>
          </div>
        )}
      </div>

      {/* ── Footer con botones ── */}
      <div style={{
        width: '100%',
        zIndex: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-sm)',
        padding: 'var(--sp-lg) 0 calc(var(--sp-xl) + env(safe-area-inset-bottom))',
      }}>
        {hasSave && state.players.length > 0 && (
          <button
            id="btn-continuar-partida"
            className="btn btn-primary"
            onClick={handleResumeGame}
            style={{ fontSize: 'var(--text-md)', padding: '16px' }}
          >
            ▶ Continuar Partida
          </button>
        )}

        <button
          id="btn-nueva-partida"
          className={`btn ${hasSave && state.players.length > 0 ? 'btn-ghost' : 'btn-primary'}`}
          onClick={handleNewGame}
          style={{ fontSize: 'var(--text-md)', padding: '16px' }}
        >
          ⚖️&nbsp;Nueva Partida — Modo Mesa
        </button>

        <button
          id="btn-modo-multi"
          className="btn btn-ghost"
          onClick={() => router.push('/multi/create')}
          style={{
            fontSize: 'var(--text-md)', padding: '16px',
            borderColor: 'rgba(108,99,255,0.4)',
            color: 'var(--accent)',
          }}
        >
          🌐&nbsp;Modo Multidispositivo
        </button>

        {hasSave && (
          <button
            id="btn-limpiar-partida"
            className="btn btn-ghost"
            onClick={handleClearSave}
            style={{ fontSize: 'var(--text-sm)', color: 'var(--danger)', borderColor: 'rgba(224,82,82,0.3)' }}
          >
            🗑️ Borrar partida guardada
          </button>
        )}

        <p style={{
          textAlign: 'center',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
          marginTop: 'var(--sp-xs)',
        }}>
          La app guía la partida · Sin necesidad de moderador
        </p>
      </div>

      {/* Animación CSS inline */}
      <style>{`
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.08); }
        }
      `}</style>
    </main>
  );
}
