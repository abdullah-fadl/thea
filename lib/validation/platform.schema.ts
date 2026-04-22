import { z } from 'zod';

// ─── Platform Set/Switch ─────────────────────────────────
export const platformSetSchema = z.object({
  platform: z.enum(['sam', 'health', 'cvision', 'imdad']),
});

// ─── Approved Access ─────────────────────────────────────
export const approvedAccessApproveSchema = z.object({
  requestId: z.string().min(1, 'requestId is required'),
  notes: z.string().optional(),
  expiresAt: z.string().optional(),
});

export const approvedAccessActivateSchema = z.object({
  token: z.string().min(1, 'token is required'),
});

export const approvedAccessRejectSchema = z.object({
  requestId: z.string().min(1, 'requestId is required'),
  reason: z.string().optional(),
});

export const approvedAccessRevokeSchema = z.object({
  tokenId: z.string().min(1, 'tokenId is required'),
});

export const approvedAccessRequestSchema = z.object({
  reason: z.string().min(1, 'reason is required'),
  expiresAt: z.string().optional(),
});

// ─── Integration Policy Check ────────────────────────────
export const policyCheckSchema = z.object({
  policyData: z.record(z.string(), z.unknown()),
}).passthrough();

// ─── Clinical Events Integration ─────────────────────────
export const clinicalEventsSchema = z.object({
  eventType: z.string().min(1, 'eventType is required'),
  eventData: z.record(z.string(), z.unknown()),
}).passthrough();
