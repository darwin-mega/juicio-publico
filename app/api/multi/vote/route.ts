// app/api/multi/vote/route.ts
// Emite el voto de un jugador. Cuando todos los vivos votaron,
// resuelve automaticamente y avanza a la fase de resolution.

import { NextRequest, NextResponse } from 'next/server';
import { getSecret, mutateRoom } from '@/lib/multi/redis';
import { checkMultiWinCondition, isPlayerActiveAlive, resolveMultiVote } from '@/lib/multi/gameLogic';
import { requireMultiSession } from '@/lib/multi/session';
import { applyProgressIfGameOver, buildVoteProgressEvents } from '@/lib/multi/progression';
import type { PlayerSecret } from '@/lib/multi/types';

type VoteFailure = { error: string; status: number };

export async function POST(req: NextRequest) {
  try {
    const { roomId, targetId } = await req.json() as { roomId: string; targetId: string };
    const deviceId = req.headers.get('X-Device-Id');

    if (!roomId || !deviceId || !targetId) {
      return NextResponse.json({ error: 'Faltan datos.' }, { status: 400 });
    }

    const session = requireMultiSession(req, roomId, deviceId);
    if (session instanceof NextResponse) return session;

    const result = await mutateRoom<true | VoteFailure>(roomId, async (room) => {
      if (!room.game) {
        return { error: 'Sala no encontrada.', status: 404 };
      }

      if (room.game.phase !== 'vote') {
        return { error: 'No es la fase de votacion.', status: 409 };
      }

      const voter = room.players.find((p) => p.deviceId === deviceId);
      if (!voter || !isPlayerActiveAlive(voter)) {
        return { error: 'Jugador no valido o eliminado.', status: 403 };
      }

      const target = room.players.find((p) => p.deviceId === targetId && isPlayerActiveAlive(p));
      if (!target) {
        return { error: 'Objetivo de voto invalido.', status: 400 };
      }

      room.game.votes = { ...room.game.votes, [deviceId]: targetId };
      const alivePlayers = room.players.filter(isPlayerActiveAlive);
      const skippedVotes = room.game.skippedVotes ?? {};
      const allVoted = alivePlayers.every((p) =>
        room.game?.votes[p.deviceId] !== undefined || skippedVotes[p.deviceId] !== undefined
      );

      if (allVoted) {
        const secrets: Record<string, PlayerSecret> = {};
        for (const p of room.players) {
          const secret = await getSecret(roomId, p.deviceId);
          if (secret) secrets[p.deviceId] = secret;
        }

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
    console.error('[multi/vote]', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
