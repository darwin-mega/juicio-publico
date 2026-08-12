import { NextRequest, NextResponse } from 'next/server';
import { searchUsers } from '@/lib/social/store';

export async function GET(req: NextRequest) {
  try {
    const query = new URL(req.url).searchParams.get('q') ?? '';
    return NextResponse.json({ users: await searchUsers(query) });
  } catch (error) {
    console.error('[social/search]', error);
    return NextResponse.json({ error: 'No se pudo buscar usuarios.' }, { status: 500 });
  }
}
