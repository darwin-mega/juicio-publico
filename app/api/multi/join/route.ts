import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom, withRoomLock } from '@/lib/multi/redis';
import { authenticatePlayer, issuePlayerCredential } from '@/lib/multi/auth';
import type { MultiPlayer } from '@/lib/multi/types';
import { isMatchingDeviceHeader, joinRoomSchema } from '@/lib/multi/validation';
import { parseJsonBody } from '@/lib/multi/request';
import { enforceRateLimit } from '@/lib/multi/rateLimit';
import { routeError } from '@/lib/multi/errors';
import { getOptionalAccountIdentity } from '@/lib/multi/account';

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseJsonBody(req, joinRoomSchema);
    if (!parsed.ok) return parsed.response;
    const { roomId, name, deviceId } = parsed.data;
    if (!isMatchingDeviceHeader(req.headers.get('X-Device-Id'), deviceId)) {
      return NextResponse.json({ error: 'Identidad de dispositivo inválida.' }, { status: 400 });
    }
    const limited = await enforceRateLimit(req, 'join', roomId);
    if (limited) return limited;
    const { accountId, accountDisplayName } = await getOptionalAccountIdentity();

    return withRoomLock(roomId, async () => {
      const room = await getRoom(roomId);
      if (!room) {
        return NextResponse.json({ error: 'Sala no encontrada.' }, { status: 404 });
      }

      const existing = room.players.find((player) => player.deviceId === deviceId);
      if (existing) {
        if (!(await authenticatePlayer(req, roomId, room))) {
          return NextResponse.json({ error: 'Credencial de reconexión inválida.' }, { status: 401 });
        }
        const updatedRoom = {
          ...room,
          players: room.players.map((player) => player.deviceId === deviceId ? {
            ...player,
            accountId: player.accountId ?? accountId,
            accountDisplayName: accountDisplayName ?? player.accountDisplayName,
            lastSeenAt: Date.now(),
            status: player.status ?? 'active',
          } : player),
          updatedAt: Date.now(),
        };
        await saveRoom(updatedRoom);
        return NextResponse.json({ room: updatedRoom, credential: req.headers.get('X-Player-Credential') });
      }

      if (room.status !== 'lobby') {
        return NextResponse.json({ error: 'La partida ya comenzó.' }, { status: 409 });
      }
      if (room.players.length >= 20) {
        return NextResponse.json({ error: 'La sala alcanzó el máximo de 20 jugadores.' }, { status: 409 });
      }
      if (accountId && room.players.some((player) => player.accountId === accountId)) {
        return NextResponse.json({ error: 'Esta cuenta ya está dentro de la sala.' }, { status: 409 });
      }
      if (room.players.some((player) => player.name.toLocaleLowerCase('es') === name.toLocaleLowerCase('es'))) {
        return NextResponse.json({ error: 'Ese nombre ya está en uso en esta sala.' }, { status: 409 });
      }

      const newPlayer: MultiPlayer = {
        deviceId,
        accountId,
        accountDisplayName,
        name,
        joinedAt: Date.now(),
        lastSeenAt: Date.now(),
        status: 'active',
        isAlive: true,
        isRevealed: false,
        readyForOperative: false,
      };
      const updatedRoom = {
        ...room,
        players: [...room.players, newPlayer],
        updatedAt: Date.now(),
      };

      await saveRoom(updatedRoom);
      const credential = await issuePlayerCredential(roomId, deviceId);
      return NextResponse.json({ room: updatedRoom, credential });
    });
  } catch (error) {
    return routeError('[multi/join]', error);
  }
}
