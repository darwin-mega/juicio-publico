import { createClient, hasSupabaseConfig } from '@/lib/supabase/server';
import { ensureSocialProfile } from '@/lib/social/store';
import type { NextRequest } from 'next/server';
import { getSafeAuthRedirect, redirectAuthRequest } from '@/lib/supabase/auth-redirect';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const next = getSafeAuthRedirect(request.nextUrl.searchParams.get('next'));

  if (!hasSupabaseConfig()) {
    return redirectAuthRequest(request, '/login', 'missing-config');
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      try {
        await ensureSocialProfile();
      } catch (profileError) {
        console.warn('[auth/callback] No se pudo inicializar perfil social', profileError);
      }

      return redirectAuthRequest(request, next);
    }
  }

  return redirectAuthRequest(request, '/login', 'auth-code');
}
