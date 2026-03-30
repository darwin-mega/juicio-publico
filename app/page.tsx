// app/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { startBackgroundMusic } from '@/lib/sounds';

export default function HomePage() {
  const router = useRouter();
  const { dispatch, clearSave, hasSave, state } = useGame();
  
  // Estado para controlar el video de apertura
  const [showIntro, setShowIntro] = useState(true);
  const [preInteraction, setPreInteraction] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Intentar detectar si ya se vio el intro en esta sesión
  useEffect(() => {
    const hasSeenIntro = sessionStorage.getItem('jp_intro_seen');
    if (hasSeenIntro) {
      setShowIntro(false);
      setPreInteraction(false);
      startBackgroundMusic(); // Iniciar música si ya se interactuó previamente
    }
  }, []);

  function handleSkipIntro() {
    setShowIntro(false);
    setPreInteraction(false);
    sessionStorage.setItem('jp_intro_seen', 'true');
    startBackgroundMusic();
  }

  function handleStartIntro() {
    setPreInteraction(false);
    // Intentar reproducir con sonido tras la interacción
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.play().catch(() => {
        // Fallback si falla
        console.warn("Autoplay con sonido bloqueado incluso tras clic");
      });
    }

    // La música de fondo empezará después del trailer (o junto a él si se prefiere)
    // Pero como el trailer ya tiene sonido, podríamos esperar o ponerla muy baja.
    // Aquí la iniciamos para asegurar el contexto de audio.
    startBackgroundMusic();
  }

  function handleNewGame() {
    dispatch({ type: 'RESET' });
    router.push('/setup');
  }

  function handleResumeGame() {
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

  // Si estamos mostrando el intro, renderizamos el video overlay
  if (showIntro) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
      }}>
        {/* Pantalla Pre-Interacción (necesaria para el sonido) */}
        {preInteraction ? (
          <div 
            onClick={handleStartIntro}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 20,
              background: 'radial-gradient(circle at center, #1a1a2e 0%, #000 100%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              gap: 'var(--sp-xl)'
            }}
          >
            <div style={{ animation: 'pulseGlow 2s infinite' }}>
              <Image src="/img/Juicio-logo.png" alt="Juicio Público" width={180} height={180} />
            </div>
            <button className="btn btn-primary" style={{ padding: '16px 40px', fontSize: 'var(--text-lg)' }}>
              ▶ COMENZAR EXPERIENCIA
            </button>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 'var(--text-xs)', letterSpacing: '0.1em' }}>
              CLICK PARA ACTIVAR SONIDO
            </p>
          </div>
        ) : null}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          preload="auto"
          onEnded={handleSkipIntro}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        >
          <source src="/Video/trailer-el-juicio.mp4" type="video/mp4" />
          Tu navegador no soporta video.
        </video>

        {/* Botón Saltar */}
        <button
          onClick={handleSkipIntro}
          style={{
            position: 'absolute',
            bottom: 'var(--sp-2xl)',
            right: 'var(--sp-xl)',
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.3)',
            padding: '10px 24px',
            borderRadius: 'var(--radius-full)',
            fontSize: 'var(--text-sm)',
            fontWeight: 800,
            letterSpacing: '0.1em',
            zIndex: 10,
            backdropFilter: 'blur(8.2px)',
            cursor: 'pointer'
          }}
        >
          SALTAR INTRO ➔
        </button>
      </div>
    );
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
        <div style={{ position: 'relative', animation: 'fadeInDown 0.8s ease-out' }}>
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
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)', animation: 'fadeIn 1s 0.3s both' }}>
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
              animation: 'slideUp 0.6s 0.5s both'
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
        animation: 'slideUp 0.6s 0.6s both'
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
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </main>
  );
}

