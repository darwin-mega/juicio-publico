import { NextRequest, NextResponse } from 'next/server';
import { deleteRoomData, getRoom, withRoomLock } from '@/lib/multi/redis';
import { authenticatePlayer } from '@/lib/multi/auth';
import { roomCommandSchema } from '@/lib/multi/validation';
import { parseJsonBody } from '@/lib/multi/request';
import { enforceRateLimit } from '@/lib/multi/rateLimit';
import { routeError } from '@/lib/multi/errors';

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseJsonBody(req, roomCommandSchema);
    if (!parsed.ok) return parsed.response;
    const { roomId } = parsed.data;
    const deviceId = req.headers.get('X-Device-Id');
    const limited = await enforceRateLimit(req, 'command', roomId);
    if (limited) return limited;
    if (!deviceId) {
      return NextResponse.json({ error: 'Identidad de dispositivo requerida.' }, { status: 400 });
    }

    return withRoomLock(roomId, async () => {
      const room = await getRoom(roomId);
      if (!room) return NextResponse.json({ ok: true });
      if (!(await authenticatePlayer(req, roomId, room))) {
        return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
      }
      if (room.hostId !== deviceId) {
        return NextResponse.json({ error: 'Solo el host puede eliminar la sala.' }, { status: 403 });
      }

      await deleteRoomData(room);
      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    return routeError('[multi/reset]', error);
  }
}
