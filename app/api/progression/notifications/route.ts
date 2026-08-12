import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireProgressOwner } from '@/lib/progression/auth';
import { progressOwnerQuerySchema } from '@/lib/social/validation';
import { enforceRateLimit } from '@/lib/multi/rateLimit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(req: NextRequest) {
  try {
    const limited = await enforceRateLimit(req, 'social');
    if (limited) return limited;
    const url = new URL(req.url);
    const parsed = progressOwnerQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) return NextResponse.json({ error: 'Parámetros inválidos.' }, { status: 400 });
    const { playerId } = parsed.data;

    const authError = await requireProgressOwner(playerId);
    if (authError) return authError;

    if (supabaseUrl && !serviceKey) {
      return NextResponse.json(
        { error: 'Falta SUPABASE_SERVICE_ROLE_KEY para cargar notificaciones.' },
        { status: 503 }
      );
    }

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ notifications: [] });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from('progress_notifications')
      .select('id,type,title,body,reward_id,read_at,created_at_ms')
      .eq('player_id', playerId)
      .order('created_at_ms', { ascending: false })
      .limit(20);

    if (error) throw error;

    return NextResponse.json({ notifications: data ?? [] });
  } catch (err) {
    console.error('[progression/notifications]', err);
    return NextResponse.json({ error: 'Error al cargar notificaciones.' }, { status: 500 });
  }
}
