// app/api/multi/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { saveRoom } from '@/lib/multi/redis';
import { generateRoomId } from '@/lib/multi/gameLogic';
import type { MultiRoomState, MultiPlayer } from '@/lib/multi/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { config, hostName, deviceId } = body;

    if (!deviceId || !hostName?.trim()) {
      return NextResponse.json({ error: 'Faltan datos obligatorios.' }, { status: 400 });
    }

    // Intentar hasta 3 veces para evitar colisiones de roomId
    let roomId = generateRoomId();

    const hostPlayer: MultiPlayer = {
      deviceId,
      name: hostName.trim(),
      joinedAt: Date.now(),
      isAlive: true,
      isRevealed: false,
      readyForOperative: false,
    };

    const room: MultiRoomState = {
      roomId,
      hostId: deviceId,
      status: 'lobby',
      config: {
        killerCount: config?.killerCount ?? 1,
        copCount: config?.copCount ?? 1,
        trialDurationSeconds: config?.trialDurationSeconds ?? 120,
      },
      players: [hostPlayer],
      game: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await saveRoom(room);

    return NextResponse.json({ roomId, room });
  } catch (err) {
    console.error('[multi/create]', err);
    return NextResponse.json({ error: 'Error interno al crear la sala.' }, { status: 500 });
  }
}
