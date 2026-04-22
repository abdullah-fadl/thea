import { z } from 'zod';
import { entitlementsSchema } from './admin.schema';

// ─── Create Tenant ───────────────────────────────────────
export const createTenantSchema = z.object({
  tenantId: z.string().min(1).max(100, 'tenantId must be 1-100 chars'),
  name: z.string().optional(),
  orgTypeId: z.string().optional(),
  orgTypeDraftPayload: z.object({
    name: z.string().min(1).max(200),
    sector: z.string().min(1).max(100),
    countryCode: z.string().min(1).max(10).nullable().optional(),
  }).optional(),
  sector: z.string().min(1).max(100),
  countryCode: z.string().min(1).max(10),
  entitlements: entitlementsSchema.optional(),
  status: z.enum(['active', 'blocked']).optional().default('active'),
  planType: z.enum(['demo', 'paid']).optional().default('demo'),
  subscriptionEndsAt: z.string().optional(),
  maxUsers: z.number().int().positive().optional().default(10),
});

// ─── Update Tenant ───────────────────────────────────────
export const updateTenantSchema = z.object({
  name: z.string().optional(),
  status: z.enum(['active', 'blocked']).optional(),
  planType: z.enum(['demo', 'paid']).optional(),
  subscriptionEndsAt: z.string().nullable().optional(),
  maxUsers: z.number().int().positive().optional(),
  entitlements: entitlementsSchema.optional(),
});

// ─── Create Admin ────────────────────────────────────────
export const createAdminSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
});

// ─── Assign Users ────────────────────────────────────────
export const assignUsersSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1, 'At least one userId required'),
});

// ─── Change Role ─────────────────────────────────────────
export const changeRoleSchema = z.object({
  role: z.enum(['admin']),
});

// ─── Move User ───────────────────────────────────────────
export const moveUserSchema = z.object({
  toTenantId: z.string().nullable().optional(),
});

// ─── Update Entitlements ─────────────────────────────────
export const updateEntitlementsSchema = z.object({
  entitlements: entitlementsSchema,
});

// ─── Update Integrations ─────────────────────────────────
export const updateOwnerIntegrationsSchema = z.object({
  samHealth: z.object({
    enabled: z.boolean().optional(),
    autoTriggerEnabled: z.boolean().optional(),
    severityThreshold: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    engineTimeoutMs: z.number().min(1000).max(30000).optional(),
  }).optional(),
});

// ─── Create Org Type ─────────────────────────────────────
export const createOrgTypeSchema = z.object({
  name: z.string().min(1).max(200),
  sector: z.string().min(1).max(100),
  countryCode: z.string().min(1).max(10).optional(),
});

// ─── Update Org Type ─────────────────────────────────────
export const updateOrgTypeSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  sector: z.string().min(1).max(100).optional(),
  countryCode: z.string().min(1).max(10).optional(),
});

// ─── Org Type Proposal ───────────────────────────────────
export const orgTypeProposalSchema = z.object({
  name: z.string().min(1).max(200),
  sector: z.string().min(1).max(100),
  countryCode: z.string().min(1).max(10).optional(),
  reason: z.string().optional(),
});
