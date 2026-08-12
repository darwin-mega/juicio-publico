import { NextRequest, NextResponse } from 'next/server';
import { listFriends, requestFriend, requestFriendByCode, respondFriendship } from '@/lib/social/store';
import { friendshipActionSchema } from '@/lib/social/validation';
import { parseJsonBody } from '@/lib/multi/request';
import { enforceRateLimit } from '@/lib/multi/rateLimit';

export async function GET(req: NextRequest) {
  try {
    const limited = await enforceRateLimit(req, 'social');
    if (limited) return limited;
    return NextResponse.json({ friends: await listFriends() });
  } catch (error) {
    console.error('[social/friends]', error);
    return NextResponse.json({ error: 'No se pudo cargar amigos.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const limited = await enforceRateLimit(req, 'social');
    if (limited) return limited;
    const parsed = await parseJsonBody(req, friendshipActionSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    if ('friendshipId' in body) {
      await respondFriendship(body.friendshipId, body.status);
      return NextResponse.json({ ok: true });
    }

    if ('friendCode' in body) {
      await requestFriendByCode(body.friendCode);
      return NextResponse.json({ ok: true });
    }

    await requestFriend(body.targetUserId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[social/friends]', error);
    return NextResponse.json({ error: 'No se pudo actualizar amistad.' }, { status: 500 });
  }
}
