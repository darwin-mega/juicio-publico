import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export type MultiSession = {
  roomId: string;
  deviceId: string;
  isHost: boolean;
  issuedAt: number;
  version: 1;
};

const COOKIE_MAX_AGE_SEC = 4 * 60 * 60;
const DEV_SESSION_SECRET = 'juicio-publico-multi-dev-secret';

function getSessionSecret() {
  const configured =
    process.env.JUICIO_MULTI_SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN;

  if (configured) return configured;

  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
    throw new Error('Falta JUICIO_MULTI_SESSION_SECRET para firmar sesiones multi en produccion.');
  }

  return DEV_SESSION_SECRET;
}

function toBase64Url(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function fromBase64Url(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(value: string) {
  return createHmac('sha256', getSessionSecret()).update(value).digest('base64url');
}

export function getMultiSessionCookieName(roomId: string) {
  return `jp_multi_${roomId.toUpperCase()}`;
}

export function createMultiSessionValue(roomId: string, deviceId: string, isHost: boolean) {
  const payload: MultiSession = {
    roomId: roomId.toUpperCase(),
    deviceId,
    isHost,
    issuedAt: Date.now(),
    version: 1,
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function readMultiSession(req: NextRequest, roomId: string): MultiSession | null {
  const rawCookie = req.cookies.get(getMultiSessionCookieName(roomId))?.value;
  if (!rawCookie) return null;

  const [encodedPayload, providedSignature] = rawCookie.split('.');
  if (!encodedPayload || !providedSignature) return null;

  const expectedSignature = sign(encodedPayload);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(fromBase64Url(encodedPayload)) as MultiSession;
    if (parsed.version !== 1 || parsed.roomId !== roomId.toUpperCase()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setMultiSessionCookie(
  response: NextResponse,
  roomId: string,
  deviceId: string,
  isHost: boolean
) {
  response.cookies.set({
    name: getMultiSessionCookieName(roomId),
    value: createMultiSessionValue(roomId, deviceId, isHost),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SEC,
  });
}

export function requireMultiSession(
  req: NextRequest,
  roomId: string,
  deviceId: string,
  options: { hostOnly?: boolean } = {}
): MultiSession | NextResponse {
  const session = readMultiSession(req, roomId);

  if (!session || session.deviceId !== deviceId) {
    return NextResponse.json({ error: 'Sesion invalida o expirada.' }, { status: 401 });
  }

  if (options.hostOnly && !session.isHost) {
    return NextResponse.json({ error: 'Solo el host puede realizar esta accion.' }, { status: 403 });
  }

  return session;
}
