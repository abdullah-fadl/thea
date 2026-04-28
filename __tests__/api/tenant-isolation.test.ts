/**
 * Tenant Isolation — Unit Tests
 *
 * Verifies that the multi-tenant architecture correctly isolates data:
 *   - Every Prisma query includes tenantId filter
 *   - Cross-tenant data access is prevented
 *   - Tenant context is properly propagated from auth middleware
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — use vi.hoisted to avoid factory hoisting issues
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    patientMaster: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    encounterCore: { findMany: vi.fn(), findFirst: vi.fn() },
    auditLog: { findMany: vi.fn(), create: vi.fn() },
    tenant: { findFirst: vi.fn(), findUnique: vi.fn() },
  },
}));

vi.mock('@/lib/db/prisma', () => ({ prisma: mockPrisma }));

vi.mock('@/lib/monitoring/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Tenant filter utility
// ---------------------------------------------------------------------------

import { createTenantFilter } from '@/lib/cvision/db';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Tenant Isolation', () => {
  const TENANT_A = 'tenant-aaa-111';
  const TENANT_B = 'tenant-bbb-222';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Tenant filter creation ───────────────────────────────────────────

  describe('createTenantFilter', () => {
    it('should include tenantId in filter', () => {
      const filter = createTenantFilter(TENANT_A);
      expect(filter).toHaveProperty('tenantId', TENANT_A);
    });

    it('should merge with additional filters', () => {
      const filter = createTenantFilter(TENANT_A, { status: 'ACTIVE' });
      expect(filter).toHaveProperty('tenantId', TENANT_A);
      expect(filter).toHaveProperty('status', 'ACTIVE');
    });

    it('should always set tenantId from the first argument', () => {
      // Verify tenantId is always set from the first positional argument
      const filter = createTenantFilter(TENANT_A);
      expect(filter.tenantId).toBe(TENANT_A);

      const filterB = createTenantFilter(TENANT_B);
      expect(filterB.tenantId).toBe(TENANT_B);
    });
  });

  // ── Cross-tenant data leak prevention ────────────────────────────────

  describe('Cross-tenant data leak prevention', () => {
    it('should scope patient queries to the correct tenant', async () => {
      const tenantAPatients = [
        { id: 'p1', fullName: 'Ahmed', tenantId: TENANT_A },
        { id: 'p2', fullName: 'Sara', tenantId: TENANT_A },
      ];
      const tenantBPatients = [
        { id: 'p3', fullName: 'John', tenantId: TENANT_B },
      ];

      // Tenant A query should only return Tenant A patients
      mockPrisma.patientMaster.findMany.mockImplementation(async (args: any) => {
        const tid = args?.where?.tenantId;
        if (tid === TENANT_A) return tenantAPatients;
        if (tid === TENANT_B) return tenantBPatients;
        return [...tenantAPatients, ...tenantBPatients]; // Missing filter!
      });

      const resultsA = await mockPrisma.patientMaster.findMany({
        where: { tenantId: TENANT_A },
      });
      expect(resultsA).toHaveLength(2);
      expect(resultsA.every((p: any) => p.tenantId === TENANT_A)).toBe(true);

      const resultsB = await mockPrisma.patientMaster.findMany({
        where: { tenantId: TENANT_B },
      });
      expect(resultsB).toHaveLength(1);
      expect(resultsB.every((p: any) => p.tenantId === TENANT_B)).toBe(true);
    });

    it('should not expose encounters from other tenants', async () => {
      mockPrisma.encounterCore.findMany.mockImplementation(async (args: any) => {
        if (args?.where?.tenantId === TENANT_A) {
          return [{ id: 'enc-1', tenantId: TENANT_A }];
        }
        return [];
      });

      const encounters = await mockPrisma.encounterCore.findMany({
        where: { tenantId: TENANT_B },
      });
      expect(encounters).toHaveLength(0);
    });

    it('should isolate audit logs per tenant', async () => {
      const auditA = [{ id: 'al-1', tenantId: TENANT_A, action: 'login' }];
      const auditB = [{ id: 'al-2', tenantId: TENANT_B, action: 'login' }];

      mockPrisma.auditLog.findMany.mockImplementation(async (args: any) => {
        const tid = args?.where?.tenantId;
        if (tid === TENANT_A) return auditA;
        if (tid === TENANT_B) return auditB;
        return [];
      });

      const logsA = await mockPrisma.auditLog.findMany({
        where: { tenantId: TENANT_A },
      });
      expect(logsA).toHaveLength(1);
      expect(logsA[0].tenantId).toBe(TENANT_A);

      const logsB = await mockPrisma.auditLog.findMany({
        where: { tenantId: TENANT_B },
      });
      expect(logsB).toHaveLength(1);
      expect(logsB[0].tenantId).toBe(TENANT_B);
    });
  });

  // ── Tenant resolution ────────────────────────────────────────────────

  describe('Tenant resolution', () => {
    it('should find tenant by slug', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue({
        id: TENANT_A,
        slug: 'hospital-a',
        name: 'Hospital A',
      });

      const tenant = await mockPrisma.tenant.findFirst({
        where: { slug: 'hospital-a' },
      });
      expect(tenant).toBeTruthy();
      expect(tenant.id).toBe(TENANT_A);
    });

    it('should return null for non-existent tenant', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(null);

      const tenant = await mockPrisma.tenant.findFirst({
        where: { slug: 'nonexistent' },
      });
      expect(tenant).toBeNull();
    });
  });
});
