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

// Helper interno para hacer fetch con el header de deviceId
async function apiFetch<T>(
  url: string,
  options: RequestInit & { deviceId?: string } = {}
): Promise<ApiResponse<T>> {
  const { deviceId, ...fetchOptions } = options;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> ?? {}),
  };
  
  if (deviceId) {
    headers['X-Device-Id'] = deviceId;
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
}

export async function createRoom(payload: CreateRoomPayload): Promise<ApiResponse<CreateRoomResult>> {
  return apiFetch<CreateRoomResult>('/api/multi/create', {
    method: 'POST',
    body: JSON.stringify(payload),
    deviceId: payload.deviceId,
  });
}

// --- Unirse a sala ---

export interface JoinRoomPayload {
  roomId: string;
  name: string;
  deviceId: string;
}

export async function joinRoom(payload: JoinRoomPayload): Promise<ApiResponse<MultiRoomState>> {
  return apiFetch<MultiRoomState>('/api/multi/join', {
    method: 'POST',
    body: JSON.stringify(payload),
    deviceId: payload.deviceId,
  });
}

// --- Obtener estado de la sala (polling) ---

export async function getRoomState(roomId: string, deviceId: string): Promise<ApiResponse<MultiRoomState>> {
  return apiFetch<MultiRoomState>(`/api/multi/room/${roomId}`, {
    method: 'GET',
    deviceId,
  });
}

// --- Obtener secreto del jugador ---

export async function getPlayerSecret(roomId: string, deviceId: string): Promise<ApiResponse<PlayerSecret | null>> {
  return apiFetch<PlayerSecret | null>(`/api/multi/secret/${roomId}`, {
    method: 'GET',
    deviceId,
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
  });
}

export async function restartGame(payload: StartGamePayload): Promise<ApiResponse<MultiRoomState>> {
  return apiFetch<MultiRoomState>('/api/multi/restart', {
    method: 'POST',
    body: JSON.stringify(payload),
    deviceId: payload.deviceId,
  });
}

// --- Confirmar revelación de rol ---

export async function confirmReveal(roomId: string, deviceId: string): Promise<ApiResponse<void>> {
  return apiFetch<void>('/api/multi/reveal-ready', {
    method: 'POST',
    body: JSON.stringify({ roomId }),
    deviceId,
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
  });
}

// --- Expulsar sala (host) ---

export async function resetRoom(roomId: string, deviceId: string): Promise<ApiResponse<void>> {
  return apiFetch<void>('/api/multi/reset', {
    method: 'POST',
    body: JSON.stringify({ roomId }),
    deviceId,
  });
}
