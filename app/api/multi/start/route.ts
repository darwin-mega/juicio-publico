// app/api/multi/start/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom, saveSecret } from '@/lib/multi/redis';
import {
  assignMultiRoles,
  createInitialGameState,
} from '@/lib/multi/gameLogic';

export async function POST(req: NextRequest) {
  try {
    const { roomId } = await req.json();
    const deviceId = req.headers.get('X-Device-Id');

    if (!roomId || !deviceId) {
      return NextResponse.json({ error: 'Faltan datos.' }, { status: 400 });
    }

    const room = await getRoom(roomId);
    if (!room) {
      return NextResponse.json({ error: 'Sala no encontrada.' }, { status: 404 });
    }

    if (room.hostId !== deviceId) {
      return NextResponse.json({ error: 'Solo el host puede iniciar la partida.' }, { status: 403 });
    }

    if (room.status !== 'lobby') {
      return NextResponse.json({ error: 'La partida ya inició.' }, { status: 409 });
    }

    if (room.players.length < 4) {
      return NextResponse.json({ error: 'Se necesitan al menos 4 jugadores.' }, { status: 400 });
    }

    // Asignar roles server-side (los secretos nunca van al cliente directamente)
    const secrets = assignMultiRoles(room.players, room.config);

    // Guardar cada secreto en Redis por separado
    for (const [pid, secret] of Object.entries(secrets)) {
      await saveSecret(roomId, pid, secret);
    }

    // Crear el estado de juego inicial
    const game = createInitialGameState(room.players);

    const updatedRoom = {
      ...room,
      status: 'playing' as const,
      game,
      updatedAt: Date.now(),
    };

    await saveRoom(updatedRoom);
    return NextResponse.json(updatedRoom);
  } catch (err) {
    console.error('[multi/start]', err);
    return NextResponse.json({ error: 'Error interno al iniciar la partida.' }, { status: 500 });
  }
}
