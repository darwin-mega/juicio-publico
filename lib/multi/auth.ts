import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';
import type { MultiRoomState } from './types';
import { getCredentialHash, saveCredentialHash } from './redis';

const DEVICE_HEADER = 'X-Device-Id';
const CREDENTIAL_HEADER = 'X-Player-Credential';

function hashCredential(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export async function issuePlayerCredential(roomId: string, deviceId: string): Promise<string> {
  const credential = randomBytes(32).toString('base64url');
  await saveCredentialHash(roomId, deviceId, hashCredential(credential));
  return credential;
}

export async function authenticatePlayer(
  req: NextRequest,
  roomId: string,
  room: MultiRoomState
): Promise<string | null> {
  const deviceId = req.headers.get(DEVICE_HEADER);
  const credential = req.headers.get(CREDENTIAL_HEADER);
  if (!deviceId || !credential || credential.length > 128) return null;
  if (!room.players.some((player) => player.deviceId === deviceId)) return null;

  const expectedHash = await getCredentialHash(roomId, deviceId);
  if (!expectedHash) return null;

  const actual = Buffer.from(hashCredential(credential), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  return deviceId;
}
