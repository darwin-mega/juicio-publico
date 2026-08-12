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

import type { MultiRoomState, OperativeProposal, PlayerSecret, DeviceId, RoomId } from './types';
import { Redis } from '@upstash/redis';
import { randomUUID } from 'node:crypto';

// --- Configuración de Prefijo ---
// Usamos 'jp:' para Juicio Público para evitar colisiones si se comparte
// la misma base de datos con otros juegos (como 'lqp:' para La Quinta Pata).
const PREFIX = 'jp';

// --- Claves de Redis ---
export const KEYS = {
  room: (roomId: RoomId) => `${PREFIX}:room:${roomId}`,
  lock: (roomId: RoomId) => `${PREFIX}:lock:${roomId}`,
  secret: (roomId: RoomId, deviceId: DeviceId) => `${PREFIX}:secret:${roomId}:${deviceId}`,
  credential: (roomId: RoomId, deviceId: DeviceId) => `${PREFIX}:credential:${roomId}:${deviceId}`,
  operativeProposal: (roomId: RoomId, deviceId: DeviceId) => `${PREFIX}:operative:${roomId}:${deviceId}`,
} as const;

// TTL de 4 horas para salas activas
const ROOM_TTL_SECONDS = 4 * 60 * 60;
const ROOM_LOCK_TTL_MS = 5_000;
const ROOM_LOCK_ATTEMPTS = 10;

export class RoomBusyError extends Error {
  constructor() {
    super('La sala está procesando otra acción.');
    this.name = 'RoomBusyError';
  }
}

// ============================================================
// Detección de modo: Redis real vs In-Memory
// ============================================================

const USE_REDIS = !!(
  (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) &&
  (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN)
);

function assertStoreConfigured(): void {
  if (!USE_REDIS && process.env.NODE_ENV === 'production') {
    throw new Error('Redis no está configurado. Se rechaza el almacenamiento en memoria en producción.');
  }
}

// ============================================================
// Implementación Redis (producción)
// ============================================================

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
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

export async function checkStoreHealth(): Promise<'redis' | 'memory'> {
  assertStoreConfigured();
  if (!USE_REDIS) return 'memory';

  const response = await getRedis().ping();
  if (response !== 'PONG') {
    throw new Error('El almacenamiento de salas no respondió correctamente.');
  }
  return 'redis';
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function acquireRoomLock(roomId: RoomId, token: string): Promise<boolean> {
  const key = KEYS.lock(roomId);
  if (USE_REDIS) {
    const result = await getRedis().set(key, token, { nx: true, px: ROOM_LOCK_TTL_MS });
    return result === 'OK';
  }
  if (memExists(key)) return false;
  memSet(key, token, ROOM_LOCK_TTL_MS / 1000);
  return true;
}

async function releaseRoomLock(roomId: RoomId, token: string): Promise<void> {
  const key = KEYS.lock(roomId);
  if (USE_REDIS) {
    await getRedis().eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      [key],
      [token]
    );
    return;
  }
  if (memGet<string>(key) === token) memDel(key);
}

export async function withRoomLock<T>(roomId: RoomId, task: () => Promise<T>): Promise<T> {
  assertStoreConfigured();
  const token = randomUUID();

  for (let attempt = 0; attempt < ROOM_LOCK_ATTEMPTS; attempt += 1) {
    if (await acquireRoomLock(roomId, token)) {
      try {
        return await task();
      } finally {
        await releaseRoomLock(roomId, token);
      }
    }
    await sleep(20 + attempt * 15 + Math.floor(Math.random() * 15));
  }

  throw new RoomBusyError();
}

// ============================================================
// API pública (misma interfaz, backing configurable)
// ============================================================

export async function saveRoom(room: MultiRoomState): Promise<void> {
  assertStoreConfigured();
  if (USE_REDIS) {
    const redis = getRedis();
    await redis.set(KEYS.room(room.roomId), room, { ex: ROOM_TTL_SECONDS });
  } else {
    memSet(KEYS.room(room.roomId), room, ROOM_TTL_SECONDS);
  }
}

export async function getRoom(roomId: RoomId): Promise<MultiRoomState | null> {
  assertStoreConfigured();
  if (USE_REDIS) {
    const redis = getRedis();
    return redis.get<MultiRoomState>(KEYS.room(roomId));
  }
  return memGet<MultiRoomState>(KEYS.room(roomId));
}

