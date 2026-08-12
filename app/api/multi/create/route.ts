import { NextRequest, NextResponse } from 'next/server';
import { createRoomIfAbsent, deleteRoomData } from '@/lib/multi/redis';
import { issuePlayerCredential } from '@/lib/multi/auth';
import { generateRoomId } from '@/lib/multi/gameLogic';
import type { MultiRoomState, MultiPlayer } from '@/lib/multi/types';
import { createRoomSchema, isMatchingDeviceHeader } from '@/lib/multi/validation';
import { parseJsonBody } from '@/lib/multi/request';
import { enforceRateLimit } from '@/lib/multi/rateLimit';
import { routeError } from '@/lib/multi/errors';
import { getOptionalAccountIdentity } from '@/lib/multi/account';

export async function POST(req: NextRequest) {
  let createdRoom: MultiRoomState | null = null;
  try {
    const limited = await enforceRateLimit(req, 'create');
    if (limited) return limited;

    const parsed = await parseJsonBody(req, createRoomSchema);
    if (!parsed.ok) return parsed.response;
    const { config, hostName, deviceId } = parsed.data;
    if (!isMatchingDeviceHeader(req.headers.get('X-Device-Id'), deviceId)) {
      return NextResponse.json({ error: 'Identidad de dispositivo inválida.' }, { status: 400 });
    }

    const now = Date.now();
    const { accountId, accountDisplayName } = await getOptionalAccountIdentity();
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const roomId = generateRoomId();
      const hostPlayer: MultiPlayer = {
        deviceId,
        accountId,
        accountDisplayName,
        name: hostName,
        joinedAt: now,
        lastSeenAt: now,
        status: 'active',
        isAlive: true,
        isRevealed: false,
        readyForOperative: false,
      };
      const candidate: MultiRoomState = {
        roomId,
        hostId: deviceId,
        status: 'lobby',
        config,
        players: [hostPlayer],
        game: null,
        createdAt: now,
        updatedAt: now,
      };

      if (await createRoomIfAbsent(candidate)) {
        createdRoom = candidate;
        const credential = await issuePlayerCredential(roomId, deviceId);
        return NextResponse.json({ roomId, room: candidate, credential });
      }
    }

    return NextResponse.json({ error: 'No se pudo reservar un código de sala.' }, { status: 503 });
  } catch (error) {
    if (createdRoom) await deleteRoomData(createdRoom).catch(() => undefined);
    return routeError('[multi/create]', error);
  }
}
