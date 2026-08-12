// app/api/multi/room/[roomId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getOperativeProposal, getRoom, getSecret } from '@/lib/multi/redis';
import {
  deriveTeamOperativeSelection,
  getAliveTeamMemberIds,
  getCoordinatedTeamKey,
} from '@/lib/multi/gameLogic';
import type { OperativeProposal, PlayerOperativeAction } from '@/lib/multi/types';
import { authenticatePlayer } from '@/lib/multi/auth';
import { roomIdSchema } from '@/lib/multi/validation';
import { enforceRateLimit } from '@/lib/multi/rateLimit';
import { routeError } from '@/lib/multi/errors';

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
    const roomIdResult = roomIdSchema.safeParse((await params).roomId);
    if (!roomIdResult.success) {
      return NextResponse.json({ error: 'roomId requerido.' }, { status: 400 });
    }
    const roomId = roomIdResult.data;
    const limited = await enforceRateLimit(req, 'poll', roomId);
    if (limited) return limited;

    const room = await getRoom(roomId);
    if (!room) {
      return NextResponse.json({ error: 'Sala no encontrada.' }, { status: 404 });
    }
    const viewerDeviceId = await authenticatePlayer(req, roomId, room);
    if (!viewerDeviceId) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    if (!room.game) {
      return NextResponse.json(room);
    }

    const secret = await getSecret(roomId, viewerDeviceId);

    const sanitizedGame = {
      ...room.game,
      pendingActions: maskPendingActions(room.game.pendingActions, viewerDeviceId),
    };

    if (room.game.phase === 'operative' && secret) {
      const teamKey = getCoordinatedTeamKey(secret.role);
      if (teamKey) {
        const aliveTeamMemberIds = getAliveTeamMemberIds(secret, room.players);
        if (aliveTeamMemberIds.length > 1) {
          const proposals = (await Promise.all(
            aliveTeamMemberIds.map(async (memberId) => {
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
      ...room,
      game: sanitizedGame,
    });
  } catch (error) {
    return routeError('[multi/room]', error);
  }
}
