import { z } from 'zod';
import { roomIdSchema } from '@/lib/multi/validation';

const uuidSchema = z.string().uuid();
const inviteeIdsSchema = z.array(uuidSchema).max(50).transform((ids) => Array.from(new Set(ids)));

export const competitionSchema = z.object({
  name: z.string().trim().min(1).max(60),
  durationType: z.enum(['monthly', 'bimonthly']),
  inviteeIds: inviteeIdsSchema.default([]),
}).strict();

export const friendshipActionSchema = z.union([
  z.object({ friendshipId: uuidSchema, status: z.enum(['accepted', 'blocked']) }).strict(),
  z.object({ friendCode: z.string().trim().regex(/^[a-f0-9]{12}$/i) }).strict(),
  z.object({ targetUserId: uuidSchema }).strict(),
]);

export const roomInviteActionSchema = z.union([
  z.object({ inviteId: uuidSchema, status: z.enum(['accepted', 'declined']) }).strict(),
  z.object({ roomId: roomIdSchema, inviteeIds: inviteeIdsSchema }).strict(),
]);

export const userSearchSchema = z.string().trim().min(2).max(48);

export const progressOwnerQuerySchema = z.object({
  playerId: uuidSchema,
  displayName: z.string().trim().min(1).max(48).optional(),
}).strict();

export const rankingQuerySchema = z.object({
  period: z.enum(['monthly', 'historical']).default('historical'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
}).strict();
