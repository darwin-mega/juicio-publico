'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
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

const AUDIO_DOCK_STORAGE_KEY = 'jp_audio_dock_position_v1';
const AUDIO_DOCK_EDGE = 8;
const AUDIO_DOCK_WIDTH = 52;
const AUDIO_DOCK_HEIGHT = 52;

interface AudioDockPosition {
  right: number;
  top: number;
}

interface AudioDockDrag {
  moved: boolean;
  pointerId: number;
  startRight: number;
  startTop: number;
  startX: number;
  startY: number;
}

function constrainDockPosition(position: AudioDockPosition) {
  if (typeof window === 'undefined') return position;
  return {
    right: Math.min(
      Math.max(AUDIO_DOCK_EDGE, window.innerWidth - AUDIO_DOCK_WIDTH - AUDIO_DOCK_EDGE),
      Math.max(AUDIO_DOCK_EDGE, position.right),
    ),
    top: Math.min(
      Math.max(AUDIO_DOCK_EDGE, window.innerHeight - AUDIO_DOCK_HEIGHT - AUDIO_DOCK_EDGE),
      Math.max(AUDIO_DOCK_EDGE, position.top),
    ),
  };
}

function getDefaultDockPosition() {
  if (typeof window === 'undefined') return { right: 12, top: 96 };
  return constrainDockPosition({
    right: 12,
    top: Math.round((window.innerHeight - AUDIO_DOCK_HEIGHT) / 2),
  });
}

function readStoredDockPosition() {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(AUDIO_DOCK_STORAGE_KEY) ?? 'null') as Partial<AudioDockPosition> | null;
    if (typeof parsed?.right !== 'number' || typeof parsed.top !== 'number') return null;
    return constrainDockPosition({ right: parsed.right, top: parsed.top });
  } catch {
    return null;
  }
}

function persistDockPosition(position: AudioDockPosition) {
  try {
    window.localStorage.setItem(AUDIO_DOCK_STORAGE_KEY, JSON.stringify(position));
  } catch {
    // La posicion sigue funcionando aunque el navegador bloquee localStorage.
  }
}

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
  const [dockPosition, setDockPosition] = useState<AudioDockPosition>({ right: 12, top: 96 });
  const [panelOpen, setPanelOpen] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [viewport, setViewport] = useState({ height: 0, width: 0 });
  const dockPositionRef = useRef(dockPosition);
  const dragRef = useRef<AudioDockDrag | null>(null);
  const previousPathRef = useRef<string | null>(null);
  const suppressLauncherClickRef = useRef(false);
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
    const applyViewport = () => {
      const nextPosition = constrainDockPosition(dockPositionRef.current);
      dockPositionRef.current = nextPosition;
      setDockPosition(nextPosition);
      setViewport({ height: window.innerHeight, width: window.innerWidth });
    };

    const initialPosition = readStoredDockPosition() ?? getDefaultDockPosition();
    dockPositionRef.current = initialPosition;
    const frame = window.requestAnimationFrame(() => {
      setDockPosition(initialPosition);
      setViewport({ height: window.innerHeight, width: window.innerWidth });
    });

    window.addEventListener('resize', applyViewport);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', applyViewport);
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

  function handleDockPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      moved: false,
      pointerId: event.pointerId,
      startRight: dockPositionRef.current.right,
      startTop: dockPositionRef.current.top,
      startX: event.clientX,
      startY: event.clientY,
    };
  }

  function handleDockPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(deltaX, deltaY) < 5) return;

    drag.moved = true;
    event.preventDefault();
    const nextPosition = constrainDockPosition({
      right: drag.startRight - deltaX,
      top: drag.startTop + deltaY,
    });
    dockPositionRef.current = nextPosition;
    setDockPosition(nextPosition);
  }

  function finishDockDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    suppressLauncherClickRef.current = drag.moved;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (drag.moved) persistDockPosition(dockPositionRef.current);
  }

  function handleLauncherClick() {
    if (suppressLauncherClickRef.current) {
      suppressLauncherClickRef.current = false;
      return;
    }
    void playSound('ui.click', { bypassCooldown: true });
    setPanelOpen((current) => !current);
  }

  function resetDockPosition() {
    const nextPosition = getDefaultDockPosition();
    dockPositionRef.current = nextPosition;
    setDockPosition(nextPosition);
    persistDockPosition(nextPosition);
  }

  const panelAbove = viewport.height > 0 && dockPosition.top > viewport.height / 2;
  const panelOpensRight = viewport.width > 0 && dockPosition.right > viewport.width / 2;
  const availablePanelHeight = viewport.height > 0
    ? panelAbove
      ? dockPosition.top - 16
      : viewport.height - dockPosition.top - AUDIO_DOCK_HEIGHT - 16
    : 360;
  const panelMaxHeight = Math.max(180, Math.min(420, availablePanelHeight));

  return (
    <div
      style={{
        position: 'fixed',
        top: dockPosition.top,
        right: dockPosition.right,
        zIndex: 10000,
        width: AUDIO_DOCK_WIDTH,
        height: AUDIO_DOCK_HEIGHT,
      }}
    >
      {panelOpen && (
        <div
          id="audio-mixer-panel"
          className="card"
          style={{
            position: 'absolute',
            ...(panelAbove
              ? { bottom: 'calc(100% + var(--sp-sm))' }
              : { top: 'calc(100% + var(--sp-sm))' }),
            ...(panelOpensRight ? { left: 0 } : { right: 0 }),
            width: 'min(280px, calc(100vw - 32px))',
            maxHeight: panelMaxHeight,
            overflowY: 'auto',
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
            className={`btn ${audio.muted ? 'btn-primary' : 'btn-ghost'} btn-sm`}
            onClick={() => { void handleMuteToggle(); }}
          >
            {audio.muted ? 'Activar audio' : 'Silenciar audio'}
          </button>
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
            Arrastrá el botón de audio para moverlo. La posición y tus preferencias quedan guardadas.
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={resetDockPosition}
          >
            Restablecer posición
          </button>
        </div>
      )}

      <button
        type="button"
        className="btn-glass"
        aria-controls="audio-mixer-panel"
        aria-expanded={panelOpen}
        aria-label="Audio: tocar para abrir, arrastrar para mover"
        onClick={handleLauncherClick}
        onPointerCancel={finishDockDrag}
        onPointerDown={handleDockPointerDown}
        onPointerMove={handleDockPointerMove}
        onPointerUp={finishDockDrag}
        style={{
          width: AUDIO_DOCK_WIDTH,
          height: AUDIO_DOCK_HEIGHT,
          padding: 0,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'grab',
          touchAction: 'none',
          userSelect: 'none',
        }}
        title="Tocá para abrir. Arrastrá para mover."
      >
        <svg
          aria-hidden="true"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 5 6.5 8.5H3v7h3.5L11 19V5Z" />
          {audio.muted ? (
            <>
              <path d="m16 9 5 5" />
              <path d="m21 9-5 5" />
            </>
          ) : (
            <>
              <path d="M15 9.5a4 4 0 0 1 0 5" />
              <path d="M18 7a7 7 0 0 1 0 10" />
            </>
          )}
        </svg>
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 7,
            right: 7,
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: audio.muted ? 'var(--danger)' : 'var(--success)',
            boxShadow: audio.muted ? 'none' : '0 0 10px var(--success)',
          }}
        />
      </button>
    </div>
  );
}
