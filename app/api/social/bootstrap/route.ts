import { NextResponse } from 'next/server';
import { ensureSocialProfile } from '@/lib/social/store';

export async function POST() {
  try {
    return NextResponse.json({ profile: await ensureSocialProfile() });
  } catch (error) {
    console.error('[social/bootstrap]', error);
    return NextResponse.json({ error: 'No se pudo inicializar el perfil social.' }, { status: 500 });
  }
}
