import type { NextRequest } from 'next/server';
import { checkStoreHealth } from '@/lib/multi/redis';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return { url: url?.replace(/\/$/, ''), key };
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { url, key } = getSupabaseConfig();
  if (!url || !key) {
    console.error('[cron] Supabase keep-alive is not configured');
    return Response.json({ ok: false, error: 'Service unavailable' }, { status: 503 });
  }

  try {
    const [response, store] = await Promise.all([
      fetch(
        `${url}/rest/v1/player_progress_profiles?select=player_id&limit=1`,
        {
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
          },
          cache: 'no-store',
          signal: AbortSignal.timeout(8_000),
        },
      ),
      checkStoreHealth(),
    ]);

    if (!response.ok) {
      console.error('[cron] Supabase keep-alive failed', response.status);
      return Response.json({ ok: false, error: 'Upstream unavailable' }, { status: 502 });
    }

    return Response.json({
      ok: true,
      services: { supabase: 'ok', store },
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[cron] Supabase keep-alive request failed', error instanceof Error ? error.message : 'unknown error');
    return Response.json({ ok: false, error: 'Upstream unavailable' }, { status: 502 });
  }
}
