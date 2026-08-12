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

// --- Configuración de Prefijo ---
// Usamos 'jp:' para Juicio Público para evitar colisiones si se comparte
// la misma base de datos con otros juegos (como 'lqp:' para La Quinta Pata).
const PREFIX = 'jp';

// --- Claves de Redis ---
export const KEYS = {
  room: (roomId: RoomId) => `${PREFIX}:room:${roomId}`,
  roomLock: (roomId: RoomId) => `${PREFIX}:lock:${roomId}`,
  secret: (roomId: RoomId, deviceId: DeviceId) => `${PREFIX}:secret:${roomId}:${deviceId}`,
  credential: (roomId: RoomId, deviceId: DeviceId) => `${PREFIX}:credential:${roomId}:${deviceId}`,
  operativeProposal: (roomId: RoomId, deviceId: DeviceId) => `${PREFIX}:operative:${roomId}:${deviceId}`,
} as const;

// TTL amplio para que el link siga sirviendo durante partidas largas y reconexiones.
const ROOM_TTL_SECONDS = 24 * 60 * 60;

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
  (process.env.JUICIO_KV_REST_API_URL || process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) &&
  (process.env.JUICIO_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN)
);

function assertStoreConfigured(): void {
  if (!USE_REDIS && process.env.NODE_ENV === 'production') {
    throw new Error('Redis no está configurado; el almacenamiento en memoria está deshabilitado en producción.');
  }
}

export async function checkStoreHealth(): Promise<'redis' | 'memory'> {
  assertStoreConfigured();
  if (!USE_REDIS) return 'memory';
  const response = await getRedis().ping();
  if (response !== 'PONG') throw new Error('Redis no respondió correctamente.');
  return 'redis';
}

// ============================================================
// Implementación Redis (producción)
// ============================================================

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: (process.env.JUICIO_KV_REST_API_URL || process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL)!,
      token: (process.env.JUICIO_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN)!,
    });
  }
  return _redis;
}

// ============================================================
// Implementación In-Memory (desarrollo local)
// ============================================================

const globalForStore = globalThis as typeof globalThis & {
  __multiStore?: Map<string, { value: unknown; expiresAt: number }>;
  __multiRoomQueues?: Map<string, Promise<unknown>>;
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

export async function saveCredentialHash(roomId: RoomId, deviceId: DeviceId, hash: string): Promise<void> {
  assertStoreConfigured();
  if (USE_REDIS) await getRedis().set(KEYS.credential(roomId, deviceId), hash, { ex: ROOM_TTL_SECONDS });
  else memSet(KEYS.credential(roomId, deviceId), hash, ROOM_TTL_SECONDS);
}

export async function getCredentialHash(roomId: RoomId, deviceId: DeviceId): Promise<string | null> {
  assertStoreConfigured();
  return USE_REDIS
    ? getRedis().get<string>(KEYS.credential(roomId, deviceId))
    : memGet<string>(KEYS.credential(roomId, deviceId));
}

export async function createRoomIfAbsent(room: MultiRoomState): Promise<boolean> {
  assertStoreConfigured();
  if (USE_REDIS) {
    const result = await getRedis().set(KEYS.room(room.roomId), room, { ex: ROOM_TTL_SECONDS, nx: true });
    return result === 'OK';
  }
  if (memExists(KEYS.room(room.roomId))) return false;
  memSet(KEYS.room(room.roomId), room, ROOM_TTL_SECONDS);
  return true;
}

export async function withRoomLock<T>(roomId: RoomId, task: () => Promise<T>): Promise<T> {
  const queueKey = roomId.toUpperCase();
  const queues = getRoomQueues();
  const previous = queues.get(queueKey) || Promise.resolve();
  const current = previous.catch(() => undefined).then(async () => {
    const token = await acquireRedisRoomLock(queueKey);
    try { return await task(); } finally { await releaseRedisRoomLock(queueKey, token); }
  });
  queues.set(queueKey, current.then(() => undefined, () => undefined));
  return current;
}

function getRoomQueues(): Map<string, Promise<unknown>> {
  if (!globalForStore.__multiRoomQueues) {
    globalForStore.__multiRoomQueues = new Map();
  }
  return globalForStore.__multiRoomQueues;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function acquireRedisRoomLock(roomId: RoomId): Promise<string | null> {
  if (!USE_REDIS) return null;

  const redis = getRedis();
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  for (let attempt = 0; attempt < 40; attempt++) {
    const acquired = await redis.set(KEYS.roomLock(roomId), token, { nx: true, ex: 5 });
    if (acquired) return token;
    await sleep(50);
  }

  throw new Error(`No se pudo adquirir el lock de la sala ${roomId}`);
}

async function releaseRedisRoomLock(roomId: RoomId, token: string | null): Promise<void> {
  if (!USE_REDIS || !token) return;

  try {
    const redis = getRedis();
    const currentToken = await redis.get<string>(KEYS.roomLock(roomId));
    if (currentToken === token) {
      await redis.del(KEYS.roomLock(roomId));
    }
  } catch (err) {
    console.error('[multi/redis] release lock error', err);
  }
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
  if (USE_REDIS) await Promise.all(keys.map((key) => getRedis().del(key)));
  else keys.forEach(memDel);
}

export async function mutateRoom<T>(
  roomId: RoomId,
  mutator: (room: MultiRoomState) => Promise<T> | T
): Promise<T | null> {
  assertStoreConfigured();
  const queues = getRoomQueues();
  const queueKey = roomId.toUpperCase();
  const previous = queues.get(queueKey) || Promise.resolve();

  const current = previous
    .catch(() => undefined)
    .then(async () => {
      const lockToken = await acquireRedisRoomLock(queueKey);

      try {
        const room = await getRoom(queueKey);
        if (!room) return null;

        const result = await mutator(room);
        await saveRoom(room);
        return result;
      } finally {
        await releaseRedisRoomLock(queueKey, lockToken);
      }
    });

  queues.set(queueKey, current.then(() => undefined, () => undefined));
  return current;
}
