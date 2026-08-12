import { NextRequest, NextResponse } from 'next/server';
import { ensureSocialProfile } from '@/lib/social/store';
import { enforceRateLimit } from '@/lib/multi/rateLimit';

export async function POST(req: NextRequest) {
  try {
    const limited = await enforceRateLimit(req, 'social');
    if (limited) return limited;
    return NextResponse.json({ profile: await ensureSocialProfile() });
  } catch (error) {
    console.error('[social/bootstrap]', error);
    return NextResponse.json({ error: 'No se pudo inicializar el perfil social.' }, { status: 500 });
  }
}
