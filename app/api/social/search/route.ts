import { NextRequest, NextResponse } from 'next/server';
import { searchUsers } from '@/lib/social/store';
import { userSearchSchema } from '@/lib/social/validation';
import { enforceRateLimit } from '@/lib/multi/rateLimit';

export async function GET(req: NextRequest) {
  try {
    const limited = await enforceRateLimit(req, 'social');
    if (limited) return limited;
    const parsed = userSearchSchema.safeParse(new URL(req.url).searchParams.get('q') ?? '');
    if (!parsed.success) return NextResponse.json({ users: [] });
    return NextResponse.json({ users: await searchUsers(parsed.data) });
  } catch (error) {
    console.error('[social/search]', error);
    return NextResponse.json({ error: 'No se pudo buscar usuarios.' }, { status: 500 });
  }
}
