// ============================================================
// lib/modes/table.ts
// Lógica específica para el MODO MESA.
// ============================================================

import { Player, Role } from '../game/state';

// ─── Utilidades ────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Revelación privada de roles (pre-juego) ───────────────

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  killer:
    'Cada noche elegís a quién atacar. Tu objetivo es superar en número al pueblo. Coordiná en silencio con tus compañeros asesinos.',
  doctor:
    'Cada noche elegís a quién proteger. Si salvás a la víctima, esa persona sobrevive. Nadie sabe que sos el Doctor.',
  cop:
    'Cada noche investigás a un jugador y descubrís si es asesino o inocente. Esa información es solo tuya. Usala con estrategia.',
  town:
    'No tenés acción nocturna. Tu poder está en el debate: convencé al grupo de quién es el sospechoso. El razonamiento es tu arma.',
};

export const ROLE_EMOJIS: Record<Role, string> = {
  killer: '🔪',
  doctor: '🩺',
  cop: '🔍',
  town: '🏘️',
};

export const ROLE_COLORS: Record<Role, string> = {
  killer: 'var(--role-killer)',
  doctor: 'var(--role-doctor)',
  cop: 'var(--role-cop)',
  town: 'var(--role-town)',
};

export function getTeammates(player: Player, allPlayers: Player[]): Player[] {
  if (player.role === 'killer')
    return allPlayers.filter((p) => p.role === 'killer' && p.id !== player.id);
  if (player.role === 'cop')
    return allPlayers.filter((p) => p.role === 'cop' && p.id !== player.id);
  return [];
}

export function getTeammateLabel(role: Role): string {
  if (role === 'killer') return 'Sos Asesino. Tu cómplice es:';
  if (role === 'cop') return 'Sos Policía. Tu compañero es:';
  return '';
}

// ─── Operativo encubierto — orden de turno ─────────────────

/**
 * Genera un orden aleatorio de los jugadores vivos para el operativo.
 * El dispositivo se pasa en este orden para no revelar patrones.
 */
export function generatePassOrder(players: Player[]): Player[] {
  return shuffle(players.filter((p) => p.isAlive));
}

// ─── Operativo encubierto — tipos de acción ────────────────

export type OperativeActionType =
  | 'killer-single'    // único asesino: elige 1 objetivo directamente
  | 'killer-propose'   // primer asesino (de 2+): propone 3 candidatos
  | 'killer-vote'      // segundo asesino: elige 1 del listado del primero
  | 'killer-done'      // 3.º+ asesino: neutral (coordinación ya hecha)
  | 'doctor'           // elige 1 jugador para salvar
  | 'cop-single'       // único policía: investiga 1 directamente
  | 'cop-propose'      // primer policía: propone 3 candidatos
  | 'cop-vote'         // segundo policía: elige 1 y ve resultado
  | 'cop-done'         // policías adicionales: neutral (ya se investigó)
  | 'town';            // pueblo: pantalla neutra

/**
 * Retorna el tipo de acción que debe ver un jugador en el operativo,
 * dado el estado acumulado de acciones en esa ronda.
 */
export function getOperativeAction(
  player: Player,
  aliveKillerCount: number,
  killerActedCount: number,
  aliveCopCount: number,
  copActedCount: number
): OperativeActionType {
  switch (player.role) {
    case 'killer':
      if (aliveKillerCount === 1) return 'killer-single';
      if (killerActedCount === 0) return 'killer-propose';
      if (killerActedCount === 1) return 'killer-vote';
      return 'killer-done';
    case 'doctor':
      return 'doctor';
    case 'cop':
      if (aliveCopCount === 1) return 'cop-single';
      if (copActedCount === 0) return 'cop-propose';
      if (copActedCount === 1) return 'cop-vote';
      return 'cop-done';
    case 'town':
    default:
      return 'town';
  }
}

/**
 * Determina si el rol investigado es asesino o no.
 * Esta función vive en el módulo de mesa porque la revelación
 * del resultado solo ocurre en modo mesa (el cop lo ve inmediatamente).
 */
export function evaluateInspection(target: Player): 'killer' | 'innocent' {
  return target.role === 'killer' ? 'killer' : 'innocent';
}

// ─── Mensajes de traspaso ──────────────────────────────────

export function getHandoffMessage(playerName: string): string {
  return `Pasá el dispositivo a ${playerName}. No muestres la pantalla.`;
}
