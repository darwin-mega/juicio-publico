// app/api/multi/action/route.ts
// Recibe la acción del operativo de cada jugador.
// Cuando todos los vivos enviaron acción → resuelve automáticamente
// y avanza a la fase de news.

import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom, getSecret } from '@/lib/multi/redis';
import {
  allActionsSubmitted,
  resolveMultiOperative,
  checkMultiWinCondition,
  resetPendingActions,
} from '@/lib/multi/gameLogic';
import type { PlayerOperativeAction, PlayerSecret } from '@/lib/multi/types';

export async function POST(req: NextRequest) {
  try {
    const { roomId, action } = await req.json() as {
      roomId: string;
      action: Omit<PlayerOperativeAction, 'submittedAt'>;
    };
    const deviceId = req.headers.get('X-Device-Id');

    if (!roomId || !deviceId || !action) {
      return NextResponse.json({ error: 'Faltan datos.' }, { status: 400 });
    }

    const room = await getRoom(roomId);
    if (!room || !room.game) {
      return NextResponse.json({ error: 'Sala no encontrada.' }, { status: 404 });
    }

    if (room.game.phase !== 'operative') {
      return NextResponse.json({ error: 'No es la fase operativa.' }, { status: 409 });
    }

    // Verificar que el jugador esté vivo
    const player = room.players.find((p) => p.deviceId === deviceId);
    if (!player || !player.isAlive) {
      return NextResponse.json({ error: 'Jugador no válido o eliminado.' }, { status: 403 });
    }

    // Registrar la acción
    const submittedAction: PlayerOperativeAction = {
      ...action,
      submittedAt: Date.now(),
    };

    const updatedPendingActions = {
      ...room.game.pendingActions,
      [deviceId]: submittedAction,
    };

    const updatedGame = {
      ...room.game,
      pendingActions: updatedPendingActions,
    };

    let updatedRoom = { ...room, game: updatedGame, updatedAt: Date.now() };

    // ¿Todos actuaron? → resolver y avanzar a news
    if (allActionsSubmitted(updatedGame, room.players)) {
      // Cargar todos los secretos del servidor
      const secrets: Record<string, PlayerSecret> = {};
      for (const p of room.players.filter((p) => p.isAlive)) {
        const s = await getSecret(roomId, p.deviceId);
        if (s) secrets[p.deviceId] = s;
      }

      const { updatedPlayers, report, winnerFaction } = resolveMultiOperative(
        room.players,
        secrets,
        updatedPendingActions,
        room.game.round
      );

      const winner = winnerFaction ?? checkMultiWinCondition(updatedPlayers, secrets);

      updatedRoom = {
        ...updatedRoom,
        players: updatedPlayers,
        game: {
          ...updatedGame,
          phase: 'news',
          pendingActions: resetPendingActions(updatedPlayers),
          reports: [...room.game.reports, report],
          winnerFaction: winner,
          isOver: winner !== null,
        },
        updatedAt: Date.now(),
      };
    }

    await saveRoom(updatedRoom);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[multi/action]', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
