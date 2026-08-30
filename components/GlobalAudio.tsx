'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { useMultiRoom } from '@/context/MultiRoomContext';
import { useAudioState } from '@/lib/audio/hooks';
import {
  installAudioUnlock,
  playSound,
  restoreMusic,
  setAmbience,
  setMasterVolume,
  setMusicVolume,
  setMuted,
  setSfxVolume,
  syncAudioFromStorage,
  toggleMute,
  unlockAudio,
} from '@/lib/sounds';
import type { AmbienceKey } from '@/lib/audio/types';
import type { MultiGamePhase } from '@/lib/multi/types';

function resolveDesiredAmbience(
  pathname: string | null,
  hasActivePhase: boolean,
  publicMultiAudioEnabled: boolean,
  multiPhase?: MultiGamePhase | null
): AmbienceKey | null | undefined {
  const currentPath = pathname ?? '';

  if (currentPath === '/') {
    return undefined;
  }

  if (currentPath.startsWith('/multi/game/')) {
    if (!publicMultiAudioEnabled || !hasActivePhase) {
      return null;
    }

    if (multiPhase === 'news') {
      return 'ambience.news';
    }

    if (multiPhase === 'trial' || multiPhase === 'vote' || multiPhase === 'resolution') {
      return null;
    }

    return 'ambience.match';
  }

  if (
    currentPath === '/setup' ||
    currentPath === '/room' ||
    currentPath.startsWith('/multi/create') ||
    currentPath.startsWith('/multi/host/') ||
    currentPath.startsWith('/join/')
  ) {
    return 'ambience.lobby';
  }

  if (currentPath === '/news') {
    return hasActivePhase ? 'ambience.news' : null;
  }

  if (currentPath === '/reveal' || currentPath === '/operative') {
    return hasActivePhase ? 'ambience.match' : null;
  }

  if (currentPath === '/trial' || currentPath === '/vote' || currentPath === '/resolution') {
    return null;
  }

  return null;
}

function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          onMouseUp={() => { void playSound('ui.select', { bypassCooldown: true, volume: 0.7 }); }}
          onTouchEnd={() => { void playSound('ui.select', { bypassCooldown: true, volume: 0.7 }); }}
          style={{ flex: 1, accentColor: 'var(--accent)' }}
        />
        <span style={{ minWidth: 40, textAlign: 'right', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(value * 100)}%
        </span>
      </div>
    </label>
  );
}

export default function GlobalAudio() {
  const pathname = usePathname();
  const { state: gameState } = useGame();
  const { room, isHost } = useMultiRoom();
  const audio = useAudioState();
  const [panelOpen, setPanelOpen] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const previousPathRef = useRef<string | null>(null);
  const currentPath = pathname ?? '';
  const isMultiGameRoute = currentPath.startsWith('/multi/game/');
  const publicMultiAudioEnabled = !isMultiGameRoute || isHost;
  const hasActivePhase = isMultiGameRoute
    ? Boolean(room?.game)
    : gameState.phase !== 'lobby' && gameState.players.length > 0;

  const desiredAmbience = useMemo(
    () => resolveDesiredAmbience(currentPath, hasActivePhase, publicMultiAudioEnabled, room?.game?.phase ?? null),
    [currentPath, hasActivePhase, publicMultiAudioEnabled, room?.game?.phase]
  );

  useEffect(() => {
    const teardownUnlock = installAudioUnlock();
    const handleStorage = () => syncAudioFromStorage();

    window.addEventListener('storage', handleStorage);
    return () => {
      teardownUnlock?.();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    const previousPath = previousPathRef.current;
    previousPathRef.current = currentPath;

    if (previousPath && previousPath !== currentPath) {
      void playSound('ui.screenChange');
    }
  }, [currentPath]);

  useEffect(() => {
    if (desiredAmbience === undefined) {
      return;
    }

    restoreMusic(600);

    if (!desiredAmbience) {
      setAmbience(null, { fadeOutMs: 700 });
      return;
    }

    void setAmbience(
      desiredAmbience,
      desiredAmbience === 'ambience.news' ? { fadeInMs: 180, fadeOutMs: 700 } : undefined
    );
  }, [desiredAmbience]);

  async function handleMuteToggle() {
    const muted = toggleMute();
    if (!muted) {
      await unlockAudio();
    }
    void playSound(muted ? 'ui.click' : 'ui.confirm', { bypassCooldown: true });
  }

  async function handleAudioTest() {
    if (audio.muted) setMuted(false);
    const unlocked = await unlockAudio();
    const played = unlocked
      ? await playSound('ui.confirm', { bypassCooldown: true, volume: 1.15 })
      : false;

    setTestStatus(played ? 'Sonido reproducido' : 'El navegador bloqueó el audio. Toca ACTIVAR e intenta de nuevo.');
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 'max(var(--sp-md), calc(env(safe-area-inset-top) + var(--sp-sm)))',
        right: 'max(var(--sp-md), calc(env(safe-area-inset-right) + var(--sp-md)))',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 'var(--sp-sm)',
      }}
    >
      {panelOpen && (
        <div
          className="card"
          style={{
            width: 'min(280px, calc(100vw - 32px))',
            padding: 'var(--sp-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--sp-md)',
            boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
            backdropFilter: 'blur(14px)',
            background: 'rgba(22, 25, 33, 0.94)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-sm)', alignItems: 'baseline' }}>
            <div>
              <div style={{ fontWeight: 700 }}>Audio</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {audio.muted ? 'Silenciado' : audio.unlocked ? 'Activo' : 'Esperando interacción'}
              </div>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              style={{ width: 'auto', padding: '6px 10px' }}
              onClick={() => {
                void playSound('ui.click', { bypassCooldown: true });
                setPanelOpen(false);
              }}
            >
              Cerrar
            </button>
          </div>

          <Slider label="General" value={audio.masterVolume} onChange={setMasterVolume} />
          <Slider label="Música" value={audio.musicVolume} onChange={setMusicVolume} />
          <Slider label="Efectos" value={audio.sfxVolume} onChange={setSfxVolume} />

          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { void handleAudioTest(); }}
          >
            Probar sonido
          </button>
          {testStatus && (
            <div role="status" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
              {testStatus}
            </div>
          )}

          <div className="info-box" style={{ fontSize: 'var(--text-xs)', padding: '12px var(--sp-md)' }}>
            El audio se desbloquea automáticamente al primer toque o tecla, y tus preferencias quedan guardadas.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--sp-sm)' }}>
        <button
          onClick={() => {
            void playSound('ui.click', { bypassCooldown: true });
            setPanelOpen((current) => !current);
          }}
          className="btn-glass"
          style={{
            minWidth: 58,
            height: 44,
            padding: '0 14px',
            borderRadius: 'var(--radius-full)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'var(--text-xs)',
            fontWeight: 800,
            letterSpacing: '0.08em',
          }}
          title="Mezcla de audio"
        >
          MIX
        </button>

        <button
          onClick={handleMuteToggle}
          className="btn-glass"
          style={{
            minWidth: 86,
            height: 44,
            padding: '0 14px',
            borderRadius: 'var(--radius-full)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'var(--text-xs)',
            fontWeight: 800,
            letterSpacing: '0.08em',
          }}
          title={audio.muted ? 'Activar audio' : 'Silenciar audio'}
        >
          {audio.muted ? 'ACTIVAR' : 'SILENCIO'}
        </button>
      </div>
    </div>
  );
}