export async function roomExists(roomId: RoomId): Promise<boolean> {
  assertStoreConfigured();
  if (USE_REDIS) {
    const redis = getRedis();
    const exists = await redis.exists(KEYS.room(roomId));
    return exists === 1;
  }
  return memExists(KEYS.room(roomId));
}

export async function saveCredentialHash(
  roomId: RoomId,
  deviceId: DeviceId,
  credentialHash: string
): Promise<void> {
  assertStoreConfigured();
  if (USE_REDIS) {
    await getRedis().set(KEYS.credential(roomId, deviceId), credentialHash, { ex: ROOM_TTL_SECONDS });
  } else {
    memSet(KEYS.credential(roomId, deviceId), credentialHash, ROOM_TTL_SECONDS);
  }
}

export async function createRoomIfAbsent(room: MultiRoomState): Promise<boolean> {
  assertStoreConfigured();
  if (USE_REDIS) {
    const result = await getRedis().set(KEYS.room(room.roomId), room, {
      ex: ROOM_TTL_SECONDS,
      nx: true,
    });
    return result === 'OK';
  }
  if (memExists(KEYS.room(room.roomId))) return false;
  memSet(KEYS.room(room.roomId), room, ROOM_TTL_SECONDS);
  return true;
}

export async function getCredentialHash(
  roomId: RoomId,
  deviceId: DeviceId
): Promise<string | null> {
  assertStoreConfigured();
  if (USE_REDIS) {
    return getRedis().get<string>(KEYS.credential(roomId, deviceId));
  }
  return memGet<string>(KEYS.credential(roomId, deviceId));
}

export async function saveSecret(
  roomId: RoomId,
  deviceId: DeviceId,
  secret: PlayerSecret
): Promise<void> {
  assertStoreConfigured();
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
  assertStoreConfigured();
  if (USE_REDIS) {
    const redis = getRedis();
    return redis.get<PlayerSecret>(KEYS.secret(roomId, deviceId));
  }
  return memGet<PlayerSecret>(KEYS.secret(roomId, deviceId));
}

export async function saveOperativeProposal(
  roomId: RoomId,
  deviceId: DeviceId,
  proposal: OperativeProposal
): Promise<void> {
  assertStoreConfigured();
  if (USE_REDIS) {
    const redis = getRedis();
    await redis.set(KEYS.operativeProposal(roomId, deviceId), proposal, { ex: ROOM_TTL_SECONDS });
  } else {
    memSet(KEYS.operativeProposal(roomId, deviceId), proposal, ROOM_TTL_SECONDS);
  }
}

export async function getOperativeProposal(
  roomId: RoomId,
  deviceId: DeviceId
): Promise<OperativeProposal | null> {
  assertStoreConfigured();
  if (USE_REDIS) {
    const redis = getRedis();
    return redis.get<OperativeProposal>(KEYS.operativeProposal(roomId, deviceId));
  }
  return memGet<OperativeProposal>(KEYS.operativeProposal(roomId, deviceId));
}

export async function deleteOperativeProposal(
  roomId: RoomId,
  deviceId: DeviceId
): Promise<void> {
  assertStoreConfigured();
  if (USE_REDIS) {
    const redis = getRedis();
    await redis.del(KEYS.operativeProposal(roomId, deviceId));
  } else {
    memDel(KEYS.operativeProposal(roomId, deviceId));
  }
}

export async function deleteRoom(roomId: RoomId): Promise<void> {
  assertStoreConfigured();
  if (USE_REDIS) {
    const redis = getRedis();
    await redis.del(KEYS.room(roomId));
  } else {
    memDel(KEYS.room(roomId));
  }
}

export async function deleteRoomData(room: MultiRoomState): Promise<void> {
  assertStoreConfigured();
  const keys = [
    KEYS.room(room.roomId),
    ...room.players.flatMap((player) => [
      KEYS.secret(room.roomId, player.deviceId),
      KEYS.credential(room.roomId, player.deviceId),
      KEYS.operativeProposal(room.roomId, player.deviceId),
    ]),
  ];

  if (USE_REDIS) {
    await Promise.all(keys.map((key) => getRedis().del(key)));
  } else {
    keys.forEach(memDel);
  }
}
