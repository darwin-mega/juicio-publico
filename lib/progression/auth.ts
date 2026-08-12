import 'server-only';
import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, hasSupabaseConfig } from '@/lib/supabase/server';

export async function requireProgressOwner(playerId: string) {
  if (!hasSupabaseConfig()) return null;

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return NextResponse.json({ error: 'Sesion requerida.' }, { status: 401 });
  }

  if (data.user.id !== playerId) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }

  return null;
}
