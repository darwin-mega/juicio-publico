import { NextRequest, NextResponse } from 'next/server';
import { getRoom, getSecret, saveRoom, withRoomLock } from '@/lib/multi/redis';
import { checkMultiWinCondition, resolveMultiVote } from '@/lib/multi/gameLogic';
import type { PlayerSecret } from '@/lib/multi/types';
import { authenticatePlayer } from '@/lib/multi/auth';
import { voteSchema } from '@/lib/multi/validation';
import { parseJsonBody } from '@/lib/multi/request';
import { enforceRateLimit } from '@/lib/multi/rateLimit';
import { routeError } from '@/lib/multi/errors';

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseJsonBody(req, voteSchema);
    if (!parsed.ok) return parsed.response;
    const { roomId, targetId } = parsed.data;
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
      if (room.game.phase !== 'vote') {
        return NextResponse.json({ error: 'No es la fase de votación.' }, { status: 409 });
      }

      const voter = room.players.find((player) => player.deviceId === deviceId);
      if (!voter || !voter.isAlive) {
        return NextResponse.json({ error: 'Jugador no válido o eliminado.' }, { status: 403 });
      }
      const target = room.players.find((player) => player.deviceId === targetId && player.isAlive);
      if (!target) {
        return NextResponse.json({ error: 'Objetivo de voto inválido.' }, { status: 400 });
      }

      const updatedVotes = { ...room.game.votes, [deviceId]: targetId };
      const alivePlayers = room.players.filter((player) => player.isAlive);
      const allVoted = alivePlayers.every((player) => updatedVotes[player.deviceId] !== undefined);
      let updatedGame = { ...room.game, votes: updatedVotes };
      let updatedPlayers = room.players;

      if (allVoted) {
        const secrets: Record<string, PlayerSecret> = {};
        for (const player of alivePlayers) {
          const secret = await getSecret(roomId, player.deviceId);
          if (secret) secrets[player.deviceId] = secret;
        }

        const voteResult = resolveMultiVote(room.players, updatedVotes, secrets);
        updatedPlayers = voteResult.updatedPlayers;
        const winner = checkMultiWinCondition(updatedPlayers, secrets, room.config.killerCount);
        const lastReport = room.game.reports[room.game.reports.length - 1];
        const updatedReports = lastReport
          ? [
              ...room.game.reports.slice(0, -1),
              {
                ...lastReport,
                expelled: voteResult.expelled,
                expelledWasKiller: voteResult.expelledWasKiller,
              },
            ]
          : room.game.reports;

        updatedGame = {
          ...updatedGame,
          phase: 'resolution',
          votes: updatedVotes,
          reports: updatedReports,
          winnerFaction: winner,
          isOver: winner !== null,
        };
      }

      const updatedRoom = {
        ...room,
        players: updatedPlayers,
        game: updatedGame,
        updatedAt: Date.now(),
      };
      await saveRoom(updatedRoom);
      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    return routeError('[multi/vote]', error);
  }
}
