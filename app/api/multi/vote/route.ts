// app/api/multi/vote/route.ts
// Emite el voto de un jugador.
// Cuando todos los vivos votaron → resolve automáticamente
// y avanza a la fase de resolution.

import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom, getSecret } from '@/lib/multi/redis';
import { resolveMultiVote, checkMultiWinCondition } from '@/lib/multi/gameLogic';
import type { PlayerSecret } from '@/lib/multi/types';

export async function POST(req: NextRequest) {
  try {
    const { roomId, targetId } = await req.json() as { roomId: string; targetId: string };
    const deviceId = req.headers.get('X-Device-Id');

    if (!roomId || !deviceId || !targetId) {
      return NextResponse.json({ error: 'Faltan datos.' }, { status: 400 });
    }

    const room = await getRoom(roomId);
    if (!room || !room.game) {
      return NextResponse.json({ error: 'Sala no encontrada.' }, { status: 404 });
    }

    if (room.game.phase !== 'vote') {
      return NextResponse.json({ error: 'No es la fase de votación.' }, { status: 409 });
    }

    const voter = room.players.find((p) => p.deviceId === deviceId);
    if (!voter || !voter.isAlive) {
      return NextResponse.json({ error: 'Jugador no válido o eliminado.' }, { status: 403 });
    }

    const target = room.players.find((p) => p.deviceId === targetId && p.isAlive);
    if (!target) {
      return NextResponse.json({ error: 'Objetivo de voto inválido.' }, { status: 400 });
    }

    const updatedVotes = { ...room.game.votes, [deviceId]: targetId };
    const alivePlayers = room.players.filter((p) => p.isAlive);
    const allVoted = alivePlayers.every((p) => updatedVotes[p.deviceId] !== undefined);

    let updatedGame = { ...room.game, votes: updatedVotes };
    let updatedPlayers = room.players;

    if (allVoted) {
      // Cargar secretos para verificar si el expulsado era killer
      const secrets: Record<string, PlayerSecret> = {};
      for (const p of alivePlayers) {
        const s = await getSecret(roomId, p.deviceId);
        if (s) secrets[p.deviceId] = s;
      }

      const { updatedPlayers: newPlayers, expelled, expelledWasKiller } =
        resolveMultiVote(room.players, updatedVotes, secrets);
      updatedPlayers = newPlayers;

      const winner = checkMultiWinCondition(updatedPlayers, secrets);

      // Actualizar el último reporte con expulsado
      const lastReport = room.game.reports[room.game.reports.length - 1];
      const updatedReports = lastReport
        ? [
            ...room.game.reports.slice(0, -1),
            { ...lastReport, expelled, expelledWasKiller },
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
  } catch (err) {
    console.error('[multi/vote]', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
