// app/api/multi/advance/route.ts
// El host avanza manualmente la fase pública.
// Aplica a: news → trial → vote (y resolution → operative para siguiente ronda)

import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom } from '@/lib/multi/redis';
import { resetPendingActions } from '@/lib/multi/gameLogic';
import type { MultiGameState } from '@/lib/multi/types';

const MANUAL_ADVANCE_PHASES: MultiGameState['phase'][] = ['news', 'trial', 'resolution'];

export async function POST(req: NextRequest) {
  try {
    const { roomId } = await req.json();
    const deviceId = req.headers.get('X-Device-Id');

    if (!roomId || !deviceId) {
      return NextResponse.json({ error: 'Faltan datos.' }, { status: 400 });
    }

    const room = await getRoom(roomId);
    if (!room || !room.game) {
      return NextResponse.json({ error: 'Sala no encontrada.' }, { status: 404 });
    }

    if (room.hostId !== deviceId) {
      return NextResponse.json({ error: 'Solo el host puede avanzar la fase.' }, { status: 403 });
    }

    const current = room.game.phase;

    if (!MANUAL_ADVANCE_PHASES.includes(current)) {
      return NextResponse.json(
        { error: `La fase "${current}" no se puede avanzar manualmente.` },
        { status: 400 }
      );
    }

    if (room.game.isOver) {
      return NextResponse.json({ error: 'La partida ya terminó.' }, { status: 409 });
    }

    // Determinar siguiente fase
    let nextPhase: MultiGameState['phase'];
    let nextRound = room.game.round;

    if (current === 'news') nextPhase = 'trial';
    else if (current === 'trial') nextPhase = 'vote';
    else {
      // resolution → operative (nueva ronda)
      nextPhase = 'operative';
      nextRound = room.game.round + 1;
    }

    const updatedGame: MultiGameState = {
      ...room.game,
      phase: nextPhase,
      round: nextRound,
      votes: nextPhase === 'operative' ? {} : room.game.votes,
      pendingActions:
        nextPhase === 'operative'
          ? resetPendingActions(room.players.filter((p) => p.isAlive))
          : room.game.pendingActions,
      trialStartedAt: nextPhase === 'trial' ? Date.now() : room.game.trialStartedAt,
    };

    const updatedRoom = { ...room, game: updatedGame, updatedAt: Date.now() };
    await saveRoom(updatedRoom);

    return NextResponse.json(updatedRoom);
  } catch (err) {
    console.error('[multi/advance]', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
