import { afterEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as createRoom } from '@/app/api/multi/create/route';
import { POST as joinRoom } from '@/app/api/multi/join/route';
import { POST as startGame } from '@/app/api/multi/start/route';
import { deleteRoomData, getRoom } from '@/lib/multi/redis';

const hostId = '75f6e437-0ee3-4ed1-8218-1f100b814ad8';
const guestId = 'ec392aae-54c2-4fab-8176-39df505abf3e';
let createdRoomId: string | null = null;

function post(path: string, body: unknown, deviceId: string, credential?: string) {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': deviceId,
      ...(credential ? { 'X-Player-Credential': credential } : {}),
    },
    body: JSON.stringify(body),
  });
}

afterEach(async () => {
  if (!createdRoomId) return;
  const room = await getRoom(createdRoomId);
  if (room) await deleteRoomData(room);
  createdRoomId = null;
});

describe('API multidispositivo', () => {
  it('crea una sala, entrega una credencial y permite unirse', async () => {
    const createResponse = await createRoom(post('/api/multi/create', {
      config: { killerCount: 1, copCount: 1, trialDurationSeconds: 120 },
      hostName: 'Host',
      deviceId: hostId,
    }, hostId));
    expect(createResponse.status).toBe(200);
    const created = await createResponse.json();
    createdRoomId = created.roomId;
    expect(created.credential).toMatch(/^[A-Za-z0-9_-]{40,}$/u);

    const joinResponse = await joinRoom(post('/api/multi/join', {
      roomId: created.roomId,
      name: 'Invitado',
      deviceId: guestId,
    }, guestId));
    expect(joinResponse.status).toBe(200);
    const joined = await joinResponse.json();
    expect(joined.room.players.map((player: { name: string }) => player.name)).toEqual(['Host', 'Invitado']);
    expect(joined.credential).toMatch(/^[A-Za-z0-9_-]{40,}$/u);
  });

  it('rechaza suplantación de dispositivo y reconexión sin credencial', async () => {
    const mismatch = await createRoom(post('/api/multi/create', {
      config: { killerCount: 1, copCount: 1, trialDurationSeconds: 120 },
      hostName: 'Host',
      deviceId: hostId,
    }, guestId));
    expect(mismatch.status).toBe(400);

    const createResponse = await createRoom(post('/api/multi/create', {
      config: { killerCount: 1, copCount: 1, trialDurationSeconds: 120 },
      hostName: 'Host',
      deviceId: hostId,
    }, hostId));
    const created = await createResponse.json();
    createdRoomId = created.roomId;

    const reconnect = await joinRoom(post('/api/multi/join', {
      roomId: created.roomId,
      name: 'Host',
      deviceId: hostId,
    }, hostId));
    expect(reconnect.status).toBe(401);
  });

  it('exige credencial y cantidad mínima antes de iniciar', async () => {
    const createResponse = await createRoom(post('/api/multi/create', {
      config: { killerCount: 1, copCount: 1, trialDurationSeconds: 120 },
      hostName: 'Host',
      deviceId: hostId,
    }, hostId));
    const created = await createResponse.json();
    createdRoomId = created.roomId;

    const unauthorized = await startGame(post('/api/multi/start', { roomId: created.roomId }, hostId));
    expect(unauthorized.status).toBe(401);

    const tooFew = await startGame(post(
      '/api/multi/start',
      { roomId: created.roomId },
      hostId,
      created.credential
    ));
    expect(tooFew.status).toBe(400);
  });
});
