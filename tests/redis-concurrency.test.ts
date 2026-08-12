import { describe, expect, it } from 'vitest';
import {
  createRoomIfAbsent,
  deleteRoomData,
  getRoom,
  saveRoom,
  withRoomLock,
} from '@/lib/multi/redis';
import type { MultiRoomState } from '@/lib/multi/types';

function room(roomId: string): MultiRoomState {
  return {
    roomId,
    hostId: '75f6e437-0ee3-4ed1-8218-1f100b814ad8',
    status: 'lobby',
    config: { killerCount: 1, copCount: 1, trialDurationSeconds: 120 },
    players: [],
    game: null,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('almacenamiento multidispositivo', () => {
  it('reserva un código de sala de forma atómica', async () => {
    const candidate = room('ABC234');
    expect(await createRoomIfAbsent(candidate)).toBe(true);
    expect(await createRoomIfAbsent(candidate)).toBe(false);
    await deleteRoomData(candidate);
  });

  it('serializa mutaciones concurrentes de una misma sala', async () => {
    const initial = room('BCD234');
    await createRoomIfAbsent(initial);

    const increment = () => withRoomLock(initial.roomId, async () => {
      const current = await getRoom(initial.roomId);
      if (!current) throw new Error('Sala inexistente');
      await new Promise((resolve) => setTimeout(resolve, 20));
      await saveRoom({ ...current, updatedAt: current.updatedAt + 1 });
    });

    await Promise.all([increment(), increment(), increment()]);
    expect((await getRoom(initial.roomId))?.updatedAt).toBe(4);
    await deleteRoomData(initial);
  });
});
