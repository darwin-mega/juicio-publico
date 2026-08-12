import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/multi/rateLimit';

const MAX_BODY_BYTES = 8 * 1024;

export async function proxy(request: NextRequest) {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Solicitud demasiado grande.' }, { status: 413 });
  }

  const path = request.nextUrl.pathname;
  const scope = path.endsWith('/create')
    ? 'create'
    : path.endsWith('/join')
      ? 'join'
      : request.method === 'GET'
        ? 'poll'
        : 'command';

  try {
    const limited = await enforceRateLimit(request, scope);
    return limited ?? NextResponse.next();
  } catch (error) {
    console.error('[multi/proxy] rate limit unavailable', error);
    return NextResponse.json({ error: 'Servicio temporalmente no disponible.' }, { status: 503 });
  }
}

export const config = {
  matcher: '/api/multi/:path*',
};
