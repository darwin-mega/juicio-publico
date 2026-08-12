import { NextRequest, NextResponse } from 'next/server';
import { createCompetition, listCompetitions } from '@/lib/social/store';
import { competitionSchema } from '@/lib/social/validation';
import { parseJsonBody } from '@/lib/multi/request';
import { enforceRateLimit } from '@/lib/multi/rateLimit';

export async function GET(req: NextRequest) {
  try {
    const limited = await enforceRateLimit(req, 'social');
    if (limited) return limited;
    return NextResponse.json({ competitions: await listCompetitions() });
  } catch (error) {
    console.error('[social/competitions]', error);
    return NextResponse.json({ error: 'No se pudo cargar campeonatos.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const limited = await enforceRateLimit(req, 'social');
    if (limited) return limited;
    const parsed = await parseJsonBody(req, competitionSchema);
    if (!parsed.ok) return parsed.response;
    const { name, durationType, inviteeIds } = parsed.data;
    const competition = await createCompetition(name, durationType, inviteeIds);
    return NextResponse.json({ competition });
  } catch (error) {
    console.error('[social/competitions]', error);
    return NextResponse.json({ error: 'No se pudo crear campeonato.' }, { status: 500 });
  }
}
