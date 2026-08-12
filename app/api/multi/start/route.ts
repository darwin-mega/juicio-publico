// app/api/multi/start/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { deleteOperativeProposal, mutateRoom, saveSecret } from '@/lib/multi/redis';
import { assignMultiRoles, createInitialGameState } from '@/lib/multi/gameLogic';
import { authenticatePlayer } from '@/lib/multi/auth';
import type { MultiRoomState } from '@/lib/multi/types';

type StartFailure = { error: string; status: number };

export async function POST(req: NextRequest) {
  try {
    const { roomId } = await req.json();
    const deviceId = req.headers.get('X-Device-Id');

    if (!roomId || !deviceId) {
      return NextResponse.json({ error: 'Faltan datos.' }, { status: 400 });
    }

    const existingRoom = await (await import('@/lib/multi/redis')).getRoom(roomId);
    if (!existingRoom || !(await authenticatePlayer(req, roomId, existingRoom))) {
      return NextResponse.json({ error: 'Credencial invalida.' }, { status: 401 });
    }

    const result = await mutateRoom<MultiRoomState | StartFailure>(roomId, async (room) => {
      if (room.hostId !== deviceId) {
        return { error: 'Solo el host puede iniciar la partida.', status: 403 };
      }

      if (room.status !== 'lobby') {
        return { error: 'La partida ya inicio.', status: 409 };
      }

      if (room.players.length < 4) {
        return { error: 'Se necesitan al menos 4 jugadores.', status: 400 };
      }

      const secrets = assignMultiRoles(room.players, room.config);

      for (const [pid, secret] of Object.entries(secrets)) {
        await saveSecret(roomId, pid, secret);
        await deleteOperativeProposal(roomId, pid);
      }

      room.status = 'playing';
      room.game = createInitialGameState(room.players);
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
    console.error('[multi/start]', err);
    return NextResponse.json({ error: 'Error interno al iniciar la partida.' }, { status: 500 });
  }
}
