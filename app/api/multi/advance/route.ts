// app/api/multi/advance/route.ts
// El host avanza manualmente la fase publica.

import { NextRequest, NextResponse } from 'next/server';
import { mutateRoom } from '@/lib/multi/redis';
import { resetPendingActions } from '@/lib/multi/gameLogic';
import { requireMultiSession } from '@/lib/multi/session';
import type { MultiGameState, MultiRoomState } from '@/lib/multi/types';

const MANUAL_ADVANCE_PHASES: MultiGameState['phase'][] = ['news', 'trial', 'resolution'];
type AdvanceFailure = { error: string; status: number };

export async function POST(req: NextRequest) {
  try {
    const { roomId } = await req.json();
    const deviceId = req.headers.get('X-Device-Id');

    if (!roomId || !deviceId) {
      return NextResponse.json({ error: 'Faltan datos.' }, { status: 400 });
    }

    const session = requireMultiSession(req, roomId, deviceId, { hostOnly: true });
    if (session instanceof NextResponse) return session;

    const result = await mutateRoom<MultiRoomState | AdvanceFailure>(roomId, (room) => {
      if (!room.game) {
        return { error: 'Sala no encontrada.', status: 404 };
      }

      if (room.hostId !== deviceId) {
        return { error: 'Solo el host puede avanzar la fase.', status: 403 };
      }

      const current = room.game.phase;

      if (!MANUAL_ADVANCE_PHASES.includes(current)) {
        return { error: `La fase "${current}" no se puede avanzar manualmente.`, status: 400 };
      }

      let nextPhase: MultiGameState['phase'];
      let nextRound = room.game.round;

      if (room.game.isOver) {
        if (current !== 'news') {
          return { error: 'La partida ya termino.', status: 409 };
        }
        nextPhase = 'resolution';
      } else if (current === 'news') nextPhase = 'trial';
      else if (current === 'trial') nextPhase = 'vote';
      else {
        nextPhase = 'operative';
        nextRound = room.game.round + 1;
      }

      room.game.phase = nextPhase;
      room.game.round = nextRound;
      room.game.votes = nextPhase === 'operative' ? {} : room.game.votes;
      room.game.skippedVotes = nextPhase === 'vote' || nextPhase === 'operative' ? {} : room.game.skippedVotes;
      room.game.pendingActions =
        nextPhase === 'operative'
          ? resetPendingActions(room.players.filter((p) => p.isAlive))
          : room.game.pendingActions;
      room.game.trialStartedAt = nextPhase === 'trial' ? Date.now() : room.game.trialStartedAt;
      room.updatedAt = Date.now();

      return room;
    });

    if (!result) {
      return NextResponse.json({ error: 'Sala no encontrada.' }, { status: 404 });
    }

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[multi/advance]', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
