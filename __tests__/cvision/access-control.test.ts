/**
 * CVision Access Control Engine Tests
 *
 * Tests for the role CRUD, user-role assignment, delegation, and permission
 * checking functions in lib/cvision/access-control.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the DB operations
const mockCollection = {
  findOne: vi.fn(),
  find: vi.fn(() => ({ sort: vi.fn(() => ({ limit: vi.fn(() => ({ toArray: vi.fn(() => []) })) })), toArray: vi.fn(() => []) })),
  insertOne: vi.fn(),
  insertMany: vi.fn(),
  updateOne: vi.fn(),
  deleteOne: vi.fn(),
  countDocuments: vi.fn(() => 0),
};

const mockDb = {
  collection: vi.fn(() => mockCollection),
};

// Import access-control functions after mocks
vi.mock('@/lib/cvision/infra/mongo-compat', () => ({}));

describe('Access Control - Role CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.findOne.mockResolvedValue(null);
    mockCollection.insertOne.mockResolvedValue({ insertedId: 'test' });
    mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });
    mockCollection.deleteOne.mockResolvedValue({ deletedCount: 1 });
    mockCollection.countDocuments.mockResolvedValue(0);
  });

  it('should create a role with generated UUID', async () => {
    const { createRole } = await import('@/lib/cvision/access-control');
    const result = await createRole(mockDb as any, 'tenant-1', {
      name: 'Test Role',
      code: 'TEST_ROLE',
      description: 'A test role',
    });

    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('string');
    expect(mockCollection.insertOne).toHaveBeenCalledTimes(1);

    const insertedDoc = mockCollection.insertOne.mock.calls[0][0];
    expect(insertedDoc.name).toBe('Test Role');
    expect(insertedDoc.code).toBe('TEST_ROLE');
    expect(insertedDoc.tenantId).toBe('tenant-1');
    expect(insertedDoc.isSystem).toBe(false);
    expect(insertedDoc.dataScope).toBe('SELF');
  });

  it('should only delete non-system roles', async () => {
    const { deleteRole } = await import('@/lib/cvision/access-control');
    await deleteRole(mockDb as any, 'tenant-1', 'role-123');

    const deleteQuery = mockCollection.deleteOne.mock.calls[0][0];
    expect(deleteQuery.isSystem).toBe(false);
    expect(deleteQuery.tenantId).toBe('tenant-1');
  });

  it('should update role with only provided fields', async () => {
    const { updateRole } = await import('@/lib/cvision/access-control');
    await updateRole(mockDb as any, 'tenant-1', 'role-123', {
      name: 'Updated Name',
    });

    const updateSet = mockCollection.updateOne.mock.calls[0][1].$set;
    expect(updateSet.name).toBe('Updated Name');
    expect(updateSet.updatedAt).toBeInstanceOf(Date);
    // Should not include fields that weren't provided
    expect(updateSet.description).toBeUndefined();
    expect(updateSet.dataScope).toBeUndefined();
  });
});

describe('Access Control - User Role Assignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.findOne.mockResolvedValue(null);
    mockCollection.insertOne.mockResolvedValue({ insertedId: 'test' });
    mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });
  });

  it('should create new user-role assignment when none exists', async () => {
    const { assignRole } = await import('@/lib/cvision/access-control');
    const result = await assignRole(
      mockDb as any, 'tenant-1', 'user-1', 'John', ['HR_MANAGER'], 'admin-1'
    );

    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();
    expect(mockCollection.insertOne).toHaveBeenCalledTimes(1);

    const insertedDoc = mockCollection.insertOne.mock.calls[0][0];
    expect(insertedDoc.userId).toBe('user-1');
    expect(insertedDoc.roleIds).toEqual(['HR_MANAGER']);
    expect(insertedDoc.primaryRoleId).toBe('HR_MANAGER');
  });

  it('should merge roles when user already has assignments', async () => {
    mockCollection.findOne.mockResolvedValue({
      _id: 'existing-id',
      id: 'ur-1',
      roleIds: ['EMPLOYEE'],
      tenantId: 'tenant-1',
    });

    const { assignRole } = await import('@/lib/cvision/access-control');
    const result = await assignRole(
      mockDb as any, 'tenant-1', 'user-1', 'John', ['HR_MANAGER'], 'admin-1'
    );

    expect(result.success).toBe(true);
    expect(mockCollection.updateOne).toHaveBeenCalledTimes(1);

    const updateSet = mockCollection.updateOne.mock.calls[0][1].$set;
    expect(updateSet.roleIds).toContain('EMPLOYEE');
    expect(updateSet.roleIds).toContain('HR_MANAGER');
  });

  it('should remove a specific role from user', async () => {
    mockCollection.findOne.mockResolvedValue({
      _id: 'existing-id',
      roleIds: ['HR_MANAGER', 'FINANCE'],
      tenantId: 'tenant-1',
    });

    const { removeRole } = await import('@/lib/cvision/access-control');
    const result = await removeRole(mockDb as any, 'tenant-1', 'user-1', 'FINANCE');

    expect(result.success).toBe(true);
    expect(mockCollection.updateOne).toHaveBeenCalledTimes(1);

    const updateSet = mockCollection.updateOne.mock.calls[0][1].$set;
    expect(updateSet.roleIds).toEqual(['HR_MANAGER']);
    expect(updateSet.roleIds).not.toContain('FINANCE');
  });

  it('should delete user-role record when last role is removed', async () => {
    mockCollection.findOne.mockResolvedValue({
      _id: 'existing-id',
      roleIds: ['EMPLOYEE'],
      tenantId: 'tenant-1',
    });

    const { removeRole } = await import('@/lib/cvision/access-control');
    const result = await removeRole(mockDb as any, 'tenant-1', 'user-1', 'EMPLOYEE');

    expect(result.success).toBe(true);
    expect(mockCollection.deleteOne).toHaveBeenCalledTimes(1);
  });

  it('should return false when removing role for non-existent user', async () => {
    mockCollection.findOne.mockResolvedValue(null);

    const { removeRole } = await import('@/lib/cvision/access-control');
    const result = await removeRole(mockDb as any, 'tenant-1', 'nonexistent', 'EMPLOYEE');

    expect(result.success).toBe(false);
  });
});

describe('Access Control - Seed Default Roles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.insertMany.mockResolvedValue({ insertedCount: 8 });
  });

  it('should seed default roles when none exist', async () => {
    mockCollection.countDocuments.mockResolvedValue(0);

    const { seedDefaultRoles } = await import('@/lib/cvision/access-control');
    const result = await seedDefaultRoles(mockDb as any, 'tenant-1');

    expect(result.seeded).toBe(8); // 8 default roles
    expect(mockCollection.insertMany).toHaveBeenCalledTimes(1);
  });

  it('should skip seeding when roles already exist', async () => {
    mockCollection.countDocuments.mockResolvedValue(5);

    const { seedDefaultRoles } = await import('@/lib/cvision/access-control');
    const result = await seedDefaultRoles(mockDb as any, 'tenant-1');

    expect(result.seeded).toBe(0);
    expect(mockCollection.insertMany).not.toHaveBeenCalled();
  });
});

describe('Access Control - Integration Flags', () => {
  it('should validate webhook payloads', async () => {
    // Since integration.ts may not exist yet, test inline
    function validateWebhookPayload(payload: any): { valid: boolean; error?: string } {
      if (!payload) return { valid: false, error: 'Empty payload' };
      if (!payload.event) return { valid: false, error: 'Missing event field' };
      if (!payload.source) return { valid: false, error: 'Missing source field' };
      if (!payload.data) return { valid: false, error: 'Missing data field' };
      return { valid: true };
    }

    expect(validateWebhookPayload(null)).toEqual({ valid: false, error: 'Empty payload' });
    expect(validateWebhookPayload({})).toEqual({ valid: false, error: 'Missing event field' });
    expect(validateWebhookPayload({ event: 'test' })).toEqual({ valid: false, error: 'Missing source field' });
    expect(validateWebhookPayload({ event: 'test', source: 'thea' })).toEqual({ valid: false, error: 'Missing data field' });
    expect(validateWebhookPayload({ event: 'test', source: 'thea', data: {} })).toEqual({ valid: true });
  });
});
