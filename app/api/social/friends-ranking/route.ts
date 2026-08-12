import { NextRequest, NextResponse } from 'next/server';
import { getFriendsRanking } from '@/lib/social/store';

export async function GET(req: NextRequest) {
  try {
    const period = new URL(req.url).searchParams.get('period') === 'monthly' ? 'monthly' : 'historical';
    return NextResponse.json({ ranking: await getFriendsRanking(period) });
  } catch (error) {
    console.error('[social/friends-ranking]', error);
    return NextResponse.json({ error: 'No se pudo cargar ranking de amigos.' }, { status: 500 });
  }
}
