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
  // Fallback para entornos sin crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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
