/**
 * CVision Bulk Operations Validation Tests
 *
 * Tests for the Zod validation schemas added to the bulk operations route,
 * ensuring field whitelist and parameter validation are enforced.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Reproduce the schemas from bulk/route.ts for unit testing
const EMPLOYEE_STATUSES = [
  'active', 'probation',
  'on_annual_leave', 'on_sick_leave', 'on_maternity_leave', 'on_unpaid_leave',
  'suspended', 'suspended_without_pay',
  'notice_period',
  'resigned', 'terminated', 'end_of_contract', 'retired', 'deceased',
] as const;

const ALLOWED_BULK_UPDATE_FIELDS = [
  'departmentId', 'unitId', 'jobTitleId', 'positionId', 'gradeId',
  'managerId', 'employmentType', 'nationality', 'maritalStatus',
  'branchId', 'isActive',
] as const;

const bulkStatusChangeParams = z.object({
  newStatus: z.string().refine(
    (s) => EMPLOYEE_STATUSES.includes(s.toLowerCase() as any) || EMPLOYEE_STATUSES.includes(s as any),
    { message: 'Invalid employee status' }
  ),
  reason: z.string().max(2000).optional(),
});

const bulkDepartmentTransferParams = z.object({
  departmentId: z.string().uuid('departmentId must be a valid UUID'),
  reason: z.string().max(2000).optional(),
});

const bulkSalaryUpdateParams = z.object({
  type: z.enum(['percentage', 'fixed']),
  value: z.number().refine((v) => v !== 0, { message: 'Value cannot be zero' }),
}).refine(
  (d) => d.type !== 'percentage' || (d.value >= -50 && d.value <= 100),
  { message: 'Percentage must be between -50% and +100%' }
);

const bulkFieldUpdateParams = z.object({
  field: z.enum(ALLOWED_BULK_UPDATE_FIELDS, {
    errorMap: () => ({ message: `Field must be one of: ${ALLOWED_BULK_UPDATE_FIELDS.join(', ')}` }),
  }),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

const VALID_OPERATIONS = [
  'bulk_status_change', 'bulk_department_transfer', 'bulk_salary_update',
  'bulk_leave_balance', 'bulk_training_enroll', 'bulk_notification', 'bulk_field_update',
] as const;

const bulkExecuteSchema = z.object({
  action: z.literal('execute'),
  operation: z.enum(VALID_OPERATIONS),
  targetIds: z.array(z.string().min(1)).min(1).max(500),
  parameters: z.record(z.string(), z.any()),
  dryRun: z.boolean().default(false),
});

// ─── Bulk Execute Schema ──────────────────────────────────────────────────

describe('bulkExecuteSchema', () => {
  it('should accept a valid execute request', () => {
    const result = bulkExecuteSchema.safeParse({
      action: 'execute',
      operation: 'bulk_status_change',
      targetIds: ['emp-1', 'emp-2'],
      parameters: { newStatus: 'active' },
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid action', () => {
    const result = bulkExecuteSchema.safeParse({
      action: 'delete_all',
      operation: 'bulk_status_change',
      targetIds: ['emp-1'],
      parameters: {},
    });
    expect(result.success).toBe(false);
  });

  it('should reject unknown operation', () => {
    const result = bulkExecuteSchema.safeParse({
      action: 'execute',
      operation: 'bulk_delete_everything',
      targetIds: ['emp-1'],
      parameters: {},
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty targetIds', () => {
    const result = bulkExecuteSchema.safeParse({
      action: 'execute',
      operation: 'bulk_status_change',
      targetIds: [],
      parameters: {},
    });
    expect(result.success).toBe(false);
  });

  it('should reject more than 500 targets', () => {
    const ids = Array.from({ length: 501 }, (_, i) => `emp-${i}`);
    const result = bulkExecuteSchema.safeParse({
      action: 'execute',
      operation: 'bulk_status_change',
      targetIds: ids,
      parameters: {},
    });
    expect(result.success).toBe(false);
  });

  it('should default dryRun to false', () => {
    const result = bulkExecuteSchema.safeParse({
      action: 'execute',
      operation: 'bulk_notification',
      targetIds: ['emp-1'],
      parameters: {},
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dryRun).toBe(false);
    }
  });
});

// ─── Status Change Params ─────────────────────────────────────────────────

describe('bulkStatusChangeParams', () => {
  it('should accept valid status', () => {
    const result = bulkStatusChangeParams.safeParse({ newStatus: 'active' });
    expect(result.success).toBe(true);
  });

  it('should reject invalid status', () => {
    const result = bulkStatusChangeParams.safeParse({ newStatus: 'fired' });
    expect(result.success).toBe(false);
  });

  it('should accept optional reason', () => {
    const result = bulkStatusChangeParams.safeParse({ newStatus: 'terminated', reason: 'Performance' });
    expect(result.success).toBe(true);
  });
});

// ─── Department Transfer Params ───────────────────────────────────────────

describe('bulkDepartmentTransferParams', () => {
  it('should accept valid UUID departmentId', () => {
    const result = bulkDepartmentTransferParams.safeParse({
      departmentId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('should reject non-UUID departmentId', () => {
    const result = bulkDepartmentTransferParams.safeParse({
      departmentId: 'HR-Department',
    });
    expect(result.success).toBe(false);
  });
});

// ─── Salary Update Params ─────────────────────────────────────────────────

describe('bulkSalaryUpdateParams', () => {
  it('should accept valid percentage', () => {
    const result = bulkSalaryUpdateParams.safeParse({ type: 'percentage', value: 10 });
    expect(result.success).toBe(true);
  });

  it('should accept valid fixed amount', () => {
    const result = bulkSalaryUpdateParams.safeParse({ type: 'fixed', value: 500 });
    expect(result.success).toBe(true);
  });

  it('should reject zero value', () => {
    const result = bulkSalaryUpdateParams.safeParse({ type: 'fixed', value: 0 });
    expect(result.success).toBe(false);
  });

  it('should reject percentage > 100', () => {
    const result = bulkSalaryUpdateParams.safeParse({ type: 'percentage', value: 150 });
    expect(result.success).toBe(false);
  });

  it('should reject percentage < -50', () => {
    const result = bulkSalaryUpdateParams.safeParse({ type: 'percentage', value: -60 });
    expect(result.success).toBe(false);
  });

  it('should allow negative fixed amounts', () => {
    const result = bulkSalaryUpdateParams.safeParse({ type: 'fixed', value: -200 });
    expect(result.success).toBe(true);
  });
});

// ─── Field Update Params (SECURITY CRITICAL) ─────────────────────────────

describe('bulkFieldUpdateParams', () => {
  it('should accept allowed fields', () => {
    for (const field of ALLOWED_BULK_UPDATE_FIELDS) {
      const result = bulkFieldUpdateParams.safeParse({ field, value: 'test' });
      expect(result.success).toBe(true);
    }
  });

  it('should REJECT disallowed fields (security)', () => {
    const dangerousFields = [
      'password', 'passwordHash', 'role', 'tenantId', 'isAdmin',
      'salary', 'bankAccount', 'iban', 'email', 'status',
      '__proto__', 'constructor', '$set',
    ];
    for (const field of dangerousFields) {
      const result = bulkFieldUpdateParams.safeParse({ field, value: 'hacked' });
      expect(result.success).toBe(false);
    }
  });

  it('should accept string values', () => {
    const result = bulkFieldUpdateParams.safeParse({ field: 'departmentId', value: 'dept-123' });
    expect(result.success).toBe(true);
  });

  it('should accept boolean values', () => {
    const result = bulkFieldUpdateParams.safeParse({ field: 'isActive', value: false });
    expect(result.success).toBe(true);
  });

  it('should accept null values', () => {
    const result = bulkFieldUpdateParams.safeParse({ field: 'managerId', value: null });
    expect(result.success).toBe(true);
  });
});
