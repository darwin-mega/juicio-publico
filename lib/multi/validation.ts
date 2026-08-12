import { z } from 'zod';

const noControlCharacters = (value: string) => !/[\u0000-\u001f\u007f]/u.test(value);

export const roomIdSchema = z.string()
  .trim()
  .toUpperCase()
  .regex(/^[A-HJ-NP-Z2-9]{6}$/u);

export const deviceIdSchema = z.string().uuid();

export const displayNameSchema = z.string()
  .trim()
  .min(1)
  .max(24)
  .refine(noControlCharacters);

export const roomConfigSchema = z.object({
  killerCount: z.number().int().min(1).max(5),
  copCount: z.number().int().min(1).max(2),
  trialDurationSeconds: z.number().int().min(30).max(600),
}).strict();

export const createRoomSchema = z.object({
  config: roomConfigSchema,
  hostName: displayNameSchema,
  deviceId: deviceIdSchema,
}).strict();

export const joinRoomSchema = z.object({
  roomId: roomIdSchema,
  name: displayNameSchema,
  deviceId: deviceIdSchema,
}).strict();

export const roomCommandSchema = z.object({
  roomId: roomIdSchema,
}).strict();

export const voteSchema = z.object({
  roomId: roomIdSchema,
  targetId: deviceIdSchema,
}).strict();

export const operativeActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('kill'), targetId: deviceIdSchema }).strict(),
  z.object({ type: z.literal('save'), targetId: deviceIdSchema }).strict(),
  z.object({ type: z.literal('inspect'), targetId: deviceIdSchema }).strict(),
  z.object({ type: z.literal('neutral'), targetId: z.null() }).strict(),
]);

export const submitActionSchema = z.object({
  roomId: roomIdSchema,
  action: operativeActionSchema,
}).strict();

export function isMatchingDeviceHeader(headerDeviceId: string | null, bodyDeviceId: string): boolean {
  return headerDeviceId === bodyDeviceId;
}
