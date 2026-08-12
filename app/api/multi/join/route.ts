// app/api/multi/join/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSecret, mutateRoom, saveSecret } from '@/lib/multi/redis';
import { setMultiSessionCookie } from '@/lib/multi/session';
import { createClient as createSupabaseClient, hasSupabaseConfig } from '@/lib/supabase/server';
import type { MultiPlayer, MultiRoomState } from '@/lib/multi/types';

type JoinFailure = { error: string; status: number };

function getAccountDisplayName(user: { user_metadata?: Record<string, unknown>; email?: string } | null | undefined) {
  const metadata = user?.user_metadata ?? {};
  const value = metadata.username || metadata.full_name || metadata.name || user?.email?.split('@')[0];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function replaceDeviceId(room: MultiRoomState, oldDeviceId: string, newDeviceId: string) {
  if (oldDeviceId === newDeviceId) return;

  if (room.hostId === oldDeviceId) room.hostId = newDeviceId;

  if (room.game) {
    const replaceMapKey = <T>(map: Record<string, T>) => {
      if (Object.prototype.hasOwnProperty.call(map, oldDeviceId)) {
        map[newDeviceId] = map[oldDeviceId];
        delete map[oldDeviceId];
      }
    };

    replaceMapKey(room.game.pendingActions);
    replaceMapKey(room.game.votes);
    replaceMapKey(room.game.skippedVotes ?? {});

    room.game.votes = Object.fromEntries(
      Object.entries(room.game.votes).map(([voterId, targetId]) => [
        voterId,
        targetId === oldDeviceId ? newDeviceId : targetId,
      ])
    );

    if (room.game.teamSelections) {
      for (const selection of Object.values(room.game.teamSelections)) {
        if (!selection) continue;
        selection.targetPlayerId = selection.targetPlayerId === oldDeviceId ? newDeviceId : selection.targetPlayerId;
        selection.confirmedBy = selection.confirmedBy.map((id) => id === oldDeviceId ? newDeviceId : id);
      }
    }

    room.game.progressEvents = (room.game.progressEvents ?? []).map((event) => ({
      ...event,
      actorId: event.actorId === oldDeviceId ? newDeviceId : event.actorId,
      targetId: event.targetId === oldDeviceId ? newDeviceId : event.targetId,
    }));
  }
}

export async function POST(req: NextRequest) {
  try {
    const { roomId, name, deviceId } = await req.json();

    if (!roomId || !name?.trim() || !deviceId) {
      return NextResponse.json({ error: 'Faltan datos obligatorios.' }, { status: 400 });
    }

    let accountId: string | undefined;
    let accountDisplayName: string | undefined;
    if (hasSupabaseConfig()) {
      const supabase = await createSupabaseClient();
      const { data } = await supabase.auth.getUser();
      accountId = data.user?.id;
      accountDisplayName = getAccountDisplayName(data.user);
    }

    const result = await mutateRoom<MultiRoomState | JoinFailure>(roomId, async (room) => {
      if (room.status !== 'lobby') {
        const existing = room.players.find((p) => p.deviceId === deviceId);
        if (existing) {
          if (accountId && !existing.accountId) {
            existing.accountId = accountId;
          }
          if (accountDisplayName) existing.accountDisplayName = accountDisplayName;
          existing.lastSeenAt = Date.now();
          existing.status = existing.status ?? 'active';
          room.updatedAt = Date.now();
          return room;
        }

        const accountPlayer = accountId
          ? room.players.find((p) => p.accountId === accountId)
          : null;
        if (accountPlayer) {
          const previousDeviceId = accountPlayer.deviceId;
          const previousSecret = await getSecret(room.roomId, previousDeviceId);
          replaceDeviceId(room, previousDeviceId, deviceId);
          accountPlayer.deviceId = deviceId;
          accountPlayer.accountDisplayName = accountDisplayName ?? accountPlayer.accountDisplayName;
          accountPlayer.lastSeenAt = Date.now();
          accountPlayer.status = accountPlayer.status ?? 'active';
          if (previousSecret) {
            await saveSecret(room.roomId, deviceId, {
              ...previousSecret,
              deviceId,
              teammateIds: previousSecret.teammateIds.map((id) => id === previousDeviceId ? deviceId : id),
            });
          }
          await Promise.all(room.players
            .filter((player) => player.deviceId !== deviceId)
            .map(async (player) => {
              const secret = await getSecret(room.roomId, player.deviceId);
              if (!secret?.teammateIds.includes(previousDeviceId)) return;
              await saveSecret(room.roomId, player.deviceId, {
                ...secret,
                teammateIds: secret.teammateIds.map((id) => id === previousDeviceId ? deviceId : id),
              });
            }));
          room.updatedAt = Date.now();
          return room;
        }
        return { error: 'La partida ya comenzo.', status: 409 };
      }

      const already = room.players.find((p) => p.deviceId === deviceId);
      if (already) {
        if (accountId && !already.accountId) {
          already.accountId = accountId;
        }
        if (accountDisplayName) already.accountDisplayName = accountDisplayName;
        already.lastSeenAt = Date.now();
        already.status = already.status ?? 'active';
        room.updatedAt = Date.now();
        return room;
      }

      if (accountId && room.players.some((p) => p.accountId === accountId)) {
        return { error: 'Esta cuenta ya esta dentro de la sala.', status: 409 };
      }

      const nameTaken = room.players.some(
        (p) => p.name.toLowerCase() === name.trim().toLowerCase()
      );
      if (nameTaken) {
        return { error: 'Ese nombre ya esta en uso en esta sala.', status: 409 };
      }

      const newPlayer: MultiPlayer = {
        deviceId,
        accountId,
        accountDisplayName,
        name: name.trim(),
        joinedAt: Date.now(),
        lastSeenAt: Date.now(),
        status: 'active',
        isAlive: true,
        isRevealed: false,
        readyForOperative: false,
      };

      room.players.push(newPlayer);
      room.updatedAt = Date.now();
      return room;
    });

    if (!result) {
      return NextResponse.json({ error: 'Sala no encontrada.' }, { status: 404 });
    }

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const response = NextResponse.json(result);
    setMultiSessionCookie(response, result.roomId, deviceId, result.hostId === deviceId);
    return response;
  } catch (err) {
    console.error('[multi/join]', err);
    return NextResponse.json({ error: 'Error interno al unirse a la sala.' }, { status: 500 });
  }
}
