'use client';

import Image from 'next/image';

type MobileAtmosphereArtVariant = 'room' | 'handoff';

export default function MobileAtmosphereArt({
  variant,
}: {
  variant: MobileAtmosphereArtVariant;
}) {
  if (variant === 'room') {
    return (
      <>
        <div
          aria-hidden
          className="mobile-atmosphere-art"
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 'calc(72px + env(safe-area-inset-bottom))',
            zIndex: 0,
            pointerEvents: 'none',
            display: 'flex',
            justifyContent: 'center',
            opacity: 0.2,
          }}
        >
          <div
            style={{
              position: 'relative',
              width: 'min(100vw, 480px)',
              height: '42dvh',
              minHeight: 280,
              filter: 'saturate(0.82) contrast(1.04)',
              maskImage: 'linear-gradient(to top, transparent 0%, black 22%, black 72%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to top, transparent 0%, black 22%, black 72%, transparent 100%)',
            }}
          >
            <Image
              src="/img/Fondo-juicio.png"
              alt=""
              fill
              sizes="100vw"
              style={{
                objectFit: 'cover',
                objectPosition: 'center bottom',
              }}
            />
          </div>
        </div>
        <style>{`
          @media (min-width: 768px) {
            .mobile-atmosphere-art {
              display: none !important;
            }
          }
        `}</style>
      </>
    );
  }

  return (
    <>
      <div
        aria-hidden
        className="mobile-atmosphere-art"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          opacity: 0.3,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(13,15,20,0.68) 0%, rgba(13,15,20,0.18) 36%, rgba(13,15,20,0.56) 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 50% 38%, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 48%), radial-gradient(circle at 50% 100%, rgba(224,82,82,0.14) 0%, rgba(224,82,82,0) 54%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: 'min(100vw, 480px)',
              height: '100dvh',
              filter: 'brightness(0.9) grayscale(0.02) saturate(0.96) contrast(1.08)',
              transform: 'scale(1.03)',
              maskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 86%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 86%, transparent 100%)',
            }}
          >
            <Image
              src="/img/Fondo-juicio.png"
              alt=""
              fill
              sizes="100vw"
              style={{
                objectFit: 'cover',
                objectPosition: 'center center',
              }}
            />
          </div>
        </div>
      </div>
      <style>{`
        @media (min-width: 768px) {
          .mobile-atmosphere-art {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
