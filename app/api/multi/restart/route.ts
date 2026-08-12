import { NextRequest, NextResponse } from 'next/server';
import { deleteOperativeProposal, mutateRoom, saveSecret } from '@/lib/multi/redis';
import { assignMultiRoles, createInitialGameState } from '@/lib/multi/gameLogic';
import { requireMultiSession } from '@/lib/multi/session';
import type { MultiRoomState } from '@/lib/multi/types';

type RestartFailure = { error: string; status: number };

export async function POST(req: NextRequest) {
  try {
    const { roomId } = await req.json();
    const deviceId = req.headers.get('X-Device-Id');

    if (!roomId || !deviceId) {
      return NextResponse.json({ error: 'Faltan datos.' }, { status: 400 });
    }

    const session = requireMultiSession(req, roomId, deviceId, { hostOnly: true });
    if (session instanceof NextResponse) return session;

    const result = await mutateRoom<MultiRoomState | RestartFailure>(roomId, async (room) => {
      if (!room.game) {
        return { error: 'Sala no encontrada.', status: 404 };
      }

      if (room.hostId !== deviceId) {
        return { error: 'Solo el host puede reiniciar la partida.', status: 403 };
      }

      if (!room.game.isOver) {
        return { error: 'La partida todavia no termino.', status: 409 };
      }

      const resetPlayers = room.players.map((player) => ({
        ...player,
        isAlive: true,
        isRevealed: false,
        readyForOperative: false,
      }));

      const secrets = assignMultiRoles(resetPlayers, room.config);

      for (const [pid, secret] of Object.entries(secrets)) {
        await saveSecret(roomId, pid, secret);
        await deleteOperativeProposal(roomId, pid);
      }

      room.status = 'playing';
      room.players = resetPlayers;
      room.game = createInitialGameState(resetPlayers);
      room.updatedAt = Date.now();

      return room;
    });

    if (!result) {
      return NextResponse.json({ error: 'Sala no encontrada.' }, { status: 404 });
    }

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[multi/restart]', err);
    return NextResponse.json({ error: 'Error interno al reiniciar la partida.' }, { status: 500 });
  }
}
