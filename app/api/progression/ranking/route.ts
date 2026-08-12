import { NextRequest, NextResponse } from 'next/server';
import { getCurrentProgressMonth, getRanking } from '@/lib/progression/store';
import type { RankingPeriod } from '@/lib/progression/types';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const periodParam = url.searchParams.get('period');
    const period: RankingPeriod = periodParam === 'monthly' ? 'monthly' : 'historical';
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 50), 1), 100);
    const month = url.searchParams.get('month') ?? getCurrentProgressMonth();

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
