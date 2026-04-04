import { NextRequest, NextResponse } from 'next/server';
import { deleteOperativeProposal, getRoom, saveRoom, saveSecret } from '@/lib/multi/redis';
import { assignMultiRoles, createInitialGameState } from '@/lib/multi/gameLogic';

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
      return NextResponse.json({ error: 'Solo el host puede reiniciar la partida.' }, { status: 403 });
    }

    if (!room.game.isOver) {
      return NextResponse.json({ error: 'La partida todavia no termino.' }, { status: 409 });
    }

    const resetPlayers = room.players.map((player) => ({
      ...player,
      isAlive: true,
      isRevealed: false,
      readyForOperative: false,
    }));

    const secrets = assignMultiRoles(resetPlayers, room.config);

    for (const [pid, secret] of Object.entries(secrets)) {
      await saveSecret(roomId, pid, secret);
      await deleteOperativeProposal(roomId, pid);
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
  } catch (err) {
    console.error('[multi/restart]', err);
    return NextResponse.json({ error: 'Error interno al reiniciar la partida.' }, { status: 500 });
  }
}
