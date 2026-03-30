// ============================================================
// lib/multi/types.ts
// Tipos TypeScript para el Modo Multidispositivo.
//
// Este módulo es INDEPENDIENTE del GameContext/GameState del
// modo mesa. El estado vive en Redis (compartido entre todos
// los dispositivos), no en localStorage.
// ============================================================

import { Role, RoundReport } from '@/lib/game/state';

// --- Identificadores ---

export type DeviceId = string; // UUID v4 generado una vez por dispositivo
export type RoomId   = string; // 6 caracteres alfanuméricos, ej: "XK7F2A"

// --- Configuración de sala ---

export interface MultiRoomConfig {
  killerCount: number;
  copCount: number;
  trialDurationSeconds: number;
}

// --- Jugador en sala multi ---
// El rol NUNCA va en esta estructura pública.
// Se guarda en una clave separada de Redis por seguridad.

export interface MultiPlayer {
  deviceId: DeviceId;
  name: string;
  joinedAt: number;
  isAlive: boolean;
  isRevealed: boolean;
  readyForOperative: boolean; // confirmó su rol en la pantalla reveal
}

// --- Acción de operativo ---

export type OperativeActionType = 'kill' | 'save' | 'inspect' | 'neutral';

export interface PlayerOperativeAction {
  type: OperativeActionType;
  targetId: string | null; // null para acciones neutrales
  submittedAt: number;
}

// --- Estado del juego dentro de la sala ---

export type MultiGamePhase = 'reveal' | 'operative' | 'news' | 'trial' | 'vote' | 'resolution';

export interface MultiGameState {
  phase: MultiGamePhase;
  round: number;
  // DeviceId → acción enviada (null = aún no envió)
  pendingActions: Record<DeviceId, PlayerOperativeAction | null>;
  // DeviceId → DeviceId del votado
  votes: Record<DeviceId, DeviceId>;
  reports: RoundReport[];
  winnerFaction: 'killers' | 'town' | null;
  isOver: boolean;
  // Timestamp de inicio del timer de juicio (en ms)
  trialStartedAt: number | null;
}

// --- Estado completo de la sala (guardado en Redis) ---

export type RoomStatus = 'lobby' | 'playing' | 'finished';

export interface MultiRoomState {
  roomId: RoomId;
  hostId: DeviceId;
  status: RoomStatus;
  config: MultiRoomConfig;
  players: MultiPlayer[];
  game: MultiGameState | null; // null hasta que el host inicia
  createdAt: number;
  updatedAt: number;
}

// --- Secreto privado del jugador (clave separada en Redis) ---
// Nunca se expone en el estado público de la sala.

export interface PlayerSecret {
  deviceId: DeviceId;
  role: Role;
  teammateIds: DeviceId[]; // IDs de compañeros de equipo (killers entre sí, cops entre sí)
}

// --- Respuestas de API ---

export interface ApiOk<T = undefined> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: string;
}

export type ApiResponse<T = undefined> = ApiOk<T> | ApiError;

// --- Payload de la vista del jugador ---
// Lo que cada dispositivo necesita saber sobre sí mismo en el juego:

export interface PlayerGameView {
  room: MultiRoomState;
  me: MultiPlayer | null;
  secret: PlayerSecret | null; // null si no se inició aún
  isHost: boolean;
  hasActed: boolean; // ya envió acción en el operativo
  hasVoted: boolean; // ya votó
}
