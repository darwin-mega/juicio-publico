// app/api/multi/secret/[roomId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSecret } from '@/lib/multi/redis';

export async function GET(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const { roomId } = params;
    const deviceId = req.headers.get('X-Device-Id');

    if (!roomId || !deviceId) {
      return NextResponse.json({ error: 'roomId y deviceId requeridos.' }, { status: 400 });
    }

    const secret = await getSecret(roomId, deviceId);
    // Puede ser null si la partida no inició aún
    return NextResponse.json(secret);
  } catch (err) {
    console.error('[multi/secret]', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
