import type { EmailOtpType } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { ensureSocialProfile } from '@/lib/social/store';
import { getSafeAuthRedirect, redirectAuthRequest } from '@/lib/supabase/auth-redirect';
import { createClient, hasSupabaseConfig } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  if (!hasSupabaseConfig()) {
    return redirectAuthRequest(request, '/login', 'missing-config');
  }

  const tokenHash = request.nextUrl.searchParams.get('token_hash');
  const type = request.nextUrl.searchParams.get('type') as EmailOtpType | null;
  const next = getSafeAuthRedirect(request.nextUrl.searchParams.get('next'));

  if (!tokenHash || !type) {
    return redirectAuthRequest(request, '/login', 'auth-code');
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  if (error) {
    console.warn('[auth/confirm] No se pudo verificar el correo', error.message);
    return redirectAuthRequest(request, '/login', 'auth-code');
  }

  try {
    await ensureSocialProfile();
  } catch (profileError) {
    console.warn('[auth/confirm] No se pudo inicializar perfil social', profileError);
  }

  return redirectAuthRequest(request, next);
}
