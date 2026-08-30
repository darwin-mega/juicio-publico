import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSessionWithTimeout } from '@/lib/supabase/session';

function clientWithGetSession(getSession: () => Promise<unknown>) {
  return {
    auth: { getSession },
  } as unknown as SupabaseClient;
}

describe('verificacion de sesion de Supabase', () => {
  it('devuelve la sesion confirmada', async () => {
    const session = { user: { id: 'user-1' } };
    const client = clientWithGetSession(async () => ({ data: { session }, error: null }));

    await expect(getSessionWithTimeout(client, 100)).resolves.toBe(session);
  });

  it('propaga errores de autenticacion', async () => {
    const client = clientWithGetSession(async () => ({
      data: { session: null },
      error: new Error('Auth unavailable'),
    }));

    await expect(getSessionWithTimeout(client, 100)).rejects.toThrow('Auth unavailable');
  });

  it('corta consultas que no responden', async () => {
    vi.useFakeTimers();
    const client = clientWithGetSession(() => new Promise(() => undefined));
    const result = getSessionWithTimeout(client, 8_000);
    const expectation = expect(result).rejects.toThrow('demoro demasiado');

    await vi.advanceTimersByTimeAsync(8_000);

    await expectation;
    vi.useRealTimers();
  });
});
