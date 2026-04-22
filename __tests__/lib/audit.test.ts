/**
 * Audit System — Unit Tests
 *
 * Tests:
 *   - Patient access logger (fire-and-forget, no-throw guarantee)
 *   - Audit data retention (batched deletion, dry-run, stats)
 *   - AuditLog action/resource types
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Prisma — use vi.hoisted to avoid mock factory hoisting issues
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    auditLog: {
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
    tenant: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/db/tenantLookup', () => ({
  tenantWhere: (id: string) => ({ id }),
}));

vi.mock('@/lib/monitoring/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { logPatientAccess, type PatientAccessContext } from '@/lib/audit/patientAccessLogger';
import { enforceAuditRetention, getRetentionStats } from '@/lib/audit/retention';
import type { AuditAction, AuditResourceType } from '@/lib/models/AuditLog';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TENANT_UUID = '550e8400-e29b-41d4-a716-446655440000';

function makeAccessContext(overrides: Partial<PatientAccessContext> = {}): PatientAccessContext {
  return {
    tenantId: TENANT_UUID,
    userId: 'user-001',
    userRole: 'doctor',
    userEmail: 'dr@example.com',
    patientId: 'pat-001',
    accessType: 'view',
    resourceType: 'demographics',
    ip: '192.168.1.1',
    path: '/api/patients/pat-001',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Patient Access Logger
// ---------------------------------------------------------------------------

describe('Patient Access Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create an AuditLog entry with correct fields', async () => {
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

    logPatientAccess(makeAccessContext());

    // Fire-and-forget: wait for microtask to flush
    await vi.waitFor(() => {
      expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);
    });

    const call = mockPrisma.auditLog.create.mock.calls[0][0];
    expect(call.data.tenantId).toBe(TENANT_UUID);
    expect(call.data.actorUserId).toBe('user-001');
    expect(call.data.actorRole).toBe('doctor');
    expect(call.data.action).toBe('patient_record_access');
    expect(call.data.resourceType).toBe('patient');
    expect(call.data.resourceId).toBe('pat-001');
    expect(call.data.method).toBe('GET');
    expect(call.data.success).toBe(true);
    expect(call.data.metadata).toEqual(
      expect.objectContaining({
        patientId: 'pat-001',
        accessType: 'view',
        clinicalResourceType: 'demographics',
      }),
    );
  });

  it('should resolve non-UUID tenant IDs via tenant lookup', async () => {
    mockPrisma.tenant.findFirst.mockResolvedValue({ id: TENANT_UUID });
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-2' });

    logPatientAccess(makeAccessContext({ tenantId: 'my-tenant-slug' }));

    await vi.waitFor(() => {
      expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);
    });

    expect(mockPrisma.tenant.findFirst).toHaveBeenCalled();
    expect(mockPrisma.auditLog.create.mock.calls[0][0].data.tenantId).toBe(TENANT_UUID);
  });

  it('should never throw even when database fails', async () => {
    mockPrisma.auditLog.create.mockRejectedValue(new Error('DB down'));

    // This should NOT throw
    expect(() => logPatientAccess(makeAccessContext())).not.toThrow();

    // Wait for the promise to settle
    await new Promise((r) => setTimeout(r, 50));
  });

  it('should silently skip when tenant slug cannot be resolved', async () => {
    mockPrisma.tenant.findFirst.mockResolvedValue(null);

    logPatientAccess(makeAccessContext({ tenantId: 'nonexistent-tenant' }));

    // Wait for microtasks
    await new Promise((r) => setTimeout(r, 50));

    // Should NOT have created an audit log (no valid tenant)
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Audit Data Retention
// ---------------------------------------------------------------------------

describe('Audit Data Retention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('enforceAuditRetention', () => {
    it('should return count without deleting in dry-run mode', async () => {
      mockPrisma.auditLog.count.mockResolvedValue(42);

      const result = await enforceAuditRetention(TENANT_UUID, {
        retentionDays: 365,
        dryRun: true,
      });

      expect(result.dryRun).toBe(true);
      expect(result.deleted).toBe(42);
      expect(result.cutoffDate).toBeInstanceOf(Date);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);

      // Should NOT have called deleteMany
      expect(mockPrisma.auditLog.deleteMany).not.toHaveBeenCalled();
    });

    it('should delete records older than the cutoff in batches', async () => {
      // First batch: return 3 IDs
      mockPrisma.auditLog.findMany.mockResolvedValueOnce([
        { id: 'a1' },
        { id: 'a2' },
        { id: 'a3' },
      ]);
      mockPrisma.auditLog.deleteMany.mockResolvedValueOnce({ count: 3 });

      // Second batch: return empty (done)
      mockPrisma.auditLog.findMany.mockResolvedValueOnce([]);

      const result = await enforceAuditRetention(TENANT_UUID, {
        retentionDays: 2555,
        batchSize: 10,
      });

      expect(result.dryRun).toBe(false);
      expect(result.deleted).toBe(3);
      expect(mockPrisma.auditLog.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['a1', 'a2', 'a3'] } },
        }),
      );
    });

    it('should use default 7-year retention when no options specified', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const result = await enforceAuditRetention(TENANT_UUID);

      // Cutoff should be ~2555 days ago
      const now = new Date();
      const expectedCutoff = new Date();
      expectedCutoff.setDate(now.getDate() - 2555);

      // Allow 2 second tolerance for test execution time
      expect(Math.abs(result.cutoffDate.getTime() - expectedCutoff.getTime())).toBeLessThan(2000);
      expect(result.deleted).toBe(0);
    });
  });

  describe('getRetentionStats', () => {
    it('should return aggregate statistics', async () => {
      const oldDate = new Date('2020-01-01');
      const newDate = new Date('2024-03-01');

      mockPrisma.auditLog.count
        .mockResolvedValueOnce(1000) // total
        .mockResolvedValueOnce(50); // to delete

      mockPrisma.auditLog.findFirst
        .mockResolvedValueOnce({ timestamp: oldDate }) // oldest
        .mockResolvedValueOnce({ timestamp: newDate }); // newest

      const stats = await getRetentionStats(TENANT_UUID);

      expect(stats.totalRecords).toBe(1000);
      expect(stats.recordsToDelete).toBe(50);
      expect(stats.oldestRecord).toEqual(oldDate);
      expect(stats.newestRecord).toEqual(newDate);
      expect(stats.retentionDays).toBe(2555);
      expect(stats.cutoffDate).toBeInstanceOf(Date);
    });

    it('should handle empty audit logs', async () => {
      mockPrisma.auditLog.count.mockResolvedValue(0);
      mockPrisma.auditLog.findFirst.mockResolvedValue(null);

      const stats = await getRetentionStats(TENANT_UUID);

      expect(stats.totalRecords).toBe(0);
      expect(stats.oldestRecord).toBeNull();
      expect(stats.newestRecord).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// AuditLog Types
// ---------------------------------------------------------------------------

describe('AuditLog Types', () => {
  it('should include patient_record_access as a valid action', () => {
    // Type-level check — if this compiles, the type is correct
    const action: AuditAction = 'patient_record_access';
    expect(action).toBe('patient_record_access');
  });

  it('should include patient as a valid resource type', () => {
    const rt: AuditResourceType = 'patient';
    expect(rt).toBe('patient');
  });

  it('should include standard audit actions', () => {
    const actions: AuditAction[] = [
      'create',
      'read',
      'update',
      'delete',
      'login',
      'logout',
      'patient_record_access',
      'data_access',
      'data_export',
      'break_glass_access',
    ];
    // Type-level: if this compiles, all actions are valid
    expect(actions.length).toBe(10);
  });
});
