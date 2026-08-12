import { createClient, hasSupabaseConfig } from '@/lib/supabase/server';

type AccountIdentity = {
  accountId?: string;
  accountDisplayName?: string;
};

function getDisplayName(user: { user_metadata?: Record<string, unknown>; email?: string } | null | undefined) {
  const metadata = user?.user_metadata ?? {};
  const value = metadata.username || metadata.full_name || metadata.name || user?.email?.split('@')[0];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export async function getOptionalAccountIdentity(): Promise<AccountIdentity> {
  if (!hasSupabaseConfig()) return {};

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return {};
    return {
      accountId: data.user.id,
      accountDisplayName: getDisplayName(data.user),
    };
  } catch (error) {
    console.error('[multi/account] No se pudo asociar la cuenta; la partida continúa como invitado.', error);
    return {};
  }
}
