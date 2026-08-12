// app/api/multi/secret/[roomId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getRoom, getSecret } from '@/lib/multi/redis';
import { authenticatePlayer } from '@/lib/multi/auth';
import { roomIdSchema } from '@/lib/multi/validation';
import { enforceRateLimit } from '@/lib/multi/rateLimit';
import { routeError } from '@/lib/multi/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const roomIdResult = roomIdSchema.safeParse((await params).roomId);
    const deviceId = req.headers.get('X-Device-Id');

    if (!roomIdResult.success || !deviceId) {
      return NextResponse.json({ error: 'roomId y deviceId requeridos.' }, { status: 400 });
    }
    const roomId = roomIdResult.data;
    const limited = await enforceRateLimit(req, 'poll', roomId);
    if (limited) return limited;

    const room = await getRoom(roomId);
    if (!room) {
      return NextResponse.json({ error: 'Sala no encontrada.' }, { status: 404 });
    }
    if (!(await authenticatePlayer(req, roomId, room))) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }
    const secret = await getSecret(roomId, deviceId);
    // Puede ser null si la partida no inició aún
    return NextResponse.json(secret);
  } catch (error) {
    return routeError('[multi/secret]', error);
  }
}
