// ============================================================
// lib/multi/redis.ts
// Capa de acceso a datos para el modo multidispositivo.
//
// - Si KV_REST_API_URL está configurado → usa Redis real (Vercel KV).
// - Si no → usa un almacén en memoria (válido para desarrollo
//   local en un solo proceso de Next.js dev).
//
// Todas las operaciones son async para uso en API routes.
// ============================================================

import type { MultiRoomState, PlayerSecret, DeviceId, RoomId } from './types';

// --- Configuración de Prefijo ---
// Usamos 'jp:' para Juicio Público para evitar colisiones si se comparte
// la misma base de datos con otros juegos (como 'lqp:' para La Quinta Pata).
const PREFIX = 'jp';

// --- Claves de Redis ---
export const KEYS = {
  room: (roomId: RoomId) => `${PREFIX}:room:${roomId}`,
  secret: (roomId: RoomId, deviceId: DeviceId) => `${PREFIX}:secret:${roomId}:${deviceId}`,
} as const;

// TTL de 4 horas para salas activas
const ROOM_TTL_SECONDS = 4 * 60 * 60;

// ============================================================
// Detección de modo: Redis real vs In-Memory
// ============================================================

const USE_REDIS = !!(
  (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) &&
  (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN)
);

// ============================================================
// Implementación Redis (producción)
// ============================================================

let _redis: import('@upstash/redis').Redis | null = null;

function getRedis(): import('@upstash/redis').Redis {
  if (!_redis) {
    const { Redis } = require('@upstash/redis') as typeof import('@upstash/redis');
    _redis = new Redis({
      url: (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL)!,
      token: (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN)!,
    });
  }
  return _redis;
}

// ============================================================
// Implementación In-Memory (desarrollo local)
// ============================================================

const globalForStore = globalThis as typeof globalThis & {
  __multiStore?: Map<string, { value: unknown; expiresAt: number }>;
};

function getStore(): Map<string, { value: unknown; expiresAt: number }> {
  if (!globalForStore.__multiStore) {
    globalForStore.__multiStore = new Map();
  }
  return globalForStore.__multiStore;
}

function memGet<T>(key: string): T | null {
  const store = getStore();
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return JSON.parse(JSON.stringify(entry.value)) as T;
}

function memSet<T>(key: string, value: T, ttlSeconds: number): void {
  const store = getStore();
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

function memDel(key: string): void {
  getStore().delete(key);
}

function memExists(key: string): boolean {
  const entry = getStore().get(key);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    getStore().delete(key);
    return false;
  }
  return true;
}

// ============================================================
// API pública (misma interfaz, backing configurable)
// ============================================================

export async function saveRoom(room: MultiRoomState): Promise<void> {
  if (USE_REDIS) {
    const redis = getRedis();
    await redis.set(KEYS.room(room.roomId), room, { ex: ROOM_TTL_SECONDS });
  } else {
    memSet(KEYS.room(room.roomId), room, ROOM_TTL_SECONDS);
  }
}

export async function getRoom(roomId: RoomId): Promise<MultiRoomState | null> {
  if (USE_REDIS) {
    const redis = getRedis();
    return redis.get<MultiRoomState>(KEYS.room(roomId));
  }
  return memGet<MultiRoomState>(KEYS.room(roomId));
}

export async function roomExists(roomId: RoomId): Promise<boolean> {
  if (USE_REDIS) {
    const redis = getRedis();
    const exists = await redis.exists(KEYS.room(roomId));
    return exists === 1;
  }
  return memExists(KEYS.room(roomId));
}

export async function saveSecret(
  roomId: RoomId,
  deviceId: DeviceId,
  secret: PlayerSecret
): Promise<void> {
  if (USE_REDIS) {
    const redis = getRedis();
    await redis.set(KEYS.secret(roomId, deviceId), secret, { ex: ROOM_TTL_SECONDS });
  } else {
    memSet(KEYS.secret(roomId, deviceId), secret, ROOM_TTL_SECONDS);
  }
}

export async function getSecret(
  roomId: RoomId,
  deviceId: DeviceId
): Promise<PlayerSecret | null> {
  if (USE_REDIS) {
    const redis = getRedis();
    return redis.get<PlayerSecret>(KEYS.secret(roomId, deviceId));
  }
  return memGet<PlayerSecret>(KEYS.secret(roomId, deviceId));
}

export async function deleteRoom(roomId: RoomId): Promise<void> {
  if (USE_REDIS) {
    const redis = getRedis();
    await redis.del(KEYS.room(roomId));
  } else {
    memDel(KEYS.room(roomId));
  }
}

