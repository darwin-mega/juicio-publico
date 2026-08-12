import { NextResponse } from 'next/server';
import { getSocialSummary } from '@/lib/social/store';

export async function GET() {
  try {
    return NextResponse.json(await getSocialSummary());
  } catch (error) {
    console.error('[social/summary]', error);
    return NextResponse.json({ error: 'No se pudo cargar la capa social.' }, { status: 500 });
  }
}
