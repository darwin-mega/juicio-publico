import { NextRequest, NextResponse } from 'next/server';
import { createRoomInvites, listRoomInvites, respondRoomInvite } from '@/lib/social/store';

export async function GET() {
  try {
    return NextResponse.json({ invites: await listRoomInvites() });
  } catch (error) {
    console.error('[social/room-invites]', error);
    return NextResponse.json({ error: 'No se pudo cargar invitaciones.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { roomId, inviteeIds, inviteId, status } = await req.json();
    if (inviteId && ['accepted', 'declined'].includes(status)) {
      return NextResponse.json({ invite: await respondRoomInvite(inviteId, status) });
    }

    if (!roomId || !Array.isArray(inviteeIds)) {
      return NextResponse.json({ error: 'Datos invalidos.' }, { status: 400 });
    }
    return NextResponse.json({ invites: await createRoomInvites(roomId, inviteeIds) });
  } catch (error) {
    console.error('[social/room-invites]', error);
    return NextResponse.json({ error: 'No se pudo invitar amigos.' }, { status: 500 });
  }
}
