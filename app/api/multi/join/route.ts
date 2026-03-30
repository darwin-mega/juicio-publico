// app/api/multi/join/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom } from '@/lib/multi/redis';
import type { MultiPlayer } from '@/lib/multi/types';

export async function POST(req: NextRequest) {
  try {
    const { roomId, name, deviceId } = await req.json();

    if (!roomId || !name?.trim() || !deviceId) {
      return NextResponse.json({ error: 'Faltan datos obligatorios.' }, { status: 400 });
    }

    const room = await getRoom(roomId);
    if (!room) {
      return NextResponse.json({ error: 'Sala no encontrada.' }, { status: 404 });
    }

    if (room.status !== 'lobby') {
      // Permitir reconexión si el jugador ya estaba en la sala
      const existing = room.players.find((p) => p.deviceId === deviceId);
      if (existing) {
        return NextResponse.json(room);
      }
      return NextResponse.json({ error: 'La partida ya comenzó.' }, { status: 409 });
    }

    // Verificar si ya está unido (reconexión)
    const already = room.players.find((p) => p.deviceId === deviceId);
    if (already) {
      return NextResponse.json(room);
    }

    // Verificar que no exista otro jugador con el mismo nombre
    const nameTaken = room.players.some(
      (p) => p.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (nameTaken) {
      return NextResponse.json(
        { error: 'Ese nombre ya está en uso en esta sala.' },
        { status: 409 }
      );
    }

    const newPlayer: MultiPlayer = {
      deviceId,
      name: name.trim(),
      joinedAt: Date.now(),
      isAlive: true,
      isRevealed: false,
      readyForOperative: false,
    };

    const updatedRoom = {
      ...room,
      players: [...room.players, newPlayer],
      updatedAt: Date.now(),
    };

    await saveRoom(updatedRoom);
    return NextResponse.json(updatedRoom);
  } catch (err) {
    console.error('[multi/join]', err);
    return NextResponse.json({ error: 'Error interno al unirse a la sala.' }, { status: 500 });
  }
}
