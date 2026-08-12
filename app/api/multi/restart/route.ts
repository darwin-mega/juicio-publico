import { NextRequest, NextResponse } from 'next/server';
import {
  deleteOperativeProposal,
  getRoom,
  saveRoom,
  saveSecret,
  withRoomLock,
} from '@/lib/multi/redis';
import { assignMultiRoles, createInitialGameState } from '@/lib/multi/gameLogic';
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
        return NextResponse.json({ error: 'Sala no encontrada.' }, { status: 404 });
      }
      if (!(await authenticatePlayer(req, roomId, room))) {
        return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
      }
      if (room.hostId !== deviceId) {
        return NextResponse.json({ error: 'Solo el host puede reiniciar la partida.' }, { status: 403 });
      }
      if (!room.game.isOver) {
        return NextResponse.json({ error: 'La partida todavía no terminó.' }, { status: 409 });
      }

      const resetPlayers = room.players.map((player) => ({
        ...player,
        isAlive: true,
        isRevealed: false,
        readyForOperative: false,
      }));
      const secrets = assignMultiRoles(resetPlayers, room.config);
      for (const [playerId, secret] of Object.entries(secrets)) {
        await saveSecret(roomId, playerId, secret);
        await deleteOperativeProposal(roomId, playerId);
      }

      const updatedRoom = {
        ...room,
        status: 'playing' as const,
        players: resetPlayers,
        game: createInitialGameState(resetPlayers),
        updatedAt: Date.now(),
      };
      await saveRoom(updatedRoom);
      return NextResponse.json(updatedRoom);
    });
  } catch (error) {
    return routeError('[multi/restart]', error);
  }
}
