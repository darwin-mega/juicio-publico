// ============================================================
// lib/game/rules.ts
// Motor de reglas: asignación de roles, resolución del
// operativo, condición de victoria, balance inicial.
// ============================================================

import {
  GameState,
  GameConfig,
  Player,
  Role,
  OperativeActions,
  RoundReport,
} from './state';

// --- Utilidades ---

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Asigna roles a la lista de jugadores según la configuración.
 */
export function assignRoles(players: Player[], config: GameConfig): Player[] {
  const n = players.length;
  const roles: Role[] = [];

  // Asesinos (fijados por config)
  for (let i = 0; i < config.killerCount; i++) roles.push('killer');

  // Policías (1 o 2 por config)
  for (let i = 0; i < config.copCount; i++) {
    if (roles.length < n) roles.push('cop');
  }

  // Doctor (si hay espacio para al menos 1)
  if (roles.length < n) roles.push('doctor');

  // Resto → pueblo
  while (roles.length < n) roles.push('town');

  const shuffledRoles = shuffle(roles);

  return players.map((p, i) => ({ ...p, role: shuffledRoles[i] }));
}

// --- Resolución del operativo encubierto ---

/**
 * Aplica las acciones del operativo y retorna el reporte de la ronda.
 * No muta el estado; devuelve los cambios como valores nuevos.
 */
export function resolveOperative(
  players: Player[],
  actions: OperativeActions,
  round: number
): { updatedPlayers: Player[]; report: RoundReport } {
  const { killTargetId, saveTargetId, inspectTargetId } = actions;

  let victim: string | null = null;
  let victimRole: Role | null = null;
  let saved = false;

  let updatedPlayers = players.map((p) => ({ ...p }));

  if (killTargetId) {
    const targetPlayer = updatedPlayers.find((p) => p.id === killTargetId);
    if (targetPlayer && targetPlayer.isAlive) {
      if (killTargetId === saveTargetId) {
        // El doctor salva al objetivo de los asesinos
        saved = true;
      } else {
        victim = targetPlayer.name;
        victimRole = targetPlayer.role;
        targetPlayer.isAlive = false;
        targetPlayer.isRevealed = true;
      }
    }
  }

  const inspectedRole: Role | null =
    inspectTargetId
      ? updatedPlayers.find((p) => p.id === inspectTargetId)?.role ?? null
      : null;

  const report: RoundReport = {
    round,
    victim,
    victimRole,
    saved,
    inspectedRole,
    expelled: null,
    expelledWasKiller: null,
  };

  return { updatedPlayers, report };
}

// --- Resolución de votación ---

/**
 * Cuenta los votos y determina quién es expulsado.
 * En caso de empate, no se expulsa a nadie.
 */
export function resolveVote(
  players: Player[],
  votes: Record<string, string>
): { updatedPlayers: Player[]; expelled: string | null; expelledWasKiller: boolean | null } {
  const tally: Record<string, number> = {};

  Object.values(votes).forEach((targetId) => {
    tally[targetId] = (tally[targetId] || 0) + 1;
  });

  if (Object.keys(tally).length === 0) {
    return { updatedPlayers: players, expelled: null, expelledWasKiller: null };
  }

  const maxVotes = Math.max(...Object.values(tally));
  const topCandidates = Object.entries(tally)
    .filter(([, count]) => count === maxVotes)
    .map(([id]) => id);

  // Empate → nadie expulsado
  if (topCandidates.length > 1) {
    return { updatedPlayers: players, expelled: null, expelledWasKiller: null };
  }

  const expelledId = topCandidates[0];
  const updatedPlayers = players.map((p) => {
    if (p.id === expelledId) {
      return { ...p, isAlive: false, isRevealed: true };
    }
    return p;
  });

  const expelledPlayer = updatedPlayers.find((p) => p.id === expelledId)!;

  return {
    updatedPlayers,
    expelled: expelledPlayer.name,
    expelledWasKiller: expelledPlayer.role === 'killer',
  };
}

// --- Condición de victoria ---

/**
 * Evalúa la condición de victoria tras cada eliminación.
 *
 * @param players        Lista de jugadores (con isAlive actualizado)
 * @param initialKillers Cantidad de asesinos con la que comenzó la partida
 *
 * Retorna:
 *  - 'town'    → el pueblo ganó (0 asesinos vivos)
 *  - 'killers' → los asesinos ganaron
 *  - null      → la partida continúa
 *
 * Regla de victoria para los asesinos:
 *  - Con 2+ asesinos iniciales: ganan cuando asesinosVivos >= restoVivos
 *  - Con 1 asesino inicial: ganan cuando asesinoVivo >= restoVivos
 *                           O cuando no queda ningún policía ni doctor vivo
 */
