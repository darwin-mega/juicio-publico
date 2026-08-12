import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom, withRoomLock } from '@/lib/multi/redis';
import { authenticatePlayer } from '@/lib/multi/auth';
import { roomCommandSchema } from '@/lib/multi/validation';
import { parseJsonBody } from '@/lib/multi/request';
import { enforceRateLimit } from '@/lib/multi/rateLimit';
import { routeError } from '@/lib/multi/errors';

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseJsonBody(req, roomCommandSchema);
    if (!parsed.ok) return parsed.response;
    const { roomId } = parsed.data;
    const deviceId = req.headers.get('X-Device-Id');
    const limited = await enforceRateLimit(req, 'command', roomId);
    if (limited) return limited;
    if (!deviceId) {
      return NextResponse.json({ error: 'Identidad de dispositivo requerida.' }, { status: 400 });
    }

    return withRoomLock(roomId, async () => {
      const room = await getRoom(roomId);
      if (!room || !room.game) {
        return NextResponse.json({ error: 'Sala o juego no encontrado.' }, { status: 404 });
      }
      if (!(await authenticatePlayer(req, roomId, room))) {
        return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
      }
      if (room.game.phase !== 'reveal') {
        return NextResponse.json({ error: 'No es la fase de revelación.' }, { status: 409 });
      }

      const updatedPlayers = room.players.map((player) =>
        player.deviceId === deviceId ? { ...player, readyForOperative: true } : player
      );
      const allReady = updatedPlayers
        .filter((player) => player.isAlive)
        .every((player) => player.readyForOperative);
      const updatedRoom = {
        ...room,
        players: updatedPlayers,
        game: {
          ...room.game,
          phase: allReady ? ('operative' as const) : room.game.phase,
        },
        updatedAt: Date.now(),
      };
      await saveRoom(updatedRoom);
      return NextResponse.json(updatedRoom);
    });
  } catch (error) {
    return routeError('[multi/reveal-ready]', error);
  }
}
