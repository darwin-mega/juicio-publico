import { NextRequest, NextResponse } from 'next/server';
import { getCurrentProgressMonth, getRanking } from '@/lib/progression/store';
import type { RankingPeriod } from '@/lib/progression/types';
import { rankingQuerySchema } from '@/lib/social/validation';
import { enforceRateLimit } from '@/lib/multi/rateLimit';

export async function GET(req: NextRequest) {
  try {
    const limited = await enforceRateLimit(req, 'social');
    if (limited) return limited;
    const url = new URL(req.url);
    const parsed = rankingQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) return NextResponse.json({ error: 'Parámetros inválidos.' }, { status: 400 });
    const period: RankingPeriod = parsed.data.period;
    const limit = parsed.data.limit;
    const month = parsed.data.month ?? getCurrentProgressMonth();

    const ranking = await getRanking(period, { month, limit });
    return NextResponse.json({
      period,
      month: period === 'monthly' ? month : null,
      ranking,
    });
  } catch (err) {
    console.error('[progression/ranking]', err);
    return NextResponse.json({ error: 'Error al cargar ranking.' }, { status: 500 });
  }
}
