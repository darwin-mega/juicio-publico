// ============================================================
// lib/multi/gameLogic.ts
// Lógica de juego para el modo multidispositivo.
//
// Porta las reglas de lib/game/rules.ts pero adaptadas para
// trabajar con MultiPlayer y DeviceId en lugar de Player e id.
// Se ejecuta SIEMPRE en el servidor (API routes), nunca en cliente.
// ============================================================

import type {
  CoordinatedTeamKey,
  OperativeProposal,
  MultiPlayer,
  MultiGameState,
  PlayerSecret,
  PlayerOperativeAction,
  TeamOperativeSelection,
  DeviceId,
} from './types';
import type { Role, RoundReport } from '@/lib/game/state';
import { assignRoles, buildPlayer } from '@/lib/game/rules';

// --- Asignación de roles en modo multi ---

/**
 * Asigna roles a los jugadores y genera los secretos.
 * Retorna los secretos por deviceId (para guardar separados en Redis).
 */
export function assignMultiRoles(
  players: MultiPlayer[],
  config: { killerCount: number; copCount: number }
): Record<DeviceId, PlayerSecret> {
  // Convertimos a Player[] temporalmente para reusar la lógica de assignRoles
  const fakePlayers = players.map((p) =>
    buildPlayer(p.deviceId, p.name)
  );

  const assigned = assignRoles(fakePlayers, {
    mode: 'individual',
    playerCount: players.length,
    killerCount: config.killerCount,
    copCount: config.copCount,
    trialDurationSeconds: 120,
  });

  // Agrupar por rol para saber quiénes son compañeros
  const killerIds = assigned.filter((p) => p.role === 'killer').map((p) => p.id);
  const copIds    = assigned.filter((p) => p.role === 'cop').map((p) => p.id);

  const secrets: Record<DeviceId, PlayerSecret> = {};

  for (const p of assigned) {
    let teammateIds: DeviceId[] = [];
    if (p.role === 'killer') {
      teammateIds = killerIds.filter((id) => id !== p.id);
    } else if (p.role === 'cop') {
      teammateIds = copIds.filter((id) => id !== p.id);
    }

    secrets[p.id] = {
      deviceId: p.id,
      role: p.role as Role,
      teammateIds,
    };
  }

  return secrets;
}

// --- Inicialización del estado de juego ---

export function createInitialGameState(players: MultiPlayer[]): MultiGameState {
  const pendingActions: Record<DeviceId, PlayerOperativeAction | null> = {};
  for (const p of players.filter((p) => p.isAlive)) {
    pendingActions[p.deviceId] = null;
  }

  return {
    phase: 'reveal',
    round: 1,
    pendingActions,
    votes: {},
    reports: [],
    winnerFaction: null,
    isOver: false,
    trialStartedAt: null,
  };
}

export function getCoordinatedTeamKey(role: Role): CoordinatedTeamKey | null {
  if (role === 'killer') return 'killers';
  if (role === 'cop') return 'cops';
  return null;
}

export function getAliveTeamMemberIds(
  secret: PlayerSecret,
  players: MultiPlayer[]
): DeviceId[] {
  const aliveIds = new Set(players.filter((p) => p.isAlive).map((p) => p.deviceId));
  return [secret.deviceId, ...secret.teammateIds].filter((deviceId) => aliveIds.has(deviceId));
}

export function deriveTeamOperativeSelection(
  team: CoordinatedTeamKey,
  proposals: OperativeProposal[]
): TeamOperativeSelection | null {
  if (proposals.length === 0) {
    return null;
  }

  const latestProposal = proposals.reduce((latest, current) =>
    current.submittedAt >= latest.submittedAt ? current : latest
  );

  const confirmedBy = Array.from(new Set(
    proposals
      .filter((proposal) =>
        proposal.actionType === latestProposal.actionType &&
        proposal.targetPlayerId === latestProposal.targetPlayerId
      )
      .map((proposal) => proposal.deviceId)
  ));

  return {
    team,
    actionType: latestProposal.actionType,
    targetPlayerId: latestProposal.targetPlayerId,
    confirmedBy,
    updatedAt: latestProposal.submittedAt,
  };
}

export function isTeamSelectionConfirmed(
  selection: TeamOperativeSelection | null,
  teamMemberIds: DeviceId[]
): boolean {
  if (!selection || teamMemberIds.length === 0) {
    return false;
  }

  return teamMemberIds.every((deviceId) => selection.confirmedBy.includes(deviceId));
}

// --- Resolución del operativo ---

/**
 * Determina si todos los jugadores vivos enviaron su acción.
 */
export function allActionsSubmitted(game: MultiGameState, players: MultiPlayer[]): boolean {
  const alivePlayers = players.filter((p) => p.isAlive);
  return alivePlayers.every((p) => game.pendingActions[p.deviceId] !== null);
}

