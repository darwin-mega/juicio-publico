import { NextResponse } from 'next/server';
import { RoomBusyError } from './redis';

export function routeError(context: string, error: unknown): NextResponse {
  if (error instanceof RoomBusyError) {
    return NextResponse.json(
      { error: 'La sala está procesando otra acción. Reintentá.' },
      { status: 409, headers: { 'Retry-After': '1' } }
    );
  }

  console.error(context, error instanceof Error
    ? { name: error.name, message: error.message }
    : { message: 'Error desconocido' });
  return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
}
