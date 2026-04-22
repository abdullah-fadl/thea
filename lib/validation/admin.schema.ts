import { z } from 'zod';

// ─── Platform Access ─────────────────────────────────────
export const platformAccessSchema = z.object({
  sam: z.boolean().optional(),
  health: z.boolean().optional(),
  edrac: z.boolean().optional(),
  cvision: z.boolean().optional(),
  imdad: z.boolean().optional(),
});

// ─── Entitlements ────────────────────────────────────────
export const entitlementsSchema = z.object({
  sam: z.boolean().optional(),
  health: z.boolean().optional(),
  edrac: z.boolean().optional(),
  cvision: z.boolean().optional(),
  imdad: z.boolean().optional(),
});

// ─── Create User ─────────────────────────────────────────
export const createUserSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/[0-9]/, 'Must contain number')
    .regex(/[^A-Za-z0-9]/, 'Must contain special character'),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.string().min(1).max(64).regex(/^[a-z0-9-_]+$/),
  groupId: z.string().optional(),
  hospitalId: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  staffId: z.string().nullable().optional(),
  employeeNo: z.string().nullable().optional(),
  permissions: z.array(z.string()).optional(),
  platformAccess: platformAccessSchema.optional(),
});

// ─── Update User ─────────────────────────────────────────
export const updateUserSchema = z.object({
  permissions: z.array(z.string()).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  role: z.string().regex(/^[a-z0-9-_]+$/).optional(),
  groupId: z.string().optional(),
  hospitalId: z.string().nullable().optional(),
  department: z.string().optional(),
  departments: z.array(z.string()).optional(), // Department keys: laboratory, radiology, operating-room, pharmacy
  staffId: z.string().optional(),
  employeeNo: z.string().optional(),
  isActive: z.boolean().optional(),
});

// ─── Create Subscription Contract ────────────────────────
export const createContractSchema = z.object({
  tenantId: z.string().min(1, 'tenantId is required'),
});

// ─── Update Integrations ─────────────────────────────────
export const updateIntegrationsSchema = z.object({
  samHealth: z.object({
    enabled: z.boolean().optional(),
    autoTriggerEnabled: z.boolean().optional(),
    severityThreshold: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    engineTimeoutMs: z.number().min(1000).max(30000).optional(),
  }).optional(),
});

// ─── Create Quota ────────────────────────────────────────
export const createQuotaSchema = z.object({
  scopeType: z.enum(['group', 'user']),
  scopeId: z.string().min(1, 'scopeId is required'),
  featureKey: z.string().min(1, 'featureKey is required'),
  limit: z.number().int().positive().optional(),
  status: z.enum(['active', 'locked']).optional().default('active'),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});

// ─── Update Quota ────────────────────────────────────────
export const updateQuotaSchema = z.object({
  limit: z.number().int().positive().optional(),
  status: z.enum(['active', 'locked']).optional(),
  endsAt: z.string().nullable().optional(),
});

// ─── Data Export ─────────────────────────────────────────
export const dataExportSchema = z.object({
  format: z.enum(['csv', 'json']).optional().default('json'),
  collection: z.string().min(1, 'collection is required'),
  filters: z.record(z.string(), z.unknown()).optional(),
});

// ─── Onboard Doctor ──────────────────────────────────────
export const onboardDoctorSchema = z.object({
  email: z.string().email('Invalid email'),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  specialtyCode: z.string().min(1, 'specialtyCode is required'),
  licenseNumber: z.string().optional(),
  departmentKey: z.string().optional(),
  staffId: z.string().optional(),
});

// ─── Organization Profile Setup ──────────────────────────
export const orgProfileSetupSchema = z.object({
  orgName: z.string().min(1, 'orgName is required'),
  sector: z.string().optional(),
  countryCode: z.string().optional(),
  departments: z.array(z.string()).optional(),
}).passthrough();

// ─── Context Overlay ─────────────────────────────────────
export const contextOverlaySchema = z.object({
  ruleKey: z.string().min(1, 'ruleKey is required'),
  value: z.unknown(),
  scope: z.string().optional(),
}).passthrough();

// ─── Clinical Settings ───────────────────────────────────
export const clinicalSettingsSchema = z.object({
  settings: z.record(z.string(), z.unknown()),
}).passthrough();

// ─── Update Platform Access ──────────────────────────────
export const updatePlatformAccessSchema = z.object({
  platformAccess: platformAccessSchema,
});

// ─── Create Group ────────────────────────────────────────
export const createGroupSchema = z.object({
  name: z.string().min(1, 'name is required'),
  description: z.string().optional(),
});

// ─── Update Group ────────────────────────────────────────
export const updateGroupSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
});

// ─── Create Hospital ─────────────────────────────────────
export const createHospitalSchema = z.object({
  name: z.string().min(1, 'name is required'),
  groupId: z.string().min(1, 'groupId is required'),
  location: z.string().optional(),
});

// ─── Update Hospital ─────────────────────────────────────
export const updateHospitalSchema = z.object({
  name: z.string().optional(),
  location: z.string().optional(),
});

// ─── Create Role ─────────────────────────────────────────
export const createRoleSchema = z.object({
  roleKey: z.string().min(1).max(64).regex(/^[a-z0-9-_]+$/),
  label: z.string().min(1),
  permissions: z.array(z.string()).optional(),
});

// ─── Update Role ─────────────────────────────────────────
export const updateRoleSchema = z.object({
  label: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

// ─── Admin Structure ─────────────────────────────────────
export const adminStructureSchema = z.object({
  action: z.enum(['create', 'update', 'delete']),
  type: z.enum(['department', 'floor', 'room']),
  data: z.record(z.string(), z.unknown()),
}).passthrough();
