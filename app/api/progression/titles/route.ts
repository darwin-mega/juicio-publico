import { NextRequest, NextResponse } from 'next/server';
import { PROGRESS_TITLES, PROGRESSION_THRESHOLDS } from '@/lib/progression/titles';
import { enforceRateLimit } from '@/lib/multi/rateLimit';

export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, 'social');
  if (limited) return limited;
  return NextResponse.json({
    thresholds: PROGRESSION_THRESHOLDS,
    titles: PROGRESS_TITLES,
  });
}
