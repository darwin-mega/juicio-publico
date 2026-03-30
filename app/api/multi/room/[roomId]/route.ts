// app/api/multi/room/[roomId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getRoom } from '@/lib/multi/redis';

export async function GET(
  _req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const { roomId } = params;
    if (!roomId) {
      return NextResponse.json({ error: 'roomId requerido.' }, { status: 400 });
    }

    const room = await getRoom(roomId);
    if (!room) {
      return NextResponse.json({ error: 'Sala no encontrada.' }, { status: 404 });
    }

    return NextResponse.json(room);
  } catch (err) {
    console.error('[multi/room]', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
