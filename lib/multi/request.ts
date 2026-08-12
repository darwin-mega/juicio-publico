import { NextRequest, NextResponse } from 'next/server';
import type { z } from 'zod';

const MAX_JSON_BYTES = 8 * 1024;

type ParsedBody<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

export async function parseJsonBody<TSchema extends z.ZodType>(
  req: NextRequest,
  schema: TSchema
): Promise<ParsedBody<z.infer<TSchema>>> {
  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BYTES) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Solicitud demasiado grande.' }, { status: 413 }),
    };
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }),
    };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 }),
    };
  }

  return { ok: true, data: parsed.data };
}
