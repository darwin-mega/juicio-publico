// ============================================================
// lib/modes/table.ts
// Lógica específica para el MODO MESA.
//
// FILOSOFÍA DE IDENTIDAD:
//   - Todos los jugadores pasan el dispositivo el mismo tiempo.
//   - El orden es completamente aleatorio (no por rol).
//   - El operativo NO tiene un orden estructurado por rol, por lo
//     que observar cuánto tiempo tiene alguien el teléfono no
//     revela nada sobre su identidad.
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
    'Cada noche elegís a quién proteger. Si los asesinos atacan a esa persona, la salvarás. Nadie sabe que sos el Doctor.',
  cop:
    'Cada noche investigás a un jugador. El resultado se revela públicamente en las noticias del día siguiente.',
  town:
    'No tenés acción nocturna. Tu poder está en el debate: convencé al grupo de quién es el sospechoso.',
};

export const ROLE_EMOJIS: Record<Role, string> = {
  killer: '🔪',
  doctor: '🩺',
  cop:    '🔍',
  town:   '🏘️',
};

export const ROLE_COLORS: Record<Role, string> = {
  killer: 'var(--role-killer)',
  doctor: 'var(--role-doctor)',
  cop:    'var(--role-cop)',
  town:   'var(--role-town)',
};

export function getTeammates(player: Player, allPlayers: Player[]): Player[] {
  if (player.role === 'killer')
    return allPlayers.filter((p) => p.role === 'killer' && p.id !== player.id);
  if (player.role === 'cop')
    return allPlayers.filter((p) => p.role === 'cop' && p.id !== player.id);
  return [];
}

export function getTeammateLabel(role: Role): string {
  if (role === 'killer') return '🤝 Tu cómplice:';
  if (role === 'cop')    return '🤝 Tu compañero:';
  return '';
}

// ─── Operativo encubierto — tipos de acción ────────────────
//
// IMPORTANTE: el orden en que los jugadores pasan el dispositivo
// es COMPLETAMENTE ALEATORIO (fixedPassOrder usa shuffle).
// No existe un "orden por rol" — el doctor puede actuar antes que
// el asesino y viceversa. Esto protege la identidad de todos.
//
// Como el resultado de la investigación policial solo se revela
// en la sección de noticias (para todos juntos), la mecánica de
// "cop-vote" (ver resultado inmediato) ya no existe.

export type OperativeActionType =
  | 'killer-single'   // único asesino: elige 1 objetivo
  | 'killer-propose'  // primer asesino (de 2+): propone candidatos
  | 'killer-vote'     // segundo asesino: elige uno de los proposals
  | 'killer-done'     // asesino adicional (3.º+): ya coordinaron
  | 'doctor'          // elige 1 jugador para proteger
  | 'cop'             // elige 1 jugador para investigar (sin ver resultado)
  | 'cop-done'        // cop adicional: ya coordinaron
  | 'town';           // pueblo: pantalla neutra (misma duración que el resto)

/**
 * Retorna el tipo de acción para el jugador según su rol y el avance
 * de la ronda. Todos los jugadores pasan exactamente una vez.
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
      return 'killer-done'; // 3.º asesino en adelante

    case 'doctor':
      return 'doctor';

    case 'cop':
      // Con 2 policías: el primero propone, el segundo confirma.
      // Ninguno ve el resultado — se revela en noticias.
      if (aliveCopCount === 1) return 'cop';
      if (copActedCount === 0) return 'cop'; // primer cop: propone
      if (copActedCount === 1) return 'cop'; // segundo cop: confirma
      return 'cop-done';

    case 'town':
    default:
      return 'town';
  }
}

// ─── Mensajes de traspaso ──────────────────────────────────

export function getHandoffMessage(playerName: string): string {
  return `Pasá el dispositivo a ${playerName}. No muestres la pantalla.`;
}
