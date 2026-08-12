// app/api/multi/reveal-ready/route.ts
// Marca a un jugador como listo. Cuando todos estan listos,
// la fase avanza automaticamente a operative.

import { NextRequest, NextResponse } from 'next/server';
import { mutateRoom } from '@/lib/multi/redis';
import { isPlayerActiveAlive } from '@/lib/multi/gameLogic';
import { requireMultiSession } from '@/lib/multi/session';
import type { MultiRoomState } from '@/lib/multi/types';

type RevealFailure = { error: string; status: number };

export async function POST(req: NextRequest) {
  try {
    const { roomId } = await req.json();
    const deviceId = req.headers.get('X-Device-Id');

    if (!roomId || !deviceId) {
      return NextResponse.json({ error: 'Faltan datos.' }, { status: 400 });
    }

    const session = requireMultiSession(req, roomId, deviceId);
    if (session instanceof NextResponse) return session;

    const result = await mutateRoom<MultiRoomState | RevealFailure>(roomId, (room) => {
      if (!room.game) {
        return { error: 'Sala o juego no encontrado.', status: 404 };
      }

      if (room.game.phase !== 'reveal') {
        return { error: 'No es la fase de revelacion.', status: 409 };
      }

      const player = room.players.find((p) => p.deviceId === deviceId);
      if (!player) {
        return { error: 'Tu sesion no corresponde a esta sala.', status: 403 };
      }

      player.readyForOperative = true;

      const alivePlayers = room.players.filter(isPlayerActiveAlive);
      const allReady = alivePlayers.every((p) => p.readyForOperative);
      if (allReady) {
        room.game.phase = 'operative';
      }

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
    console.error('[multi/reveal-ready]', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
