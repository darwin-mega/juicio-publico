// app/api/multi/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createRoomIfAbsent } from '@/lib/multi/redis';
import { generateRoomId } from '@/lib/multi/gameLogic';
import { issuePlayerCredential } from '@/lib/multi/auth';
import { setMultiSessionCookie } from '@/lib/multi/session';
import { createClient as createSupabaseClient, hasSupabaseConfig } from '@/lib/supabase/server';
import type { MultiRoomState, MultiPlayer } from '@/lib/multi/types';

function getAccountDisplayName(user: { user_metadata?: Record<string, unknown>; email?: string } | null | undefined) {
  const metadata = user?.user_metadata ?? {};
  const value = metadata.username || metadata.full_name || metadata.name || user?.email?.split('@')[0];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { config, hostName, deviceId } = body;
    const headerDeviceId = req.headers.get('X-Device-Id');

    if (!deviceId || deviceId !== headerDeviceId || !hostName?.trim()) {
      return NextResponse.json({ error: 'Faltan datos obligatorios.' }, { status: 400 });
    }

    let roomId = generateRoomId();

    let accountId: string | undefined;
    let accountDisplayName: string | undefined;
    if (hasSupabaseConfig()) {
      const supabase = await createSupabaseClient();
      const { data } = await supabase.auth.getUser();
      accountId = data.user?.id;
      accountDisplayName = getAccountDisplayName(data.user);
    }

    const hostPlayer: MultiPlayer = {
      deviceId,
      accountId,
      accountDisplayName,
      name: hostName.trim(),
      joinedAt: Date.now(),
      lastSeenAt: Date.now(),
      status: 'active',
      isAlive: true,
      isRevealed: false,
      readyForOperative: false,
    };

    const room: MultiRoomState = {
      roomId,
      hostId: deviceId,
      status: 'lobby',
      config: {
        killerCount: config?.killerCount ?? 1,
        copCount: config?.copCount ?? 1,
        trialDurationSeconds: config?.trialDurationSeconds ?? 120,
      },
      players: [hostPlayer],
      game: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    let created = await createRoomIfAbsent(room);
    for (let attempt = 0; !created && attempt < 5; attempt += 1) {
      roomId = generateRoomId();
      room.roomId = roomId;
      created = await createRoomIfAbsent(room);
    }
    if (!created) return NextResponse.json({ error: 'No se pudo generar una sala unica.' }, { status: 503 });

    const credential = await issuePlayerCredential(roomId, deviceId);

    const response = NextResponse.json({ roomId, room, credential });
    setMultiSessionCookie(response, roomId, deviceId, true);
    return response;
  } catch (err) {
    console.error('[multi/create]', err);
    return NextResponse.json({ error: 'Error interno al crear la sala.' }, { status: 500 });
  }
}
