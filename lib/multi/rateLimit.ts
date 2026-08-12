import { createHmac } from 'node:crypto';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';

type RateLimitScope = 'create' | 'join' | 'command' | 'poll';

const LIMITS: Record<RateLimitScope, { requests: number; window: `${number} ${'s' | 'm' | 'h'}` }> = {
  create: { requests: 10, window: '10 m' },
  join: { requests: 30, window: '10 m' },
  command: { requests: 120, window: '1 m' },
  poll: { requests: 180, window: '1 m' },
};

const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const hmacSecret = process.env.RATE_LIMIT_SALT || redisToken || 'local-development-only';

const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;
const limiters = new Map<RateLimitScope, Ratelimit>();
const localWindows = new Map<string, { count: number; reset: number }>();

function getLimiter(scope: RateLimitScope): Ratelimit {
  const existing = limiters.get(scope);
  if (existing) return existing;
  if (!redis) throw new Error('Redis no está configurado para rate limiting.');

  const config = LIMITS[scope];
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(config.requests, config.window),
    analytics: false,
    prefix: `jp:ratelimit:${scope}`,
    timeout: 2_000,
  });
  limiters.set(scope, limiter);
  return limiter;
}

function requestFingerprint(req: NextRequest): string {
  const forwarded = req.headers.get('x-vercel-forwarded-for')
    || req.headers.get('x-forwarded-for')
    || 'unknown';
  const ip = forwarded.split(',')[0]?.trim() || 'unknown';
  return createHmac('sha256', hmacSecret).update(ip).digest('hex').slice(0, 32);
}

function localLimit(scope: RateLimitScope, identifier: string) {
  const config = LIMITS[scope];
  const windowMs = config.window.endsWith(' m')
    ? Number.parseInt(config.window, 10) * 60_000
    : config.window.endsWith(' h')
      ? Number.parseInt(config.window, 10) * 3_600_000
      : Number.parseInt(config.window, 10) * 1_000;
  const now = Date.now();
  const key = `${scope}:${identifier}`;
  const current = localWindows.get(key);
  const entry = !current || current.reset <= now
    ? { count: 0, reset: now + windowMs }
    : current;
  entry.count += 1;
  localWindows.set(key, entry);
  return {
    success: entry.count <= config.requests,
    remaining: Math.max(0, config.requests - entry.count),
    reset: entry.reset,
  };
}

export async function enforceRateLimit(
  req: NextRequest,
  scope: RateLimitScope,
  subject = ''
): Promise<NextResponse | null> {
  const identifier = `${requestFingerprint(req)}:${subject}`;
  const result = redis
    ? await getLimiter(scope).limit(identifier)
    : process.env.NODE_ENV === 'production'
      ? (() => { throw new Error('Redis requerido para rate limiting en producción.'); })()
      : localLimit(scope, identifier);

  if (result.success) return null;

  const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
  return NextResponse.json(
    { error: 'Demasiadas solicitudes. Intentá nuevamente en unos segundos.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(result.reset),
      },
    }
  );
}
