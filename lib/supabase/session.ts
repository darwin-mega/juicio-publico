import type { SupabaseClient } from '@supabase/supabase-js';

export const AUTH_SESSION_TIMEOUT_MS = 8_000;

export async function getSessionWithTimeout(
  client: SupabaseClient,
  timeoutMs = AUTH_SESSION_TIMEOUT_MS,
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('La verificacion de sesion demoro demasiado.')), timeoutMs);
  });

  try {
    const { data, error } = await Promise.race([client.auth.getSession(), timeout]);
    if (error) throw error;
    return data.session;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
