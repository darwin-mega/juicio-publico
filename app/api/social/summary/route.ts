import { NextRequest, NextResponse } from 'next/server';
import { getSocialSummary } from '@/lib/social/store';
import { enforceRateLimit } from '@/lib/multi/rateLimit';

export async function GET(req: NextRequest) {
  try {
    const limited = await enforceRateLimit(req, 'social');
    if (limited) return limited;
    return NextResponse.json(await getSocialSummary());
  } catch (error) {
    console.error('[social/summary]', error);
    return NextResponse.json({ error: 'No se pudo cargar la capa social.' }, { status: 500 });
  }
}
