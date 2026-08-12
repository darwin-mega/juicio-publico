import { describe, expect, it } from 'vitest';
import {
  createRoomSchema,
  joinRoomSchema,
  operativeActionSchema,
  playerControlSchema,
  roomIdSchema,
} from '@/lib/multi/validation';
import {
  competitionSchema,
  friendshipActionSchema,
  rankingQuerySchema,
  roomInviteActionSchema,
  userSearchSchema,
} from '@/lib/social/validation';

describe('validación de entradas multidispositivo', () => {
  it('normaliza códigos válidos y rechaza caracteres ambiguos', () => {
    expect(roomIdSchema.parse(' abc234 ')).toBe('ABC234');
    expect(roomIdSchema.safeParse('ABCI23').success).toBe(false);
    expect(roomIdSchema.safeParse('ABC120').success).toBe(false);
  });

  it('acepta la configuración utilizada por el juego', () => {
    const result = createRoomSchema.parse({
      config: { killerCount: 1, copCount: 1, trialDurationSeconds: 120 },
      hostName: ' Darwin ',
      deviceId: '75f6e437-0ee3-4ed1-8218-1f100b814ad8',
    });
    expect(result.hostName).toBe('Darwin');
  });

  it('rechaza nombres con controles y dispositivos no UUID', () => {
    expect(joinRoomSchema.safeParse({
      roomId: 'ABC234',
      name: 'Jugador\nInyectado',
      deviceId: 'no-es-uuid',
    }).success).toBe(false);
  });

  it('obliga a que cada tipo de acción tenga un objetivo correcto', () => {
    const targetId = '75f6e437-0ee3-4ed1-8218-1f100b814ad8';
    expect(operativeActionSchema.safeParse({ type: 'kill', targetId }).success).toBe(true);
    expect(operativeActionSchema.safeParse({ type: 'kill', targetId: null }).success).toBe(false);
    expect(operativeActionSchema.safeParse({ type: 'neutral', targetId: null }).success).toBe(true);
  });
});

describe('validación de entradas sociales', () => {
  const userId = '75f6e437-0ee3-4ed1-8218-1f100b814ad8';

  it('limita búsquedas, nombres y listas para evitar abuso', () => {
    expect(userSearchSchema.safeParse('a'.repeat(49)).success).toBe(false);
    expect(competitionSchema.safeParse({
      name: 'x'.repeat(61),
      durationType: 'monthly',
      inviteeIds: [],
    }).success).toBe(false);
    expect(competitionSchema.safeParse({
      name: 'Liga de amigos',
      durationType: 'monthly',
      inviteeIds: Array.from({ length: 51 }, () => userId),
    }).success).toBe(false);
  });

  it('rechaza identificadores y acciones sociales no permitidas', () => {
    expect(friendshipActionSchema.safeParse({ targetUserId: 'no-uuid' }).success).toBe(false);
    expect(roomInviteActionSchema.safeParse({
      roomId: 'ABC234',
      inviteeIds: [userId],
      extra: true,
    }).success).toBe(false);
    expect(playerControlSchema.safeParse({
      roomId: 'ABC234',
      targetDeviceId: userId,
      action: 'delete',
    }).success).toBe(false);
  });

  it('acepta solo períodos mensuales bien formados', () => {
    expect(rankingQuerySchema.safeParse({ period: 'monthly', month: '2026-08' }).success).toBe(true);
    expect(rankingQuerySchema.safeParse({ period: 'monthly', month: '2026-99' }).success).toBe(false);
  });
});
