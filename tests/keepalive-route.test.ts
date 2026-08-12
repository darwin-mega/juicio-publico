import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/cron/keep-supabase-active/route';

const ORIGINAL_ENV = { ...process.env };

function request(authorization?: string) {
  return new NextRequest('https://example.test/api/cron/keep-supabase-active', {
    headers: authorization ? { authorization } : undefined,
  });
}

describe('Supabase keep-alive cron', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret-value';
    process.env.SUPABASE_URL = 'https://project.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'publishable-test-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it('rechaza llamadas sin el secreto de Vercel', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('falla cerrado si falta la configuración de Supabase', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const response = await GET(request('Bearer test-secret-value'));

    expect(response.status).toBe(503);
  });

  it('hace una lectura mínima sin modificar datos', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('[]', { status: 200 }));

    const response = await GET(request('Bearer test-secret-value'));

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy.mock.calls[0][0]).toBe(
      'https://project.supabase.co/rest/v1/player_progress_profiles?select=player_id&limit=1',
    );
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ cache: 'no-store' });
  });
});
