import { NextRequest, NextResponse } from 'next/server';
import { createCompetition, listCompetitions } from '@/lib/social/store';

export async function GET() {
  try {
    return NextResponse.json({ competitions: await listCompetitions() });
  } catch (error) {
    console.error('[social/competitions]', error);
    return NextResponse.json({ error: 'No se pudo cargar campeonatos.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, durationType, inviteeIds } = await req.json();
    if (!name?.trim() || !['monthly', 'bimonthly'].includes(durationType)) {
      return NextResponse.json({ error: 'Datos invalidos.' }, { status: 400 });
    }
    const competition = await createCompetition(name.trim(), durationType, Array.isArray(inviteeIds) ? inviteeIds : []);
    return NextResponse.json({ competition });
  } catch (error) {
    console.error('[social/competitions]', error);
    return NextResponse.json({ error: 'No se pudo crear campeonato.' }, { status: 500 });
  }
}
