import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom, withRoomLock } from '@/lib/multi/redis';
import { resetPendingActions } from '@/lib/multi/gameLogic';
import type { MultiGameState } from '@/lib/multi/types';
import { authenticatePlayer } from '@/lib/multi/auth';
import { roomCommandSchema } from '@/lib/multi/validation';
import { parseJsonBody } from '@/lib/multi/request';
import { enforceRateLimit } from '@/lib/multi/rateLimit';
import { routeError } from '@/lib/multi/errors';

const MANUAL_ADVANCE_PHASES: MultiGameState['phase'][] = ['news', 'trial', 'resolution'];

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
        return NextResponse.json({ error: 'Solo el host puede avanzar la fase.' }, { status: 403 });
      }
      const current = room.game.phase;
      if (!MANUAL_ADVANCE_PHASES.includes(current)) {
        return NextResponse.json({ error: `La fase "${current}" no se puede avanzar manualmente.` }, { status: 400 });
      }
      if (room.game.isOver) {
        return NextResponse.json({ error: 'La partida ya terminó.' }, { status: 409 });
      }

      let nextPhase: MultiGameState['phase'];
      let nextRound = room.game.round;
      if (current === 'news') nextPhase = 'trial';
      else if (current === 'trial') nextPhase = 'vote';
      else {
        nextPhase = 'operative';
        nextRound = room.game.round + 1;
      }

      const updatedGame: MultiGameState = {
        ...room.game,
        phase: nextPhase,
        round: nextRound,
        votes: nextPhase === 'operative' ? {} : room.game.votes,
        pendingActions: nextPhase === 'operative'
          ? resetPendingActions(room.players.filter((player) => player.isAlive))
          : room.game.pendingActions,
        trialStartedAt: nextPhase === 'trial' ? Date.now() : room.game.trialStartedAt,
      };
      const updatedRoom = { ...room, game: updatedGame, updatedAt: Date.now() };
      await saveRoom(updatedRoom);
      return NextResponse.json(updatedRoom);
    });
  } catch (error) {
    return routeError('[multi/advance]', error);
  }
}
