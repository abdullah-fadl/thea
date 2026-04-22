/**
 * CVision Roles API Validation Tests
 *
 * Tests for the Zod schemas used in the roles management API route.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Reproduce the schemas from roles/route.ts
const VALID_PAGE_PERMS = ['NONE', 'VIEW', 'EDIT', 'FULL'] as const;
const VALID_SCOPES = ['ALL', 'DEPARTMENT', 'TEAM', 'SELF'] as const;

const createRoleSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  code: z.string().min(1).max(50).trim().toUpperCase(),
  description: z.string().max(1000).trim().default(''),
  pagePermissions: z.record(z.string(), z.enum(VALID_PAGE_PERMS)).default({}),
  modulePermissions: z.record(z.string(), z.array(z.string())).default({}),
  dataScope: z.enum(VALID_SCOPES).default('SELF'),
  restrictedFields: z.array(z.string().max(100)).max(50).default([]),
  approvalAuthority: z.object({
    canApprove: z.array(z.string()).default([]),
    maxApprovalAmount: z.number().min(0).default(0),
    requiresCounterSign: z.boolean().default(false),
  }).default({ canApprove: [], maxApprovalAmount: 0, requiresCounterSign: false }),
  specialPermissions: z.array(z.string().max(100)).max(20).default([]),
});

const assignRoleSchema = z.object({
  userId: z.string().min(1),
  userName: z.string().max(200).default(''),
  roleIds: z.array(z.string().min(1)).min(1).max(20),
});

const bulkAssignSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(500),
  roleId: z.string().min(1),
});

// ─── Create Role Schema ───────────────────────────────────────────────────

describe('createRoleSchema', () => {
  it('should accept minimal valid role', () => {
    const result = createRoleSchema.safeParse({
      name: 'Custom Role',
      code: 'custom_role',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe('CUSTOM_ROLE'); // auto-uppercased
      expect(result.data.dataScope).toBe('SELF');
      expect(result.data.restrictedFields).toEqual([]);
    }
  });

  it('should accept full role with all fields', () => {
    const result = createRoleSchema.safeParse({
      name: 'HR Officer',
      code: 'HR_OFFICER',
      description: 'Handles daily HR operations',
      pagePermissions: { dashboard: 'VIEW', employees: 'EDIT' },
      modulePermissions: { employees: ['READ', 'WRITE'], recruitment: ['READ'] },
      dataScope: 'DEPARTMENT',
      restrictedFields: ['salary', 'bankAccount'],
      approvalAuthority: {
        canApprove: ['LEAVE'],
        maxApprovalAmount: 5000,
        requiresCounterSign: true,
      },
      specialPermissions: ['VIEW_AUDIT'],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dataScope).toBe('DEPARTMENT');
      expect(result.data.restrictedFields).toContain('salary');
      expect(result.data.approvalAuthority.maxApprovalAmount).toBe(5000);
    }
  });

  it('should reject empty name', () => {
    const result = createRoleSchema.safeParse({ name: '', code: 'TEST' });
    expect(result.success).toBe(false);
  });

  it('should reject empty code', () => {
    const result = createRoleSchema.safeParse({ name: 'Test', code: '' });
    expect(result.success).toBe(false);
  });

  it('should reject invalid dataScope', () => {
    const result = createRoleSchema.safeParse({
      name: 'Test',
      code: 'TEST',
      dataScope: 'GLOBAL',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid page permission level', () => {
    const result = createRoleSchema.safeParse({
      name: 'Test',
      code: 'TEST',
      pagePermissions: { dashboard: 'ADMIN' },
    });
    expect(result.success).toBe(false);
  });

  it('should reject negative approval amount', () => {
    const result = createRoleSchema.safeParse({
      name: 'Test',
      code: 'TEST',
      approvalAuthority: {
        canApprove: [],
        maxApprovalAmount: -100,
        requiresCounterSign: false,
      },
    });
    expect(result.success).toBe(false);
  });

  it('should reject more than 50 restricted fields', () => {
    const fields = Array.from({ length: 51 }, (_, i) => `field_${i}`);
    const result = createRoleSchema.safeParse({
      name: 'Test',
      code: 'TEST',
      restrictedFields: fields,
    });
    expect(result.success).toBe(false);
  });
});

// ─── Assign Role Schema ──────────────────────────────────────────────────

describe('assignRoleSchema', () => {
  it('should accept valid assignment', () => {
    const result = assignRoleSchema.safeParse({
      userId: 'user-123',
      userName: 'John Doe',
      roleIds: ['HR_MANAGER'],
    });
    expect(result.success).toBe(true);
  });

  it('should accept multiple roles', () => {
    const result = assignRoleSchema.safeParse({
      userId: 'user-123',
      roleIds: ['HR_MANAGER', 'FINANCE'],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.roleIds).toHaveLength(2);
    }
  });

  it('should reject empty userId', () => {
    const result = assignRoleSchema.safeParse({
      userId: '',
      roleIds: ['HR_MANAGER'],
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty roleIds', () => {
    const result = assignRoleSchema.safeParse({
      userId: 'user-123',
      roleIds: [],
    });
    expect(result.success).toBe(false);
  });

  it('should reject more than 20 roles', () => {
    const roleIds = Array.from({ length: 21 }, (_, i) => `ROLE_${i}`);
    const result = assignRoleSchema.safeParse({
      userId: 'user-123',
      roleIds,
    });
    expect(result.success).toBe(false);
  });
});

// ─── Bulk Assign Schema ─────────────────────────────────────────────────

describe('bulkAssignSchema', () => {
  it('should accept valid bulk assignment', () => {
    const result = bulkAssignSchema.safeParse({
      userIds: ['user-1', 'user-2', 'user-3'],
      roleId: 'HR_OFFICER',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty userIds', () => {
    const result = bulkAssignSchema.safeParse({
      userIds: [],
      roleId: 'HR_OFFICER',
    });
    expect(result.success).toBe(false);
  });

  it('should reject more than 500 users', () => {
    const userIds = Array.from({ length: 501 }, (_, i) => `user-${i}`);
    const result = bulkAssignSchema.safeParse({
      userIds,
      roleId: 'HR_OFFICER',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty roleId', () => {
    const result = bulkAssignSchema.safeParse({
      userIds: ['user-1'],
      roleId: '',
    });
    expect(result.success).toBe(false);
  });
});
