import type { ProgressEvent, ProgressGameResult } from '@/lib/progression/types';
import { applyGameProgress } from '@/lib/progression/store';
import type { MultiRoomState, PlayerOperativeAction, PlayerSecret } from './types';

export function buildOperativeProgressEvents(
  round: number,
  actions: Record<string, PlayerOperativeAction | null>,
  secrets: Record<string, PlayerSecret>,
  killedTargetId: string | null,
  savedTargetId: string | null
): ProgressEvent[] {
  return Object.entries(actions).flatMap(([actorId, action]) => {
    if (!action) return [];

    const actorSecret = secrets[actorId];
    if (!actorSecret) return [];

    const targetRole = action.targetId ? secrets[action.targetId]?.role ?? null : null;
    let success = false;

    if (actorSecret.role === 'killer' && action.type === 'kill') {
      success = action.targetId !== null && action.targetId === killedTargetId;
    } else if (actorSecret.role === 'doctor' && action.type === 'save') {
      success = action.targetId !== null && action.targetId === savedTargetId;
    } else if (actorSecret.role === 'cop' && action.type === 'inspect') {
      success = targetRole === 'killer';
    }

    return [{
      type: 'operative_action',
      round,
      actorId,
      actorRole: actorSecret.role,
      targetId: action.targetId,
      targetRole,
      actionType: action.type,
      success,
    }];
  });
}

export function buildVoteProgressEvents(
  round: number,
  votes: Record<string, string>,
  secrets: Record<string, PlayerSecret>
): ProgressEvent[] {
  return Object.entries(votes).flatMap(([actorId, targetId]) => {
    const actorSecret = secrets[actorId];
    const targetSecret = secrets[targetId];
    if (!actorSecret || !targetSecret) return [];

    return [{
      type: 'vote',
      round,
      actorId,
      actorRole: actorSecret.role,
      targetId,
      targetRole: targetSecret.role,
      success: targetSecret.role === 'killer',
    }];
  });
}

export async function applyProgressIfGameOver(
  room: MultiRoomState,
  secrets: Record<string, PlayerSecret>
) {
  if (!room.game?.isOver || !room.game.winnerFaction || room.game.progressAppliedAt) {
    return null;
  }

  const result: ProgressGameResult = {
    gameId: `${room.roomId}:${room.createdAt}`,
    completedAt: Date.now(),
    winnerFaction: room.game.winnerFaction,
    players: room.players.map((player) => ({
      playerId: player.accountId ?? player.deviceId,
      displayName: player.accountDisplayName ?? player.name,
      role: secrets[player.deviceId]?.role ?? 'town',
      isAliveAtEnd: player.isAlive,
    })),
    events: (room.game.progressEvents ?? []).map((event) => {
      const actor = room.players.find((player) => player.deviceId === event.actorId);
      const target = event.targetId
        ? room.players.find((player) => player.deviceId === event.targetId)
        : null;

      return {
        ...event,
        actorId: actor?.accountId ?? event.actorId,
        targetId: target?.accountId ?? event.targetId,
      };
    }),
  };

  room.status = 'finished';
  try {
    const applied = await applyGameProgress(result);
    room.game.progressAppliedAt = Date.now();
    return applied;
  } catch (error) {
    console.error('[multi/progression] La partida terminó, pero no se pudo guardar el progreso.', error);
    return null;
  }
}
