// app/api/multi/reset/route.ts
// Elimina la sala de Redis (solo el host puede hacerlo).

import { NextRequest, NextResponse } from 'next/server';
import { getRoom, deleteRoom } from '@/lib/multi/redis';

export async function POST(req: NextRequest) {
  try {
    const { roomId } = await req.json();
    const deviceId = req.headers.get('X-Device-Id');

    if (!roomId || !deviceId) {
      return NextResponse.json({ error: 'Faltan datos.' }, { status: 400 });
    }

    const room = await getRoom(roomId);
    if (!room) {
      return NextResponse.json({ ok: true }); // ya no existe, ok
    }

    if (room.hostId !== deviceId) {
      return NextResponse.json({ error: 'Solo el host puede eliminar la sala.' }, { status: 403 });
    }

    await deleteRoom(roomId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[multi/reset]', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
