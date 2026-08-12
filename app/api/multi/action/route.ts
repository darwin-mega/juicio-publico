import { NextRequest, NextResponse } from 'next/server';
import {
  getOperativeProposal,
  getRoom,
  getSecret,
  saveOperativeProposal,
  saveRoom,
  withRoomLock,
} from '@/lib/multi/redis';
import {
  allActionsSubmitted,
  checkMultiWinCondition,
  deriveTeamOperativeSelection,
  getAliveTeamMemberIds,
  getCoordinatedTeamKey,
  isTeamSelectionConfirmed,
  resetPendingActions,
  resolveMultiOperative,
} from '@/lib/multi/gameLogic';
import type { OperativeProposal, PlayerSecret } from '@/lib/multi/types';
import { authenticatePlayer } from '@/lib/multi/auth';
import { submitActionSchema } from '@/lib/multi/validation';
import { parseJsonBody } from '@/lib/multi/request';
import { enforceRateLimit } from '@/lib/multi/rateLimit';
import { routeError } from '@/lib/multi/errors';

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseJsonBody(req, submitActionSchema);
    if (!parsed.ok) return parsed.response;
    const { roomId, action } = parsed.data;
    const deviceId = req.headers.get('X-Device-Id');
    const limited = await enforceRateLimit(req, 'command', roomId);
    if (limited) return limited;
    if (!deviceId) {
      return NextResponse.json({ error: 'Identidad de dispositivo requerida.' }, { status: 400 });
    }

    return withRoomLock(roomId, async () => {
      const room = await getRoom(roomId);
      if (!room || !room.game) {
        return NextResponse.json({ error: 'Sala no encontrada.' }, { status: 404 });
      }
      if (!(await authenticatePlayer(req, roomId, room))) {
        return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
      }
      if (room.game.phase !== 'operative') {
        return NextResponse.json({ error: 'No es la fase operativa.' }, { status: 409 });
      }

      const player = room.players.find((candidate) => candidate.deviceId === deviceId);
      if (!player || !player.isAlive) {
        return NextResponse.json({ error: 'Jugador no válido o eliminado.' }, { status: 403 });
      }
      if (room.game.pendingActions[deviceId] !== null) {
        return NextResponse.json({ error: 'Tu acción ya fue confirmada.' }, { status: 409 });
      }

      const secret = await getSecret(roomId, deviceId);
      if (!secret) {
        return NextResponse.json({ error: 'No se pudo recuperar tu rol secreto.' }, { status: 403 });
      }

      const alivePlayerIds = new Set(
        room.players.filter((candidate) => candidate.isAlive).map((candidate) => candidate.deviceId)
      );
      const targetId = action.targetId;
      const hasLiveTarget = targetId !== null && alivePlayerIds.has(targetId);

      if (secret.role === 'killer') {
        if (action.type !== 'kill' || !targetId || !hasLiveTarget || targetId === deviceId || secret.teammateIds.includes(targetId)) {
          return NextResponse.json({ error: 'Objetivo de asesinato inválido.' }, { status: 400 });
        }
      } else if (secret.role === 'cop') {
        if (action.type !== 'inspect' || !targetId || !hasLiveTarget || targetId === deviceId) {
          return NextResponse.json({ error: 'Objetivo de investigación inválido.' }, { status: 400 });
        }
      } else if (secret.role === 'doctor') {
        if (action.type !== 'save' || !targetId || !hasLiveTarget) {
          return NextResponse.json({ error: 'Objetivo de protección inválido.' }, { status: 400 });
        }
      } else if (action.type !== 'neutral') {
        return NextResponse.json({ error: 'Acción neutral inválida.' }, { status: 400 });
      }

      const updatedPendingActions = { ...room.game.pendingActions };
      const coordinatedTeamKey = getCoordinatedTeamKey(secret.role);
      const aliveTeamMemberIds = coordinatedTeamKey
        ? getAliveTeamMemberIds(secret, room.players)
        : [deviceId];
      const usesTeamSync = coordinatedTeamKey !== null && aliveTeamMemberIds.length > 1;

      if (usesTeamSync && action.targetId) {
        const proposal: OperativeProposal = {
          deviceId,
          actionType: action.type as 'kill' | 'inspect',
          targetPlayerId: action.targetId,
          submittedAt: Date.now(),
          round: room.game.round,
        };
        await saveOperativeProposal(roomId, deviceId, proposal);

        const proposals = (await Promise.all(
          aliveTeamMemberIds.map(async (memberId) => {
            const currentProposal = await getOperativeProposal(roomId, memberId);
            if (!currentProposal || currentProposal.round !== room.game?.round) return null;
            return currentProposal;
          })
        )).filter((value): value is OperativeProposal => value !== null);
        const sharedSelection = deriveTeamOperativeSelection(coordinatedTeamKey, proposals);

        if (isTeamSelectionConfirmed(sharedSelection, aliveTeamMemberIds) && sharedSelection?.targetPlayerId) {
          const submittedAt = Date.now();
          for (const memberId of aliveTeamMemberIds) {
            updatedPendingActions[memberId] = {
              type: sharedSelection.actionType,
              targetId: sharedSelection.targetPlayerId,
              submittedAt,
            };
          }
        }
      } else {
        updatedPendingActions[deviceId] = { ...action, submittedAt: Date.now() };
      }

      const updatedGame = { ...room.game, pendingActions: updatedPendingActions };
      let updatedRoom = { ...room, game: updatedGame, updatedAt: Date.now() };

      if (allActionsSubmitted(updatedGame, room.players)) {
        const secrets: Record<string, PlayerSecret> = {};
        for (const alivePlayer of room.players.filter((candidate) => candidate.isAlive)) {
          const currentSecret = await getSecret(roomId, alivePlayer.deviceId);
          if (currentSecret) secrets[alivePlayer.deviceId] = currentSecret;
        }

        const operativeResult = resolveMultiOperative(
          room.players,
          secrets,
          updatedPendingActions,
          room.game.round,
          room.config.killerCount
        );
        const winner = operativeResult.winnerFaction
          ?? checkMultiWinCondition(operativeResult.updatedPlayers, secrets, room.config.killerCount);
        updatedRoom = {
          ...updatedRoom,
          players: operativeResult.updatedPlayers,
          game: {
            ...updatedGame,
            phase: 'news',
            pendingActions: resetPendingActions(operativeResult.updatedPlayers),
            reports: [...room.game.reports, operativeResult.report],
            winnerFaction: winner,
            isOver: winner !== null,
          },
          updatedAt: Date.now(),
        };
      }

      await saveRoom(updatedRoom);
      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    return routeError('[multi/action]', error);
  }
}
