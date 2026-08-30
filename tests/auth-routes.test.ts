import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as confirmEmail } from '@/app/auth/confirm/route';
import { GET as completeOAuth } from '@/app/auth/callback/route';

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
  ensureSocialProfile: vi.fn(),
  hasSupabaseConfig: vi.fn(() => true),
}));

vi.mock('@/lib/supabase/server', () => ({
  hasSupabaseConfig: mocks.hasSupabaseConfig,
  createClient: vi.fn(async () => ({
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      verifyOtp: mocks.verifyOtp,
    },
  })),
}));

vi.mock('@/lib/social/store', () => ({
  ensureSocialProfile: mocks.ensureSocialProfile,
}));

function request(path: string) {
  return new NextRequest(`https://juicio-publico.vercel.app${path}`);
}

describe('rutas de autenticacion', () => {
  beforeEach(() => {
    mocks.hasSupabaseConfig.mockReturnValue(true);
    mocks.verifyOtp.mockResolvedValue({ error: null });
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    mocks.ensureSocialProfile.mockResolvedValue(undefined);
  });

  it('confirma el correo con token_hash y envia al juego', async () => {
    const response = await confirmEmail(request('/auth/confirm?token_hash=valid-token&type=email'));

    expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: 'valid-token', type: 'email' });
    expect(mocks.ensureSocialProfile).toHaveBeenCalledOnce();
    expect(response.headers.get('location')).toBe('https://juicio-publico.vercel.app/jugar');
  });

  it('envia tokens invalidos al login con un error claro', async () => {
    mocks.verifyOtp.mockResolvedValue({ error: new Error('Token expired') });

    const response = await confirmEmail(request('/auth/confirm?token_hash=expired&type=email'));

    expect(response.headers.get('location')).toBe(
      'https://juicio-publico.vercel.app/login?error=auth-code',
    );
  });

  it('rechaza destinos externos en la confirmacion', async () => {
    const response = await confirmEmail(
      request('/auth/confirm?token_hash=valid-token&type=email&next=//example.com'),
    );

    expect(response.headers.get('location')).toBe('https://juicio-publico.vercel.app/jugar');
  });

  it('mantiene el callback OAuth y evita su antigua ruta 404', async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: new Error('Invalid code') });

    const response = await completeOAuth(request('/auth/callback?code=invalid'));

    expect(response.headers.get('location')).toBe(
      'https://juicio-publico.vercel.app/login?error=auth-code',
    );
  });
});
