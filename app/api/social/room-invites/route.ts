import { NextRequest, NextResponse } from 'next/server';
import { createRoomInvites, listRoomInvites, respondRoomInvite } from '@/lib/social/store';
import { roomInviteActionSchema } from '@/lib/social/validation';
import { parseJsonBody } from '@/lib/multi/request';
import { enforceRateLimit } from '@/lib/multi/rateLimit';
import { getRoom } from '@/lib/multi/redis';
import { authenticatePlayer } from '@/lib/multi/auth';

export async function GET(req: NextRequest) {
  try {
    const limited = await enforceRateLimit(req, 'social');
    if (limited) return limited;
    return NextResponse.json({ invites: await listRoomInvites() });
  } catch (error) {
    console.error('[social/room-invites]', error);
    return NextResponse.json({ error: 'No se pudo cargar invitaciones.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const limited = await enforceRateLimit(req, 'social');
    if (limited) return limited;
    const parsed = await parseJsonBody(req, roomInviteActionSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    if ('inviteId' in body) {
      return NextResponse.json({ invite: await respondRoomInvite(body.inviteId, body.status) });
    }
    const deviceId = req.headers.get('X-Device-Id');
    const room = await getRoom(body.roomId);
    if (!room) return NextResponse.json({ error: 'Sala no encontrada.' }, { status: 404 });
    if (!deviceId || !(await authenticatePlayer(req, body.roomId, room))) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }
    if (room.hostId !== deviceId) {
      return NextResponse.json({ error: 'Solo el host puede invitar a la sala.' }, { status: 403 });
    }
    return NextResponse.json({ invites: await createRoomInvites(body.roomId, body.inviteeIds) });
  } catch (error) {
    console.error('[social/room-invites]', error);
    return NextResponse.json({ error: 'No se pudo invitar amigos.' }, { status: 500 });
  }
}
