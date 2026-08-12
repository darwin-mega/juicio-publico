// app/api/multi/action/route.ts
// Recibe la accion del operativo de cada jugador. Cuando todos los vivos
// enviaron accion, resuelve automaticamente y avanza a la fase de news.

import { NextRequest, NextResponse } from 'next/server';
import {
  getOperativeProposal,
  getSecret,
  mutateRoom,
  saveOperativeProposal,
} from '@/lib/multi/redis';
import {
  allActionsSubmitted,
  checkMultiWinCondition,
  deriveTeamOperativeSelection,
  getAliveTeamMemberIds,
  getCoordinatedTeamKey,
  isPlayerActiveAlive,
  isTeamSelectionConfirmed,
  resetPendingActions,
  resolveMultiOperative,
} from '@/lib/multi/gameLogic';
import { requireMultiSession } from '@/lib/multi/session';
import {
  applyProgressIfGameOver,
  buildOperativeProgressEvents,
} from '@/lib/multi/progression';
import type { OperativeProposal, PlayerOperativeAction, PlayerSecret } from '@/lib/multi/types';

type ActionFailure = { error: string; status: number };

export async function POST(req: NextRequest) {
  try {
    const { roomId, action } = await req.json() as {
      roomId: string;
      action: Omit<PlayerOperativeAction, 'submittedAt'>;
    };
    const deviceId = req.headers.get('X-Device-Id');

    if (!roomId || !deviceId || !action) {
      return NextResponse.json({ error: 'Faltan datos.' }, { status: 400 });
    }

    const session = requireMultiSession(req, roomId, deviceId);
    if (session instanceof NextResponse) return session;

    const result = await mutateRoom<true | ActionFailure>(roomId, async (room) => {
      if (!room.game) {
        return { error: 'Sala no encontrada.', status: 404 };
      }

      if (room.game.phase !== 'operative') {
        return { error: 'No es la fase operativa.', status: 409 };
      }

      const player = room.players.find((p) => p.deviceId === deviceId);
      if (!player || !isPlayerActiveAlive(player)) {
        return { error: 'Jugador no valido o eliminado.', status: 403 };
      }

      if (room.game.pendingActions[deviceId] !== null) {
        return { error: 'Tu accion ya fue confirmada.', status: 409 };
      }

      const secret = await getSecret(roomId, deviceId);
      if (!secret) {
        return { error: 'No se pudo recuperar tu rol secreto.', status: 403 };
      }

      const alivePlayers = room.players.filter(isPlayerActiveAlive);
      const alivePlayerIds = new Set(alivePlayers.map((p) => p.deviceId));
      const targetId = action.targetId;
      const hasLiveTarget = targetId != null && alivePlayerIds.has(targetId);

      if (secret.role === 'killer') {
        if (
          action.type !== 'kill' ||
          !targetId ||
          !hasLiveTarget ||
          targetId === deviceId ||
          secret.teammateIds.includes(targetId)
        ) {
          return { error: 'Objetivo de asesinato invalido.', status: 400 };
        }
      } else if (secret.role === 'cop') {
        if (action.type !== 'inspect' || !targetId || !hasLiveTarget || targetId === deviceId) {
          return { error: 'Objetivo de investigacion invalido.', status: 400 };
        }
      } else if (secret.role === 'doctor') {
        if (action.type !== 'save' || !targetId || !hasLiveTarget) {
          return { error: 'Objetivo de proteccion invalido.', status: 400 };
        }
      } else if (secret.role === 'town') {
        if (action.type !== 'neutral') {
          return { error: 'Accion neutral invalida.', status: 400 };
        }
      }

      const updatedPendingActions = { ...room.game.pendingActions };
      const coordinatedTeamKey = getCoordinatedTeamKey(secret.role);
      const aliveTeamMemberIds = coordinatedTeamKey
        ? getAliveTeamMemberIds(secret, room.players)
        : [deviceId];
      const pendingTeamMemberIds = aliveTeamMemberIds.filter((memberId) =>
        memberId === deviceId || room.game?.pendingActions[memberId] === null
      );
      const usesTeamSync = coordinatedTeamKey !== null && pendingTeamMemberIds.length > 1;

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
          pendingTeamMemberIds.map(async (memberId) => {
            const currentProposal = await getOperativeProposal(roomId, memberId);
            if (!currentProposal || currentProposal.round !== room.game?.round) {
              return null;
            }
            return currentProposal;
          })
        )).filter((value): value is OperativeProposal => value !== null);

        const sharedSelection = deriveTeamOperativeSelection(coordinatedTeamKey, proposals);

        if (isTeamSelectionConfirmed(sharedSelection, pendingTeamMemberIds) && sharedSelection?.targetPlayerId) {
          const submittedAt = Date.now();
          for (const memberId of pendingTeamMemberIds) {
            updatedPendingActions[memberId] = {
              type: sharedSelection.actionType,
              targetId: sharedSelection.targetPlayerId,
              submittedAt,
            };
          }
        }
      } else {
        updatedPendingActions[deviceId] = {
          ...action,
          submittedAt: Date.now(),
        };
      }

      room.game.pendingActions = updatedPendingActions;

      if (allActionsSubmitted(room.game, room.players)) {
        const secrets: Record<string, PlayerSecret> = {};
        for (const currentPlayer of room.players) {
          const currentSecret = await getSecret(roomId, currentPlayer.deviceId);
          if (currentSecret) {
            secrets[currentPlayer.deviceId] = currentSecret;
          }
        }

        const { updatedPlayers, report, winnerFaction } = resolveMultiOperative(
          room.players,
          secrets,
          updatedPendingActions,
          room.game.round,
          room.config.killerCount
        );

        const winner = winnerFaction ?? checkMultiWinCondition(updatedPlayers, secrets, room.config.killerCount);
        const killedTargetId = Object.entries(updatedPendingActions).find(([, currentAction]) =>
          currentAction?.type === 'kill' &&
          currentAction.targetId &&
          room.players.find((player) => player.deviceId === currentAction.targetId)?.isAlive &&
          !updatedPlayers.find((player) => player.deviceId === currentAction.targetId)?.isAlive
        )?.[1]?.targetId ?? null;
        const savedTargetId = Object.entries(updatedPendingActions).find(([, currentAction]) =>
          currentAction?.type === 'save' &&
          currentAction.targetId &&
          Object.values(updatedPendingActions).some((candidateAction) =>
            candidateAction?.type === 'kill' &&
            candidateAction.targetId === currentAction.targetId
          )
        )?.[1]?.targetId ?? null;
        const progressEvents = buildOperativeProgressEvents(
          room.game.round,
          updatedPendingActions,
          secrets,
          killedTargetId,
          savedTargetId
        );

        room.players = updatedPlayers;
        room.game.phase = 'news';
        room.game.pendingActions = resetPendingActions(updatedPlayers);
        room.game.reports = [...room.game.reports, report];
        room.game.progressEvents = [...(room.game.progressEvents ?? []), ...progressEvents];
        room.game.winnerFaction = winner;
        room.game.isOver = winner !== null;

        await applyProgressIfGameOver(room, secrets);
      }

      room.updatedAt = Date.now();
      return true;
    });

    if (!result) {
      return NextResponse.json({ error: 'Sala no encontrada.' }, { status: 404 });
    }

    if (result !== true && 'error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[multi/action]', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