/**
 * Resuelve las acciones del operativo y genera el reporte.
 * Análogo a resolveOperative de lib/game/rules.ts.
 */
export function resolveMultiOperative(
  players: MultiPlayer[],
  secrets: Record<DeviceId, PlayerSecret>,
  pendingActions: Record<DeviceId, PlayerOperativeAction | null>,
  round: number
): {
  updatedPlayers: MultiPlayer[];
  report: RoundReport;
  winnerFaction: 'killers' | 'town' | null;
} {
  // Encontrar acciones reales
  let killTargetId: string | null = null;
  let saveTargetId: string | null = null;
  let inspectTargetId: string | null = null;

  for (const [deviceId, action] of Object.entries(pendingActions)) {
    if (!action) continue;
    const secret = secrets[deviceId];
    if (!secret) continue;

    if (secret.role === 'killer' && action.type === 'kill') {
      killTargetId = action.targetId;
    } else if (secret.role === 'doctor' && action.type === 'save') {
      saveTargetId = action.targetId;
    } else if (secret.role === 'cop' && action.type === 'inspect') {
      // Si hay múltiples cops, tomamos el último (o podríamos hacer mayoría)
      inspectTargetId = action.targetId;
    }
  }

  let victim: string | null = null;
  let victimRole: Role | null = null;
  let saved = false;

  const updatedPlayers = players.map((p) => ({ ...p }));

  if (killTargetId) {
    const target = updatedPlayers.find((p) => p.deviceId === killTargetId);
    if (target && target.isAlive) {
      if (killTargetId === saveTargetId) {
        saved = true;
      } else {
        victim = target.name;
        victimRole = secrets[target.deviceId]?.role ?? null;
        target.isAlive = false;
        target.isRevealed = true;
      }
    }
  }

  const inspectedRole: Role | null = inspectTargetId
    ? secrets[inspectTargetId]?.role ?? null
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

  const winnerFaction = checkMultiWinCondition(updatedPlayers, secrets);

  return { updatedPlayers, report, winnerFaction };
}

// --- Resolución de votación ---

export function resolveMultiVote(
  players: MultiPlayer[],
  votes: Record<DeviceId, DeviceId>,
  secrets: Record<DeviceId, PlayerSecret>
): {
  updatedPlayers: MultiPlayer[];
  expelled: string | null;
  expelledWasKiller: boolean | null;
} {
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

  if (topCandidates.length > 1) {
    return { updatedPlayers: players, expelled: null, expelledWasKiller: null };
  }

  const expelledId = topCandidates[0];
  const updatedPlayers = players.map((p) =>
    p.deviceId === expelledId
      ? { ...p, isAlive: false, isRevealed: true }
      : p
  );

  const expelled = updatedPlayers.find((p) => p.deviceId === expelledId);
  const expelledWasKiller = expelled
    ? secrets[expelled.deviceId]?.role === 'killer'
    : null;

  return {
    updatedPlayers,
    expelled: expelled?.name ?? null,
    expelledWasKiller,
  };
}

// --- Condición de victoria ---

export function checkMultiWinCondition(
  players: MultiPlayer[],
  secrets: Record<DeviceId, PlayerSecret>
): 'killers' | 'town' | null {
  const alive = players.filter((p) => p.isAlive);
  const aliveKillers = alive.filter((p) => secrets[p.deviceId]?.role === 'killer').length;
  const aliveTown    = alive.filter((p) => secrets[p.deviceId]?.role !== 'killer').length;

  if (aliveKillers === 0) return 'town';
  if (aliveKillers >= aliveTown) return 'killers';

  const aliveSpecial = alive.filter((p) => {
    const role = secrets[p.deviceId]?.role;
    return role === 'cop' || role === 'doctor';
  }).length;
  if (aliveSpecial === 0) return 'killers';

  return null;
}

// --- Avance de fases ---

/**
 * Retorna la siguiente fase de juego tras la actual.
 */
export function getNextMultiPhase(
  current: MultiGameState['phase']
): MultiGameState['phase'] {
  const order: MultiGameState['phase'][] = [
    'operative', 'news', 'trial', 'vote', 'resolution',
  ];
  const idx = order.indexOf(current);
  if (idx === -1 || idx === order.length - 1) return 'operative';
  return order[idx + 1];
}

/**
 * Reinicia las acciones pendientes para una nueva ronda.
 */
export function resetPendingActions(
  players: MultiPlayer[]
): Record<DeviceId, PlayerOperativeAction | null> {
  const result: Record<DeviceId, PlayerOperativeAction | null> = {};
  for (const p of players.filter((p) => p.isAlive)) {
    result[p.deviceId] = null;
  }
  return result;
}

/**
 * Genera un código de sala de 6 caracteres.
 */
export function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
