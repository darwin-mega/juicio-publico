import { NextRequest, NextResponse } from 'next/server';
import { listFriends, requestFriend, requestFriendByCode, respondFriendship } from '@/lib/social/store';

export async function GET() {
  try {
    return NextResponse.json({ friends: await listFriends() });
  } catch (error) {
    console.error('[social/friends]', error);
    return NextResponse.json({ error: 'No se pudo cargar amigos.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.friendshipId && body.status) {
      await respondFriendship(body.friendshipId, body.status);
      return NextResponse.json({ ok: true });
    }

    if (body.friendCode) {
      await requestFriendByCode(body.friendCode);
      return NextResponse.json({ ok: true });
    }

    if (!body.targetUserId) {
      return NextResponse.json({ error: 'Falta targetUserId.' }, { status: 400 });
    }

    await requestFriend(body.targetUserId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[social/friends]', error);
    return NextResponse.json({ error: 'No se pudo actualizar amistad.' }, { status: 500 });
  }
}
