import { NextRequest, NextResponse } from 'next/server';
import { getFriendsRanking } from '@/lib/social/store';
import { enforceRateLimit } from '@/lib/multi/rateLimit';

export async function GET(req: NextRequest) {
  try {
    const limited = await enforceRateLimit(req, 'social');
    if (limited) return limited;
    const period = new URL(req.url).searchParams.get('period') === 'monthly' ? 'monthly' : 'historical';
    return NextResponse.json({ ranking: await getFriendsRanking(period) });
  } catch (error) {
    console.error('[social/friends-ranking]', error);
    return NextResponse.json({ error: 'No se pudo cargar ranking de amigos.' }, { status: 500 });
  }
}
