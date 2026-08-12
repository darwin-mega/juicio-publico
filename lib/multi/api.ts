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
  options: RequestInit & { deviceId?: string; credential?: string } = {}
): Promise<ApiResponse<T>> {
  const { deviceId, credential, ...fetchOptions } = options;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> ?? {}),
  };
  
  if (deviceId) {
    headers['X-Device-Id'] = deviceId;
  }
  if (credential) {
    headers['X-Player-Credential'] = credential;
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

export interface JoinRoomResult {
  room: MultiRoomState;
  credential: string;
}

export async function joinRoom(
  payload: JoinRoomPayload,
  credential?: string
): Promise<ApiResponse<JoinRoomResult>> {
  return apiFetch<JoinRoomResult>('/api/multi/join', {
    method: 'POST',
    body: JSON.stringify(payload),
    deviceId: payload.deviceId,
    credential,
  });
}

// --- Obtener estado de la sala (polling) ---

export async function getRoomState(
  roomId: string,
  deviceId: string,
  credential: string
): Promise<ApiResponse<MultiRoomState>> {
  return apiFetch<MultiRoomState>(`/api/multi/room/${roomId}`, {
    method: 'GET',
    deviceId,
    credential,
  });
}

// --- Obtener secreto del jugador ---

export async function getPlayerSecret(roomId: string, deviceId: string, credential: string): Promise<ApiResponse<PlayerSecret | null>> {
  return apiFetch<PlayerSecret | null>(`/api/multi/secret/${roomId}`, {
    method: 'GET',
    deviceId,
    credential,
  });
}

// --- Iniciar partida (solo host) ---

export interface StartGamePayload {
  roomId: string;
  deviceId: string;
  credential: string;
}

export async function startGame(payload: StartGamePayload): Promise<ApiResponse<MultiRoomState>> {
  return apiFetch<MultiRoomState>('/api/multi/start', {
    method: 'POST',
    body: JSON.stringify({ roomId: payload.roomId }),
    deviceId: payload.deviceId,
    credential: payload.credential,
  });
}

export async function restartGame(payload: StartGamePayload): Promise<ApiResponse<MultiRoomState>> {
  return apiFetch<MultiRoomState>('/api/multi/restart', {
    method: 'POST',
    body: JSON.stringify({ roomId: payload.roomId }),
    deviceId: payload.deviceId,
    credential: payload.credential,
  });
}

// --- Confirmar revelación de rol ---

export async function confirmReveal(roomId: string, deviceId: string, credential: string): Promise<ApiResponse<void>> {
  return apiFetch<void>('/api/multi/reveal-ready', {
    method: 'POST',
    body: JSON.stringify({ roomId }),
    deviceId,
    credential,
  });
}

// --- Enviar acción del operativo ---

export interface SubmitActionPayload {
  roomId: string;
  deviceId: string;
  credential: string;
  action: Omit<PlayerOperativeAction, 'submittedAt'>;
}

export async function submitOperativeAction(payload: SubmitActionPayload): Promise<ApiResponse<void>> {
  return apiFetch<void>('/api/multi/action', {
    method: 'POST',
    body: JSON.stringify({ roomId: payload.roomId, action: payload.action }),
    deviceId: payload.deviceId,
    credential: payload.credential,
  });
}

// --- Emitir voto ---

export interface CastVotePayload {
  roomId: string;
  deviceId: string;
  credential: string;
  targetId: string;
}

export async function castVote(payload: CastVotePayload): Promise<ApiResponse<void>> {
  return apiFetch<void>('/api/multi/vote', {
    method: 'POST',
    body: JSON.stringify({ roomId: payload.roomId, targetId: payload.targetId }),
    deviceId: payload.deviceId,
    credential: payload.credential,
  });
}

// --- Avanzar de fase (host) ---

export interface AdvancePhasePayload {
  roomId: string;
  deviceId: string;
  credential: string;
}

export async function advancePhase(payload: AdvancePhasePayload): Promise<ApiResponse<MultiRoomState>> {
  return apiFetch<MultiRoomState>('/api/multi/advance', {
    method: 'POST',
    body: JSON.stringify({ roomId: payload.roomId }),
    deviceId: payload.deviceId,
    credential: payload.credential,
  });
}

// --- Expulsar sala (host) ---

export async function resetRoom(roomId: string, deviceId: string, credential: string): Promise<ApiResponse<void>> {
  return apiFetch<void>('/api/multi/reset', {
    method: 'POST',
    body: JSON.stringify({ roomId }),
    deviceId,
    credential,
  });
}
