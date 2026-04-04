// app/api/multi/action/route.ts
// Recibe la accion del operativo de cada jugador.
// Cuando todos los vivos enviaron accion, resuelve automaticamente
// y avanza a la fase de news.

import { NextRequest, NextResponse } from 'next/server';
import {
  getOperativeProposal,
  getRoom,
  getSecret,
  saveOperativeProposal,
  saveRoom,
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
import type { OperativeProposal, PlayerOperativeAction, PlayerSecret } from '@/lib/multi/types';

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

    const room = await getRoom(roomId);
    if (!room || !room.game) {
      return NextResponse.json({ error: 'Sala no encontrada.' }, { status: 404 });
    }

    if (room.game.phase !== 'operative') {
      return NextResponse.json({ error: 'No es la fase operativa.' }, { status: 409 });
    }

    const player = room.players.find((p) => p.deviceId === deviceId);
    if (!player || !player.isAlive) {
      return NextResponse.json({ error: 'Jugador no valido o eliminado.' }, { status: 403 });
    }

    if (room.game.pendingActions[deviceId] !== null) {
      return NextResponse.json({ error: 'Tu accion ya fue confirmada.' }, { status: 409 });
    }

    const secret = await getSecret(roomId, deviceId);
    if (!secret) {
      return NextResponse.json({ error: 'No se pudo recuperar tu rol secreto.' }, { status: 403 });
    }

    const alivePlayers = room.players.filter((p) => p.isAlive);
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
        return NextResponse.json({ error: 'Objetivo de asesinato invalido.' }, { status: 400 });
      }
    } else if (secret.role === 'cop') {
      if (action.type !== 'inspect' || !targetId || !hasLiveTarget || targetId === deviceId) {
        return NextResponse.json({ error: 'Objetivo de investigacion invalido.' }, { status: 400 });
      }
    } else if (secret.role === 'doctor') {
      if (action.type !== 'save' || !targetId || !hasLiveTarget) {
        return NextResponse.json({ error: 'Objetivo de proteccion invalido.' }, { status: 400 });
      }
    } else if (secret.role === 'town') {
      if (action.type !== 'neutral') {
        return NextResponse.json({ error: 'Accion neutral invalida.' }, { status: 400 });
      }
    }

    let updatedPendingActions = {
      ...room.game.pendingActions,
    };

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
          if (!currentProposal || currentProposal.round !== room.game?.round) {
            return null;
          }
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
      updatedPendingActions = {
        ...updatedPendingActions,
        [deviceId]: {
          ...action,
          submittedAt: Date.now(),
        },
      };
    }

    const updatedGame = {
      ...room.game,
      pendingActions: updatedPendingActions,
    };

    let updatedRoom = { ...room, game: updatedGame, updatedAt: Date.now() };

    if (allActionsSubmitted(updatedGame, room.players)) {
      const secrets: Record<string, PlayerSecret> = {};
      for (const alivePlayer of room.players.filter((p) => p.isAlive)) {
        const currentSecret = await getSecret(roomId, alivePlayer.deviceId);
        if (currentSecret) {
          secrets[alivePlayer.deviceId] = currentSecret;
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

      updatedRoom = {
        ...updatedRoom,
        players: updatedPlayers,
        game: {
          ...updatedGame,
          phase: 'news',
          pendingActions: resetPendingActions(updatedPlayers),
          reports: [...room.game.reports, report],
          winnerFaction: winner,
          isOver: winner !== null,
        },
        updatedAt: Date.now(),
      };
    }

    await saveRoom(updatedRoom);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[multi/action]', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
