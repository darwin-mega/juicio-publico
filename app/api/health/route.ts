import { NextResponse } from 'next/server';
import { checkStoreHealth } from '@/lib/multi/redis';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startedAt = performance.now();

  try {
    const store = await checkStoreHealth();
    return NextResponse.json(
      {
        status: 'ok',
        checks: { rooms: store },
        latencyMs: Math.round(performance.now() - startedAt),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[health] Room store unavailable', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json(
      { status: 'unavailable', checks: { rooms: 'error' } },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
