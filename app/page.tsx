'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient, hasSupabaseConfig } from '@/lib/supabase/client';

const HIGHLIGHTS = [
  {
    title: 'Roles secretos',
    description: 'Asesinos, doctor, policia y pueblo reciben objetivos distintos sin que nadie tenga que dirigir.',
  },
  {
    title: 'Multidispositivo',
    description: 'Cada persona puede entrar desde su celular, confirmar acciones y votar sin romper el anonimato.',
  },
  {
    title: 'Debate real',
    description: 'La app ordena las fases; el grupo acusa, miente, se defiende y decide a quien expulsar.',
  },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Crea una sala',
    description: 'Elegis modo mesa o multidispositivo y sumas al grupo en pocos toques.',
  },
  {
    step: '02',
    title: 'Invita a tus amigos',
    description: 'Cada jugador participa desde su dispositivo o pasando el telefono en modo mesa.',
  },
  {
    step: '03',
    title: 'Acusen y voten',
    description: 'La noche genera pistas, el juicio abre el debate y la votacion decide el destino.',
  },
];

function getDisplayName(user: User | null) {
  return user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Jugador';
}

export default function LandingPage() {
  const router = useRouter();
  const supabaseConfigured = hasSupabaseConfig();
  const supabase = useMemo(() => (supabaseConfigured ? createClient() : null), [supabaseConfigured]);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    async function loadSession() {
      if (!supabase) return;
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    }

    void loadSession();
  }, [supabase]);

  return (
    <main style={{ minHeight: '100dvh', background: '#05060a', color: '#f5f7fb', overflowX: 'hidden' }}>
      <section style={{ position: 'relative', minHeight: '94dvh', display: 'flex', alignItems: 'stretch', overflow: 'hidden' }}>
        <Image src="/img/Fondo-juicio.png" alt="" fill priority sizes="100vw" style={{ objectFit: 'cover', opacity: 0.66 }} />
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(5,6,10,0.98) 0%, rgba(5,6,10,0.82) 48%, rgba(5,6,10,0.56) 100%)' }} />
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(5,6,10,0.08) 0%, rgba(5,6,10,0.18) 58%, #05060a 100%)' }} />

        <header style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'max(18px, env(safe-area-inset-top)) clamp(18px, 5vw, 56px) 18px',
        }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: '#fff', textDecoration: 'none', fontWeight: 900, letterSpacing: '0.02em' }}>
            <Image src="/img/Juicio-logo.png" alt="" width={38} height={38} style={{ borderRadius: 8 }} />
            <span>Juicio Publico</span>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {user ? (
              <>
                <button onClick={() => router.push('/cliente')} className="landing-pill">
                  {user.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="" referrerPolicy="no-referrer" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : null}
                  {getDisplayName(user)}
                </button>
                <button onClick={() => router.push('/jugar')} className="landing-login-primary">
                  Jugar
                </button>
              </>
            ) : (
              <button onClick={() => router.push('/login')} className="landing-pill">
                Login
              </button>
            )}
          </div>
        </header>

        <div className="landing-hero-grid">
          <div className="landing-copy">
            <div className="landing-kicker">Juego social presencial y multidispositivo</div>
            <h1 className="landing-title">Converti la juntada en un juicio de mentiras.</h1>
            <p className="landing-description">
              Juicio Publico guia roles secretos, operativo nocturno, noticias, debate y votacion para que tu grupo pueda jugar sin moderador.
            </p>

            <div className="landing-actions">
              <button onClick={() => router.push(user ? '/jugar' : '/login')} className="landing-cta">
                {user ? 'Entrar al juego' : 'Empezar a jugar'}
              </button>
              <button onClick={() => router.push('/registro')} className="landing-secondary">
                Crear cuenta gratis
              </button>
            </div>

            <div className="landing-flow" aria-label="Resumen de como se juega">
              <span>Crear sala</span>
              <span>Invitar amigos</span>
              <span>Acusar y votar</span>
            </div>

            <div className="landing-proof">
              <div><strong>4 roles</strong><span>secretos</span></div>
              <div><strong>2 modos</strong><span>mesa o celus</span></div>
              <div><strong>0 moderador</strong><span>todos juegan</span></div>
            </div>
          </div>

          <div className="phone-stage" aria-label="Trailer vertical de Juicio Publico">
            <div className="phone-frame">
              <div className="phone-notch" />
              <video
                className="phone-video"
                src="/Video/trailer-el-juicio.mp4"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                poster="/img/Fondo-juicio.png"
              />
              <div className="phone-caption">
                <span>Trailer</span>
                <strong>Roles ocultos, debate publico y votacion desde el celular.</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-band">
        <div className="section-copy">
          <div className="landing-kicker">Por que funciona</div>
          <h2>La app pone orden. La mesa pone el caos.</h2>
          <p>El ritmo esta pensado para grupos presenciales: rapido de arrancar, claro en cada fase y con suficientes giros para que todos tengan algo que defender.</p>
        </div>
        <div className="landing-highlights">
          {HIGHLIGHTS.map((item, index) => (
            <article key={item.title}>
              <div>0{index + 1}</div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="how-section">
        <div className="section-copy">
          <div className="landing-kicker">Como se juega</div>
          <h2>Tres pasos, una mesa llena de sospechas.</h2>
        </div>
        <div className="how-grid">
          {HOW_IT_WORKS.map((item) => (
            <article key={item.step}>
              <span>{item.step}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="final-cta">
        <div>
          <h2>Tu grupo ya tiene historias. Dale un crimen que resolver.</h2>
          <p>Crea sala, comparte el acceso y deja que la app lleve el ritmo del juicio.</p>
        </div>
        <button onClick={() => router.push(user ? '/jugar' : '/login')} className="landing-cta">
          Empezar partida
        </button>
      </section>

      <style>{`
        .landing-pill,
        .landing-login-primary {
          min-height: 42px;
          display: inline-flex;
          align-items: center;
          gap: 9px;
          padding: 0 16px;
          border-radius: 999px;
          font-weight: 850;
          cursor: pointer;
          transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease;
        }

        .landing-pill {
          border: 1px solid rgba(255,255,255,0.22);
          background: rgba(10,12,18,0.72);
          color: #fff;
          backdrop-filter: blur(14px);
        }

        .landing-pill:hover,
        .landing-login-primary:hover,
        .landing-cta:hover,
        .landing-secondary:hover {
          transform: translateY(-1px);
        }

        .landing-login-primary,
        .landing-cta {
          border: none;
          background: #f5f7fb;
          color: #080a10;
          font-weight: 950;
        }

        .landing-hero-grid {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 1180px;
          margin: 0 auto;
          padding: 118px clamp(18px, 5vw, 56px) 54px;
          display: grid;
          grid-template-columns: minmax(0, 1.04fr) minmax(292px, 0.62fr);
          gap: clamp(28px, 5vw, 68px);
          align-items: center;
        }

        .landing-copy {
          max-width: 700px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .landing-kicker {
          color: #c4cbe0;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .landing-title {
          font-size: clamp(2.85rem, 7.4vw, 6.15rem);
          line-height: 0.94;
          margin: 0;
          font-weight: 950;
          max-width: 780px;
          text-wrap: balance;
        }

        .landing-description {
          color: #d5daea;
          font-size: clamp(1rem, 2vw, 1.22rem);
          line-height: 1.58;
          max-width: 660px;
          text-wrap: pretty;
        }

        .landing-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 8px;
        }

        .landing-cta,
        .landing-secondary {
          min-height: 54px;
          padding: 0 24px;
          border-radius: 9px;
          cursor: pointer;
          font-size: 16px;
          line-height: 1.1;
          transition: transform 0.15s ease, filter 0.15s ease, background 0.15s ease;
        }

        .landing-secondary {
          border: 1px solid rgba(255,255,255,0.22);
          background: rgba(255,255,255,0.07);
          color: #fff;
          font-weight: 850;
        }

        .landing-flow {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 2px;
        }

        .landing-flow span {
          min-height: 34px;
          display: inline-flex;
          align-items: center;
          padding: 0 12px;
          border-radius: 999px;
          background: rgba(108,99,255,0.16);
          border: 1px solid rgba(139,132,255,0.28);
          color: #eef0ff;
          font-size: 13px;
          font-weight: 850;
        }

        .landing-flow span::before {
          content: "";
          width: 6px;
          height: 6px;
          margin-right: 8px;
          border-radius: 50%;
          background: #8b84ff;
          box-shadow: 0 0 12px rgba(139,132,255,0.8);
        }

        .landing-proof {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          max-width: 620px;
          margin-top: 10px;
        }

        .landing-proof div {
          padding: 15px 14px;
          border-radius: 9px;
          background: rgba(255,255,255,0.075);
          border: 1px solid rgba(255,255,255,0.14);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
        }

        .landing-proof strong,
        .landing-proof span {
          display: block;
        }

        .landing-proof strong {
          font-size: 18px;
          color: #ffffff;
        }

        .landing-proof span {
          color: #c2cada;
          font-size: 12px;
          margin-top: 2px;
        }

        .phone-stage {
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .phone-frame {
          position: relative;
          width: min(340px, 82vw);
          aspect-ratio: 9 / 16;
          border-radius: 32px;
          padding: 11px;
          background: linear-gradient(145deg, rgba(255,255,255,0.28), rgba(255,255,255,0.06));
          border: 1px solid rgba(255,255,255,0.22);
          box-shadow: 0 34px 90px rgba(0,0,0,0.52);
        }

        .phone-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 25px;
          background: #000;
          display: block;
        }

        .phone-notch {
          position: absolute;
          top: 22px;
          left: 50%;
          transform: translateX(-50%);
          width: 86px;
          height: 22px;
          border-radius: 999px;
          background: rgba(0,0,0,0.76);
          z-index: 2;
        }

        .phone-caption {
          position: absolute;
          left: 24px;
          right: 24px;
          bottom: 24px;
          padding: 13px 14px;
          border-radius: 12px;
          background: rgba(5,6,10,0.8);
          border: 1px solid rgba(255,255,255,0.2);
          backdrop-filter: blur(12px);
        }

        .phone-caption span {
          color: #c7cee5;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .phone-caption strong {
          display: block;
          margin-top: 4px;
          line-height: 1.25;
          font-size: 14px;
        }

        .marketing-band,
        .how-section,
        .final-cta {
          max-width: 1180px;
          margin: 0 auto;
          padding: 62px clamp(18px, 5vw, 56px);
        }

        .section-copy {
          max-width: 760px;
          margin-bottom: 24px;
        }

        .section-copy h2,
        .final-cta h2 {
          margin: 8px 0 10px;
          font-size: clamp(2rem, 4.2vw, 3.7rem);
          line-height: 1;
          text-wrap: balance;
        }

        .section-copy p,
        .final-cta p {
          color: #c0c8d9;
          font-size: 1.05rem;
          line-height: 1.6;
        }

        .landing-highlights,
        .how-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .landing-highlights article,
        .how-grid article {
          min-height: 186px;
          padding: 24px;
          border-radius: 10px;
          background: #10131b;
          border: 1px solid rgba(255,255,255,0.1);
        }

        .landing-highlights article:nth-child(2),
        .how-grid article:nth-child(2) {
          background: #171a25;
        }

        .landing-highlights article div,
        .how-grid article span {
          color: #6c63ff;
          font-weight: 950;
          margin-bottom: 18px;
          display: block;
        }

        .landing-highlights h3,
        .how-grid h3 {
          margin: 0 0 10px;
          font-size: 22px;
        }

        .landing-highlights p,
        .how-grid p {
          color: #c0c8d9;
          line-height: 1.58;
        }

        .final-cta {
          margin-bottom: 36px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 22px;
          border-radius: 16px;
          background: linear-gradient(135deg, #161a28, #080a10);
          border: 1px solid rgba(255,255,255,0.1);
        }

        @media (max-width: 860px) {
          .landing-hero-grid,
          .landing-highlights,
          .how-grid {
            grid-template-columns: 1fr !important;
          }

          .landing-hero-grid {
            padding-top: 92px !important;
            padding-bottom: 36px !important;
            gap: 28px;
            align-items: start;
          }

          .landing-copy {
            gap: 16px;
          }

          .landing-description {
            font-size: 1rem;
            line-height: 1.55;
          }

          .landing-actions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .landing-cta,
          .landing-secondary {
            width: 100%;
          }

          .phone-stage {
            justify-content: center;
          }

          .phone-frame {
            width: min(300px, 74vw);
          }

          .landing-proof {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 8px;
          }

          .landing-proof div {
            padding: 12px 9px;
          }

          .landing-proof strong {
            font-size: 15px;
          }

          .landing-proof span {
            font-size: 11px;
          }

          .final-cta {
            flex-direction: column;
            align-items: flex-start;
          }

          header span {
            display: none;
          }
        }

        @media (max-width: 430px) {
          .landing-title {
            font-size: clamp(2.5rem, 14vw, 3.6rem);
          }

          .landing-kicker {
            font-size: 11px;
            letter-spacing: 0.13em;
          }

          .landing-flow span {
            min-height: 32px;
            font-size: 12px;
            padding: 0 10px;
          }

          .phone-frame {
            width: min(286px, 78vw);
          }

          .marketing-band,
          .how-section,
          .final-cta {
            padding-top: 46px;
            padding-bottom: 46px;
          }
        }
      `}</style>
    </main>
  );
}