export function checkWinCondition(
  players: Player[],
  initialKillers: number
): 'killers' | 'town' | null {
  const alive = players.filter((p) => p.isAlive);
  const aliveKillers = alive.filter((p) => p.role === 'killer').length;
  const aliveTown   = alive.filter((p) => p.role !== 'killer').length;

  // El pueblo gana si no quedan asesinos
  if (aliveKillers === 0) return 'town';

  // Condición numérica (aplica siempre)
  if (aliveKillers >= aliveTown) return 'killers';

  // Condición extra solo para asesino solitario:
  // gana también si no quedan ni policías ni doctor
  if (initialKillers === 1) {
    const aliveSpecial = alive.filter(
      (p) => p.role === 'cop' || p.role === 'doctor'
    ).length;
    if (aliveSpecial === 0) return 'killers';
  }

  return null;
}

// --- Constructor de jugador ---

export function buildPlayer(id: string, name: string): Player {
  return {
    id,
    name,
    role: 'town',
    isAlive: true,
    isRevealed: false,
  };
}

/**
 * Genera el orden de pase del dispositivo una sola vez al inicio.
 * El orden fijo se mantiene durante toda la partida.
 */
export function generateFixedPassOrder(players: Player[]): string[] {
  return shuffle(players).map((p) => p.id);
}

// --- Balance inicial sugerido ---

export interface RoleBalance {
  killers: number;
  cops: number;
  doctor: number;
  town: number;
  total: number;
}

/**
 * Tabla de balance inicial razonable por cantidad de jugadores.
 * Basada en proporciones probadas en juegos de deducción social.
 *
 * Regla general:
 *  - 1 asesino cada 4-5 jugadores (máx 25%)
 *  - 1 policía siempre; 2 si hay 8+ jugadores
 *  - 1 doctor siempre
 *  - Resto: pueblo
 */
export function getRecommendedBalance(total: number): RoleBalance {
  // Tabla fija para rangos comunes
  const table: Record<number, Omit<RoleBalance, 'total'>> = {
    4:  { killers: 1, cops: 1, doctor: 1, town: 1 },
    5:  { killers: 1, cops: 1, doctor: 1, town: 2 },
    6:  { killers: 1, cops: 1, doctor: 1, town: 3 },
    7:  { killers: 2, cops: 1, doctor: 1, town: 3 },
    8:  { killers: 2, cops: 2, doctor: 1, town: 3 },
    9:  { killers: 2, cops: 2, doctor: 1, town: 4 },
    10: { killers: 2, cops: 2, doctor: 1, town: 5 },
    11: { killers: 3, cops: 2, doctor: 1, town: 5 },
    12: { killers: 3, cops: 2, doctor: 1, town: 6 },
    13: { killers: 3, cops: 2, doctor: 1, town: 7 },
    14: { killers: 3, cops: 2, doctor: 1, town: 8 },
    15: { killers: 3, cops: 2, doctor: 1, town: 9 },
    16: { killers: 4, cops: 2, doctor: 1, town: 9 },
    17: { killers: 4, cops: 2, doctor: 1, town: 10 },
    18: { killers: 4, cops: 2, doctor: 1, town: 11 },
    19: { killers: 5, cops: 2, doctor: 1, town: 11 },
    20: { killers: 5, cops: 2, doctor: 1, town: 12 },
  };

  // Para totales fuera del rango, calcular proporcionalmente
  if (table[total]) return { ...table[total], total };

  const killers = Math.max(1, Math.floor(total / 4));
  const cops = total >= 8 ? 2 : 1;
  const doctor = 1;
  const town = total - killers - cops - doctor;
  return { killers, cops, doctor, town: Math.max(0, town), total };
}

/**
 * Genera el orden de pasos del operativo desde la perspectiva
 * de control interno. Útil para validar fases.
 */
export function getOperativeSteps(state: GameState): {
  role: Player['role'];
  label: string;
  done: boolean;
}[] {
  const alivePlayers = state.players.filter((p) => p.isAlive);
  const hasKiller = alivePlayers.some((p) => p.role === 'killer');
  const hasDoctor = alivePlayers.some((p) => p.role === 'doctor');
  const hasCop = alivePlayers.some((p) => p.role === 'cop');

  return [
    {
      role: 'killer' as const,
      label: 'Asesinos',
      done: state.operativeActions.killTargetId !== null,
    },
    {
      role: 'doctor' as const,
      label: 'Doctor',
      done: state.operativeActions.saveTargetId !== null || !hasDoctor,
    },
    {
      role: 'cop' as const,
      label: 'Policía',
      done: state.operativeActions.inspectTargetId !== null || !hasCop,
    },
  ].filter((step) => {
    if (step.role === 'killer') return hasKiller;
    if (step.role === 'doctor') return hasDoctor;
    if (step.role === 'cop') return hasCop;
    return false;
  });
}
