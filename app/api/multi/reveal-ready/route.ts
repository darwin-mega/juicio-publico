// app/api/multi/reveal-ready/route.ts
// Marca a un jugador como "vio su rol y está listo".
// Cuando todos están listos, la fase avanza automáticamente a 'operative'.

import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom } from '@/lib/multi/redis';

export async function POST(req: NextRequest) {
  try {
    const { roomId } = await req.json();
    const deviceId = req.headers.get('X-Device-Id');

    if (!roomId || !deviceId) {
      return NextResponse.json({ error: 'Faltan datos.' }, { status: 400 });
    }

    const room = await getRoom(roomId);
    if (!room || !room.game) {
      return NextResponse.json({ error: 'Sala o juego no encontrado.' }, { status: 404 });
    }

    if (room.game.phase !== 'reveal') {
      return NextResponse.json({ error: 'No es la fase de revelación.' }, { status: 409 });
    }

    // Marcar jugador como listo
    const updatedPlayers = room.players.map((p) =>
      p.deviceId === deviceId ? { ...p, readyForOperative: true } : p
    );

    // ¿Todos los vivos están listos?
    const alivePlayers = updatedPlayers.filter((p) => p.isAlive);
    const allReady = alivePlayers.every((p) => p.readyForOperative);

    const updatedGame = {
      ...room.game,
      phase: allReady ? ('operative' as const) : room.game.phase,
    };

    const updatedRoom = {
      ...room,
      players: updatedPlayers,
      game: updatedGame,
      updatedAt: Date.now(),
    };

    await saveRoom(updatedRoom);
    return NextResponse.json(updatedRoom);
  } catch (err) {
    console.error('[multi/reveal-ready]', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
