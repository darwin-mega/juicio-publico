import { describe, expect, it } from 'vitest';
import {
  createRoomSchema,
  joinRoomSchema,
  operativeActionSchema,
  roomIdSchema,
} from '@/lib/multi/validation';

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
