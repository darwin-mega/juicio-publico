import { NextResponse } from 'next/server';
import { PROGRESS_TITLES, PROGRESSION_THRESHOLDS } from '@/lib/progression/titles';

export async function GET() {
  return NextResponse.json({
    thresholds: PROGRESSION_THRESHOLDS,
    titles: PROGRESS_TITLES,
  });
}
