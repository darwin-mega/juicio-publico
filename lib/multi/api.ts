// ============================================================
// lib/multi/api.ts
// Wrappers de cliente HTTP para las API routes del modo multi.
//
// Todos los métodos retornan ApiResponse<T> con { ok, data/error }.
// El deviceId se pasa siempre en el header X-Device-Id.
// ============================================================

import type {
  MultiRoomState,
  PlayerSecret,
  MultiRoomConfig,
  ApiResponse,
  PlayerOperativeAction,
} from './types';
import {
  clearPlayerCredential,
  getPlayerCredential,
  savePlayerCredential,
} from './device';

// Helper interno para hacer fetch con el header de deviceId
async function apiFetch<T>(
  url: string,
  options: RequestInit & { deviceId?: string; roomId?: string } = {}
): Promise<ApiResponse<T>> {
  const { deviceId, roomId, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> ?? {}),
  };

  if (deviceId) {
    headers['X-Device-Id'] = deviceId;
  }

  if (roomId) {
    const credential = getPlayerCredential(roomId);
    if (credential) headers['X-Player-Credential'] = credential;
  }

  try {
    const res = await fetch(url, { ...fetchOptions, headers });
    const json = await res.json();
    if (!res.ok) {
      return { ok: false, error: json.error ?? `HTTP ${res.status}` };
    }
    return { ok: true, data: json };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error de red' };
  }
}

// --- Crear sala ---

export interface CreateRoomPayload {
  config: MultiRoomConfig;
  hostName: string;
  deviceId: string;
}

export interface CreateRoomResult {
  roomId: string;
  room: MultiRoomState;
  credential: string;
}

export async function createRoom(payload: CreateRoomPayload): Promise<ApiResponse<CreateRoomResult>> {
  const result = await apiFetch<CreateRoomResult>('/api/multi/create', {
    method: 'POST',
    body: JSON.stringify(payload),
    deviceId: payload.deviceId,
  });
  if (result.ok) savePlayerCredential(result.data.roomId, result.data.credential);
  return result;
}

// --- Unirse a sala ---

export interface JoinRoomPayload {
  roomId: string;
  name: string;
  deviceId: string;
}

export interface JoinRoomResult {
  room: MultiRoomState;
  credential: string;
}

export async function joinRoom(payload: JoinRoomPayload): Promise<ApiResponse<JoinRoomResult>> {
  const result = await apiFetch<JoinRoomResult>('/api/multi/join', {
    method: 'POST',
    body: JSON.stringify(payload),
    deviceId: payload.deviceId,
    roomId: payload.roomId,
  });
  if (result.ok) savePlayerCredential(payload.roomId, result.data.credential);
  return result;
}

// --- Obtener estado de la sala (polling) ---

export async function getRoomState(roomId: string, deviceId: string): Promise<ApiResponse<MultiRoomState>> {
  return apiFetch<MultiRoomState>(`/api/multi/room/${roomId}`, {
    method: 'GET',
    deviceId,
    roomId,
  });
}

// --- Obtener secreto del jugador ---

export async function getPlayerSecret(roomId: string, deviceId: string): Promise<ApiResponse<PlayerSecret | null>> {
  return apiFetch<PlayerSecret | null>(`/api/multi/secret/${roomId}`, {
    method: 'GET',
    deviceId,
    roomId,
  });
}

// --- Iniciar partida (solo host) ---

export interface StartGamePayload {
  roomId: string;
  deviceId: string;
}

export async function startGame(payload: StartGamePayload): Promise<ApiResponse<MultiRoomState>> {
  return apiFetch<MultiRoomState>('/api/multi/start', {
    method: 'POST',
    body: JSON.stringify(payload),
    deviceId: payload.deviceId,
    roomId: payload.roomId,
  });
}

export async function restartGame(payload: StartGamePayload): Promise<ApiResponse<MultiRoomState>> {
  return apiFetch<MultiRoomState>('/api/multi/restart', {
    method: 'POST',
    body: JSON.stringify(payload),
    deviceId: payload.deviceId,
    roomId: payload.roomId,
  });
}

// --- Confirmar revelación de rol ---

export async function confirmReveal(roomId: string, deviceId: string): Promise<ApiResponse<void>> {
  return apiFetch<void>('/api/multi/reveal-ready', {
    method: 'POST',
    body: JSON.stringify({ roomId }),
    deviceId,
    roomId,
  });
}

// --- Enviar acción del operativo ---

export interface SubmitActionPayload {
  roomId: string;
  deviceId: string;
  action: Omit<PlayerOperativeAction, 'submittedAt'>;
}

export async function submitOperativeAction(payload: SubmitActionPayload): Promise<ApiResponse<void>> {
  return apiFetch<void>('/api/multi/action', {
    method: 'POST',
    body: JSON.stringify(payload),
    deviceId: payload.deviceId,
    roomId: payload.roomId,
  });
}

// --- Emitir voto ---

export interface CastVotePayload {
  roomId: string;
  deviceId: string;
  targetId: string;
}

export async function castVote(payload: CastVotePayload): Promise<ApiResponse<void>> {
  return apiFetch<void>('/api/multi/vote', {
    method: 'POST',
    body: JSON.stringify(payload),
    deviceId: payload.deviceId,
    roomId: payload.roomId,
  });
}

// --- Avanzar de fase (host) ---

export interface AdvancePhasePayload {
  roomId: string;
  deviceId: string;
}

export async function advancePhase(payload: AdvancePhasePayload): Promise<ApiResponse<MultiRoomState>> {
  return apiFetch<MultiRoomState>('/api/multi/advance', {
    method: 'POST',
    body: JSON.stringify(payload),
    deviceId: payload.deviceId,
    roomId: payload.roomId,
  });
}

export interface ControlPlayerPayload {
  roomId: string;
  deviceId: string;
  targetDeviceId: string;
  action: 'omit' | 'kick';
}

export async function controlPlayer(payload: ControlPlayerPayload): Promise<ApiResponse<MultiRoomState>> {
  return apiFetch<MultiRoomState>('/api/multi/player-control', {
    method: 'POST',
    body: JSON.stringify({
      roomId: payload.roomId,
      targetDeviceId: payload.targetDeviceId,
      action: payload.action,
    }),
    deviceId: payload.deviceId,
    roomId: payload.roomId,
  });
}

// --- Expulsar sala (host) ---

export async function resetRoom(roomId: string, deviceId: string): Promise<ApiResponse<void>> {
  const result = await apiFetch<void>('/api/multi/reset', {
    method: 'POST',
    body: JSON.stringify({ roomId }),
    deviceId,
    roomId,
  });
  if (result.ok) clearPlayerCredential(roomId);
  return result;
}
