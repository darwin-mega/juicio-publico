import { NextRequest, NextResponse } from 'next/server';
import { deleteOperativeProposal, getRoom, getSecret, saveRoom, withRoomLock } from '@/lib/multi/redis';
import {
  allActionsSubmitted,
  checkMultiWinCondition,
  isPlayerActiveAlive,
  resetPendingActions,
  resolveMultiOperative,
  resolveMultiVote,
} from '@/lib/multi/gameLogic';
import { applyProgressIfGameOver, buildOperativeProgressEvents, buildVoteProgressEvents } from '@/lib/multi/progression';
import type { MultiRoomState, PlayerSecret } from '@/lib/multi/types';
import { authenticatePlayer } from '@/lib/multi/auth';
import { playerControlSchema } from '@/lib/multi/validation';
import { parseJsonBody } from '@/lib/multi/request';
import { enforceRateLimit } from '@/lib/multi/rateLimit';
import { routeError } from '@/lib/multi/errors';

async function loadSecrets(roomId: string, room: MultiRoomState) {
  const secrets: Record<string, PlayerSecret> = {};
  for (const player of room.players) {
    const secret = await getSecret(roomId, player.deviceId);
    if (secret) secrets[player.deviceId] = secret;
  }
  return secrets;
}

async function finishOperativeIfReady(roomId: string, room: MultiRoomState) {
  if (!room.game || !allActionsSubmitted(room.game, room.players)) return;

  const secrets = await loadSecrets(roomId, room);
  const pendingActions = room.game.pendingActions;
  const { updatedPlayers, report, winnerFaction } = resolveMultiOperative(
    room.players,
    secrets,
    pendingActions,
    room.game.round,
    room.config.killerCount
  );

  const winner = winnerFaction ?? checkMultiWinCondition(updatedPlayers, secrets, room.config.killerCount);
  const killedTargetId = Object.entries(pendingActions).find(([, currentAction]) =>
    currentAction?.type === 'kill' &&
    currentAction.targetId &&
    room.players.find((player) => player.deviceId === currentAction.targetId)?.isAlive &&
    !updatedPlayers.find((player) => player.deviceId === currentAction.targetId)?.isAlive
  )?.[1]?.targetId ?? null;
  const savedTargetId = Object.entries(pendingActions).find(([, currentAction]) =>
    currentAction?.type === 'save' &&
    currentAction.targetId &&
    Object.values(pendingActions).some((candidateAction) =>
      candidateAction?.type === 'kill' &&
      candidateAction.targetId === currentAction.targetId
    )
  )?.[1]?.targetId ?? null;
  const progressEvents = buildOperativeProgressEvents(
    room.game.round,
    pendingActions,
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

async function finishVoteIfReady(roomId: string, room: MultiRoomState) {
  if (!room.game) return;

  const activeAlivePlayers = room.players.filter(isPlayerActiveAlive);
  const skippedVotes = room.game.skippedVotes ?? {};
  const allVoted = activeAlivePlayers.every((player) =>
    room.game?.votes[player.deviceId] !== undefined || skippedVotes[player.deviceId] !== undefined
  );
  if (!allVoted) return;

  const secrets = await loadSecrets(roomId, room);
  const { updatedPlayers, expelled, expelledWasKiller } =
    resolveMultiVote(room.players, room.game.votes, secrets);

  room.players = updatedPlayers;

  const winner = checkMultiWinCondition(updatedPlayers, secrets, room.config.killerCount);
  const progressEvents = buildVoteProgressEvents(room.game.round, room.game.votes, secrets);
  const lastReport = room.game.reports[room.game.reports.length - 1];
  room.game.reports = lastReport
    ? [
        ...room.game.reports.slice(0, -1),
        { ...lastReport, expelled, expelledWasKiller },
      ]
    : room.game.reports;

  room.game.phase = 'resolution';
  room.game.progressEvents = [...(room.game.progressEvents ?? []), ...progressEvents];
  room.game.winnerFaction = winner;
  room.game.isOver = winner !== null;

  await applyProgressIfGameOver(room, secrets);
}

async function applyKick(roomId: string, room: MultiRoomState, targetDeviceId: string) {
  const target = room.players.find((player) => player.deviceId === targetDeviceId);
  if (!target) return;

  target.status = 'out';
  target.isAlive = false;
  target.isRevealed = true;
  target.readyForOperative = true;

  if (room.game) {
    room.game.pendingActions[targetDeviceId] = {
      type: 'neutral',
      targetId: null,
      submittedAt: Date.now(),
    };
    room.game.skippedVotes = {
      ...(room.game.skippedVotes ?? {}),
      [targetDeviceId]: Date.now(),
    };
    delete room.game.votes[targetDeviceId];
    room.game.votes = Object.fromEntries(
      Object.entries(room.game.votes).filter(([, votedId]) => votedId !== targetDeviceId)
    );
    await deleteOperativeProposal(roomId, targetDeviceId);

    const secrets = await loadSecrets(roomId, room);
    const winner = checkMultiWinCondition(room.players, secrets, room.config.killerCount);
    room.game.winnerFaction = winner;
    room.game.isOver = winner !== null;
    await applyProgressIfGameOver(room, secrets);

    if (!room.game.isOver && room.game.phase === 'reveal') {
      const allReady = room.players.filter(isPlayerActiveAlive).every((player) => player.readyForOperative);
      if (allReady) room.game.phase = 'operative';
    } else if (!room.game.isOver && room.game.phase === 'operative') {
      await finishOperativeIfReady(roomId, room);
    } else if (!room.game.isOver && room.game.phase === 'vote') {
      await finishVoteIfReady(roomId, room);
    }
  }
}

async function applyOmit(roomId: string, room: MultiRoomState, targetDeviceId: string) {
  const target = room.players.find((player) => player.deviceId === targetDeviceId);
  if (!target || !room.game || !isPlayerActiveAlive(target)) return;

  if (room.game.phase === 'reveal') {
    target.readyForOperative = true;
    const allReady = room.players.filter(isPlayerActiveAlive).every((player) => player.readyForOperative);
    if (allReady) room.game.phase = 'operative';
    return;
  }

  if (room.game.phase === 'operative') {
    room.game.pendingActions[targetDeviceId] = {
      type: 'neutral',
      targetId: null,
      submittedAt: Date.now(),
    };
    await deleteOperativeProposal(roomId, targetDeviceId);
    await finishOperativeIfReady(roomId, room);
    return;
  }

  if (room.game.phase === 'vote') {
    room.game.skippedVotes = {
      ...(room.game.skippedVotes ?? {}),
      [targetDeviceId]: Date.now(),
    };
    await finishVoteIfReady(roomId, room);
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseJsonBody(req, playerControlSchema);
    if (!parsed.ok) return parsed.response;
    const { roomId, targetDeviceId, action } = parsed.data;
    const deviceId = req.headers.get('X-Device-Id');
    const limited = await enforceRateLimit(req, 'command', roomId);
    if (limited) return limited;
    if (!deviceId) {
      return NextResponse.json({ error: 'Identidad de dispositivo requerida.' }, { status: 400 });
    }

    return withRoomLock(roomId, async () => {
      const room = await getRoom(roomId);
      if (!room || !room.game) {
        return NextResponse.json({ error: 'Sala o juego no encontrado.' }, { status: 404 });
      }
      if (!(await authenticatePlayer(req, roomId, room))) {
        return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
      }
      if (!room.game) {
        return NextResponse.json({ error: 'Sala o juego no encontrado.' }, { status: 404 });
      }

      if (room.hostId !== deviceId) {
        return NextResponse.json({ error: 'Solo el host puede controlar jugadores.' }, { status: 403 });
      }

      if (targetDeviceId === room.hostId && action === 'kick') {
        return NextResponse.json({ error: 'El host no puede expulsarse durante la partida.' }, { status: 400 });
      }

      const target = room.players.find((player) => player.deviceId === targetDeviceId);
      if (!target) {
        return NextResponse.json({ error: 'Jugador no encontrado.' }, { status: 404 });
      }

      if (action === 'kick') {
        await applyKick(roomId, room, targetDeviceId);
      } else {
        if (!['reveal', 'operative', 'vote'].includes(room.game.phase)) {
          return NextResponse.json({ error: 'Solo se puede omitir en revelación, operativo o votación.' }, { status: 400 });
        }
        await applyOmit(roomId, room, targetDeviceId);
      }

      room.updatedAt = Date.now();
      await saveRoom(room);
      return NextResponse.json(room);
    });
  } catch (error) {
    return routeError('[multi/player-control]', error);
  }
}
