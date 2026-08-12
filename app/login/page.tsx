'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient, hasSupabaseConfig } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const supabaseConfigured = hasSupabaseConfig();
  const supabase = useMemo(() => (supabaseConfigured ? createClient() : null), [supabaseConfigured]);
  const isRegister = pathname.includes('register') || pathname.includes('registro');

  useEffect(() => {
    async function checkUser() {
      await Promise.resolve();
      setError(new URLSearchParams(window.location.search).get('error'));
      if (!supabase) {
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace('/jugar');
      } else {
        setLoading(false);
      }
    }

    void checkUser();
  }, [router, supabase]);

  async function handleOAuthLogin(provider: 'google' | 'apple') {
    if (!supabase) return;

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
          options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/jugar`,
        },
      });
      if (error) throw error;
    } catch {
      alert(`Error ${isRegister ? 'creando la cuenta' : 'iniciando sesion'}. Revisa Supabase.`);
    }
  }

  async function bootstrapSocialProfile() {
    try {
      await fetch('/api/social/bootstrap', { method: 'POST' });
    } catch (error) {
      console.warn('No se pudo inicializar el perfil social.', error);
    }
  }

  async function handleEmailAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || submitting) return;

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      if (isRegister) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) throw error;

        if (data.session) {
          await bootstrapSocialProfile();
          router.replace('/jugar');
          return;
        }

        setNotice('Cuenta creada. Revisa tu correo para confirmar el acceso.');
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await bootstrapSocialProfile();
      router.replace('/jugar');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo completar el acceso.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff' }}>
        <div>Cargando...</div>
      </div>
    );
  }

  return (
    <main style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', background: '#000' }}>
      <div style={{ maxWidth: 400, width: '100%', textAlign: 'center', padding: '2rem', background: '#111', borderRadius: '1rem', border: '1px solid #333' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#fff' }}>Juicio Publico</h1>
        <p style={{ color: '#999', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          {isRegister ? 'Crea tu cuenta para acceder al juego.' : 'Inicia sesion para acceder al juego.'}
        </p>

        {!supabaseConfigured && (
          <div style={{ marginBottom: '1rem', padding: '0.85rem', border: '1px solid #7f1d1d', borderRadius: 8, color: '#fecaca', background: '#1f0b0b', fontSize: '0.85rem', lineHeight: 1.45 }}>
            Falta configurar NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.
          </div>
        )}

        {error === 'auth-code' && (
          <div style={{ marginBottom: '1rem', padding: '0.85rem', border: '1px solid #7f1d1d', borderRadius: 8, color: '#fecaca', background: '#1f0b0b', fontSize: '0.85rem' }}>
            No se pudo completar el acceso. Intentalo otra vez.
          </div>
        )}

        {error && error !== 'auth-code' && error !== 'missing-config' && (
          <div style={{ marginBottom: '1rem', padding: '0.85rem', border: '1px solid #7f1d1d', borderRadius: 8, color: '#fecaca', background: '#1f0b0b', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {notice && (
          <div style={{ marginBottom: '1rem', padding: '0.85rem', border: '1px solid #14532d', borderRadius: 8, color: '#bbf7d0', background: '#07180d', fontSize: '0.85rem' }}>
            {notice}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              autoComplete="email"
              required
              disabled={!supabaseConfigured || submitting}
              style={{ width: '100%', boxSizing: 'border-box', background: '#050505', color: '#fff', border: '1px solid #333', padding: '12px', borderRadius: '8px', fontSize: '1rem' }}
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Contrasena"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              minLength={6}
              required
              disabled={!supabaseConfigured || submitting}
              style={{ width: '100%', boxSizing: 'border-box', background: '#050505', color: '#fff', border: '1px solid #333', padding: '12px', borderRadius: '8px', fontSize: '1rem' }}
            />
            <button disabled={!supabaseConfigured || submitting} type="submit" style={{
              background: '#ffffff', color: '#000000', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 700, cursor: supabaseConfigured && !submitting ? 'pointer' : 'not-allowed', opacity: supabaseConfigured && !submitting ? 1 : 0.5
            }}>
              {submitting ? 'Procesando...' : isRegister ? 'Crear cuenta' : 'Iniciar sesion'}
            </button>
          </form>

          <div style={{ height: 1, backgroundColor: '#333', margin: '0.6rem 0' }} />

          <button disabled={!supabaseConfigured} type="button" onClick={() => handleOAuthLogin('google')} style={{
            background: '#111', color: '#ddd', border: '1px solid #333', padding: '12px', borderRadius: '8px', fontWeight: 600, cursor: supabaseConfigured ? 'pointer' : 'not-allowed', opacity: supabaseConfigured ? 1 : 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10
          }}>
            Continuar con Google
          </button>

          <button disabled type="button" style={{
            background: '#0a0a0a', color: '#777', border: '1px solid #222', padding: '12px', borderRadius: '8px', fontWeight: 600, cursor: 'not-allowed', opacity: 0.65
          }}>
            Apple no disponible aun
          </button>

          <p style={{ color: '#888', fontSize: '0.78rem', lineHeight: 1.4, margin: 0 }}>
            Tambien puedes usar email y contrasena.
          </p>

          <button onClick={() => router.push(isRegister ? '/login' : '/registro')} style={{ marginTop: '0.75rem', background: 'transparent', color: '#bbb', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>
            {isRegister ? 'Ya tengo cuenta' : 'Crear cuenta'}
          </button>
        </div>
      </div>
    </main>
  );
}

