import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireProgressOwner } from '@/lib/progression/auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const playerId = url.searchParams.get('playerId')?.trim();

    if (!playerId) {
      return NextResponse.json({ error: 'Falta playerId.' }, { status: 400 });
    }

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
