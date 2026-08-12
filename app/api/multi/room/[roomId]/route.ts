// app/api/multi/room/[roomId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getOperativeProposal, getRoom, getSecret, mutateRoom } from '@/lib/multi/redis';
import {
  deriveTeamOperativeSelection,
  getAliveTeamMemberIds,
  getCoordinatedTeamKey,
} from '@/lib/multi/gameLogic';
import { requireMultiSession } from '@/lib/multi/session';
import type { MultiRoomState, OperativeProposal, PlayerOperativeAction } from '@/lib/multi/types';

function sanitizeRoomPlayers(room: MultiRoomState): MultiRoomState {
  return {
    ...room,
    players: room.players.map(({ accountId: _accountId, accountDisplayName: _accountDisplayName, ...player }) => player),
  };
}

function maskPendingActions(
  pendingActions: Record<string, PlayerOperativeAction | null>,
  viewerDeviceId: string | null
) {
  return Object.fromEntries(
    Object.entries(pendingActions).map(([deviceId, action]) => {
      if (!action) {
        return [deviceId, null];
      }

      if (viewerDeviceId && deviceId === viewerDeviceId) {
        return [deviceId, action];
      }

      return [
        deviceId,
        {
          type: 'neutral',
          targetId: null,
          submittedAt: action.submittedAt,
        } satisfies PlayerOperativeAction,
      ];
    })
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    if (!roomId) {
      return NextResponse.json({ error: 'roomId requerido.' }, { status: 400 });
    }

    let room = await getRoom(roomId);
    if (!room) {
      return NextResponse.json({ error: 'Sala no encontrada.' }, { status: 404 });
    }

    const requestedViewerDeviceId = req.headers.get('X-Device-Id');
    const session = requestedViewerDeviceId
      ? requireMultiSession(req, roomId, requestedViewerDeviceId)
      : null;
    const viewerDeviceId = session && !(session instanceof NextResponse)
      ? requestedViewerDeviceId
      : null;

    if (viewerDeviceId) {
      const touchedRoom = await mutateRoom(roomId, (currentRoom) => {
        const player = currentRoom.players.find((p) => p.deviceId === viewerDeviceId);
        if (player && (player.status ?? 'active') === 'active') {
          player.lastSeenAt = Date.now();
        }
        return currentRoom;
      });
      if (touchedRoom) room = touchedRoom;
    }

    if (!room.game) {
      return NextResponse.json(sanitizeRoomPlayers(room));
    }

    const secret = viewerDeviceId ? await getSecret(roomId, viewerDeviceId) : null;

    const sanitizedGame = {
      ...room.game,
      pendingActions: maskPendingActions(room.game.pendingActions, viewerDeviceId),
    };

    if (room.game.phase === 'operative' && secret) {
      const teamKey = getCoordinatedTeamKey(secret.role);
      if (teamKey) {
        const aliveTeamMemberIds = getAliveTeamMemberIds(secret, room.players);
        const pendingTeamMemberIds = aliveTeamMemberIds.filter((memberId) =>
          memberId === viewerDeviceId || room.game?.pendingActions[memberId] === null
        );
        if (pendingTeamMemberIds.length > 1) {
          const proposals = (await Promise.all(
            pendingTeamMemberIds.map(async (memberId) => {
              const proposal = await getOperativeProposal(roomId, memberId);
              if (!proposal || proposal.round !== room.game?.round) {
                return null;
              }
              return proposal;
            })
          )).filter((value): value is OperativeProposal => value !== null);

          const teamSelection = deriveTeamOperativeSelection(teamKey, proposals);
          if (teamSelection) {
            sanitizedGame.teamSelections = {
              [teamKey]: teamSelection,
            };
          }
        }
      }
    }

    return NextResponse.json({
      ...sanitizeRoomPlayers(room),
      game: sanitizedGame,
    });
  } catch (err) {
    console.error('[multi/room]', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
