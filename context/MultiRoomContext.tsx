'use client';

// ============================================================
// context/MultiRoomContext.tsx
// Contexto para el modo multidispositivo.
//
// - Gestiona el deviceId del dispositivo actual
// - Hace polling cada 2s al estado de la sala en Redis
// - Pone a disposición: estado de sala, secreto del jugador,
//   funciones de acción, y el playerGameView calculado
// ============================================================

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { getOrCreateDeviceId } from '@/lib/multi/device';
import { getRoomState, getPlayerSecret } from '@/lib/multi/api';
import type {
  MultiRoomState,
  PlayerSecret,
  DeviceId,
} from '@/lib/multi/types';

// --- Valor del contexto ---

interface MultiRoomContextValue {
  // Identidad del dispositivo actual
  deviceId: DeviceId;
  
  // Estado de la sala (actualizado por polling)
  room: MultiRoomState | null;
  // Secreto del jugador actual (solo disponible cuando la partida inicia)
  secret: PlayerSecret | null;
  
  // Estados de carga/error
  loading: boolean;
  error: string | null;
  
  // Inicializar el polling para una sala específica
  joinRoom: (roomId: string) => void;
  // Detener el polling
  leaveRoom: () => void;
  
  // Forzar un refresco inmediato del estado
  refresh: () => Promise<void>;
  
  // Valores calculados
  isHost: boolean;
  myPlayer: MultiRoomState['players'][number] | null;
  hasActed: boolean;
  hasVoted: boolean;
}

const MultiRoomContext = createContext<MultiRoomContextValue | null>(null);

const DEFAULT_POLL_INTERVAL_MS = 2000;
const OPERATIVE_POLL_INTERVAL_MS = 900;

// --- Provider ---

export function MultiRoomProvider({ children }: { children: ReactNode }) {
  const [deviceId, setDeviceId] = useState<DeviceId>('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [room, setRoom] = useState<MultiRoomState | null>(null);
  const [secret, setSecret] = useState<PlayerSecret | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef(false);

  // Inicializar deviceId solo en el cliente
  useEffect(() => {
    setDeviceId(getOrCreateDeviceId());
  }, []);

  // Función de fetch del estado actual
  const fetchRoomState = useCallback(async () => {
    if (!roomId || !deviceId || isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const result = await getRoomState(roomId, deviceId);
      if (result.ok) {
        setRoom(result.data);
        setError(null);

        // Si la partida inició y no tenemos secreto, pedirlo
        if (result.data.status === 'playing' && !secret) {
          const secretResult = await getPlayerSecret(roomId, deviceId);
          if (secretResult.ok && secretResult.data) {
            setSecret(secretResult.data);
          }
        }
      } else {
        setError(result.error);
      }
    } catch (e) {
      setError('Error de conexión');
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, [roomId, deviceId, secret]);

  const pollIntervalMs = room?.game?.phase === 'operative'
    ? OPERATIVE_POLL_INTERVAL_MS
    : DEFAULT_POLL_INTERVAL_MS;

  // Iniciar polling cuando hay roomId
  useEffect(() => {
    if (!roomId) return;

    setLoading(true);
    fetchRoomState();

    pollTimerRef.current = setInterval(fetchRoomState, pollIntervalMs);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [roomId, fetchRoomState, pollIntervalMs]);

  function joinRoom(id: string) {
    setRoomId(id);
    setSecret(null); // Limpiar secreto de sala anterior
    setRoom(null);
    setError(null);
  }

  function leaveRoom() {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    setRoomId(null);
    setRoom(null);
    setSecret(null);
  }

  const refresh = useCallback(async () => {
    await fetchRoomState();
  }, [fetchRoomState]);

  // Valores calculados
  const myPlayer = room?.players.find((p) => p.deviceId === deviceId) ?? null;
  const isHost = room?.hostId === deviceId;
  
  const hasActed = room?.game
    ? room.game.pendingActions[deviceId] != null
    : false;

  const hasVoted = room?.game
    ? room.game.votes[deviceId] !== undefined
    : false;

  return (
    <MultiRoomContext.Provider
      value={{
        deviceId,
        room,
        secret,
        loading,
        error,
        joinRoom,
        leaveRoom,
        refresh,
        isHost,
        myPlayer,
        hasActed,
        hasVoted,
      }}
    >
      {children}
    </MultiRoomContext.Provider>
  );
}

// --- Hook de consumo ---

export function useMultiRoom(): MultiRoomContextValue {
  const ctx = useContext(MultiRoomContext);
  if (!ctx) throw new Error('useMultiRoom debe usarse dentro de <MultiRoomProvider>');
  return ctx;
}
