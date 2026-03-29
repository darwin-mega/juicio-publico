// ============================================================
// lib/modes/individual.ts
// Lógica específica para el MODO INDIVIDUAL.
//
// En este modo, cada jugador usa su propio dispositivo.
// Requiere sincronización en tiempo real (WebSocket / polling).
//
// Esta implementación es el esqueleto base para expansión futura.
// ============================================================

/**
 * Genera un código de sala único para compartir con los jugadores.
 * En el MVP se usa como identificador local; en producción se
 * conectará a un backend (ej. Upstash Redis + Vercel).
 */
export function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * Construye la URL de invitación que los jugadores escanean.
 *
 * TODO: conectar con el sistema de salas del backend.
 */
export function buildInviteUrl(roomCode: string, baseUrl: string): string {
  return `${baseUrl}/join/${roomCode}`;
}

/**
 * Tipo de mensaje que se envía entre dispositivos.
 * Se expande cuando se implementa el canal de comunicación real.
 */
export type RoomMessage =
  | { type: 'PHASE_CHANGE'; phase: string }
  | { type: 'PLAYER_ACTION'; playerId: string; action: string; targetId: string }
  | { type: 'VOTE_CAST'; voterId: string; targetId: string }
  | { type: 'GAME_OVER'; winner: string };

/**
 * Stub: cliente de sala para modo individual.
 * Reemplazar con WebSocket o Pusher en iteraciones futuras.
 *
 * TODO: implementar suscripción real a cambios de estado remoto.
 */
export function createRoomClient(_roomCode: string) {
  return {
    connect: () => Promise.resolve(),
    disconnect: () => {},
    send: (_msg: RoomMessage) => Promise.resolve(),
    onMessage: (_handler: (msg: RoomMessage) => void) => () => {},
  };
}
