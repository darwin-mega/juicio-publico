import { NextRequest, NextResponse } from 'next/server';
import { requireProgressOwner } from '@/lib/progression/auth';
import { getPlayerProfileSummary } from '@/lib/progression/store';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const playerId = url.searchParams.get('playerId')?.trim();
    const displayName = url.searchParams.get('displayName')?.trim() || undefined;

    if (!playerId) {
      return NextResponse.json({ error: 'Falta playerId.' }, { status: 400 });
    }

    const authError = await requireProgressOwner(playerId);
    if (authError) return authError;

    const profile = await getPlayerProfileSummary(playerId, displayName);
    return NextResponse.json({ profile });
  } catch (err) {
    console.error('[progression/profile]', err);
    return NextResponse.json({ error: 'Error al cargar perfil.' }, { status: 500 });
  }
}
