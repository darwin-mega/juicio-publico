'use client';

// ============================================================
// lib/multi/device.ts
// Gestión del deviceId — identificador único por dispositivo.
//
// Se genera una sola vez y se guarda en localStorage.
// Permite reconexión si el jugador recarga la página.
// ============================================================

const DEVICE_ID_KEY = 'juicio-multi-device-id';

/**
 * Genera un UUID v4 simple sin dependencias externas.
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  throw new Error('Este dispositivo no ofrece generación criptográfica segura.');
}

/**
 * Retorna el deviceId del dispositivo actual.
 * Si no existe, lo genera y lo guarda en localStorage.
 * Solo usar en el cliente (dentro de useEffect o con 'use client').
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return '';
  
  const stored = localStorage.getItem(DEVICE_ID_KEY);
  if (stored) return stored;
  
  const newId = generateUUID();
  localStorage.setItem(DEVICE_ID_KEY, newId);
  return newId;
}

/**
 * Retorna el deviceId del dispositivo actual sin crearlo si no existe.
 */
export function getDeviceId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(DEVICE_ID_KEY);
}

const LAST_ROOM_KEY = 'juicio-multi-last-room';

/**
 * Guarda el último roomId al que se unió este dispositivo.
 * Permite reconexión automática.
 */
export function saveLastRoom(roomId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_ROOM_KEY, roomId);
}

/**
 * Retorna el último roomId guardado, si existe.
 */
export function getLastRoom(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(LAST_ROOM_KEY);
}

/**
 * Limpia el último room guardado (al salir voluntariamente).
 */
export function clearLastRoom(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LAST_ROOM_KEY);
}

const HOST_ROOM_KEY = 'juicio-multi-host-room';

/**
 * Guarda el roomId de la sala que este dispositivo creó como host.
 */
export function saveHostRoom(roomId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HOST_ROOM_KEY, roomId);
}

/**
 * Retorna el roomId de la sala hosteada por este dispositivo.
 */
export function getHostRoom(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(HOST_ROOM_KEY);
}

export function clearHostRoom(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(HOST_ROOM_KEY);
}

const ROOM_CREDENTIAL_PREFIX = 'juicio-multi-credential:';

export function saveRoomCredential(roomId: string, credential: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${ROOM_CREDENTIAL_PREFIX}${roomId.toUpperCase()}`, credential);
}

export function getRoomCredential(roomId: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(`${ROOM_CREDENTIAL_PREFIX}${roomId.toUpperCase()}`);
}

export function clearRoomCredential(roomId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`${ROOM_CREDENTIAL_PREFIX}${roomId.toUpperCase()}`);
}
