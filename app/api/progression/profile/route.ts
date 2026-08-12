import { NextRequest, NextResponse } from 'next/server';
import { requireProgressOwner } from '@/lib/progression/auth';
import { getPlayerProfileSummary } from '@/lib/progression/store';
import { progressOwnerQuerySchema } from '@/lib/social/validation';
import { enforceRateLimit } from '@/lib/multi/rateLimit';

export async function GET(req: NextRequest) {
  try {
    const limited = await enforceRateLimit(req, 'social');
    if (limited) return limited;
    const url = new URL(req.url);
    const parsed = progressOwnerQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) return NextResponse.json({ error: 'Parámetros inválidos.' }, { status: 400 });
    const { playerId, displayName } = parsed.data;

    const authError = await requireProgressOwner(playerId);
    if (authError) return authError;

    const profile = await getPlayerProfileSummary(playerId, displayName);
    return NextResponse.json({ profile });
  } catch (err) {
    console.error('[progression/profile]', err);
    return NextResponse.json({ error: 'Error al cargar perfil.' }, { status: 500 });
  }
}
