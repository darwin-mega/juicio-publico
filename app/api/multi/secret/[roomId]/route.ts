// app/api/multi/secret/[roomId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSecret } from '@/lib/multi/redis';
import { requireMultiSession } from '@/lib/multi/session';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const deviceId = req.headers.get('X-Device-Id');

    if (!roomId || !deviceId) {
      return NextResponse.json({ error: 'roomId y deviceId requeridos.' }, { status: 400 });
    }

    const session = requireMultiSession(req, roomId, deviceId);
    if (session instanceof NextResponse) return session;

    const secret = await getSecret(roomId, deviceId);
    // Puede ser null si la partida no inició aún
    return NextResponse.json(secret);
  } catch (err) {
    console.error('[multi/secret]', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
