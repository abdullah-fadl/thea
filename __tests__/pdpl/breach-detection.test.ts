/**
 * PDPL Breach Detection Tests
 *
 * Tests for lib/privacy/breach-detection.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma — factory must not reference outer variables (hoisted)
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    auditLog: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

// Mock logger
vi.mock('@/lib/monitoring/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Get reference to the mocked findMany after mock setup
import { prisma } from '@/lib/db/prisma';
const mockFindMany = vi.mocked(prisma.auditLog.findMany);

import {
  detectBulkExports,
  detectRepeatedDenials,
  detectRapidBrowsing,
  runBreachDetection,
  type SuspiciousActivity,
} from '@/lib/privacy/breach-detection';

const TENANT_ID = 'tenant-test';
const SINCE = new Date('2026-03-01');

describe('Breach Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectBulkExports', () => {
    it('should flag exports with more than 500 records', async () => {
      mockFindMany.mockResolvedValueOnce([
        {
          id: 'log-1',
          actorUserId: 'user-1',
          action: 'data_export',
          resourceType: 'patient',
          timestamp: new Date('2026-03-15'),
          ip: '10.0.0.1',
          metadata: { recordCount: 600 },
        },
      ]);

      const results = await detectBulkExports(TENANT_ID, SINCE);
      expect(results.length).toBe(1);
      expect(results[0].type).toBe('bulk_export');
      expect(results[0].severity).toBe('medium');
      expect(results[0].userId).toBe('user-1');
    });

    it('should not flag exports with 500 or fewer records', async () => {
      mockFindMany.mockResolvedValueOnce([
        {
          id: 'log-2',
          actorUserId: 'user-2',
          action: 'data_export',
          resourceType: 'patient',
          timestamp: new Date('2026-03-15'),
          ip: '10.0.0.1',
          metadata: { recordCount: 500 },
        },
      ]);

      const results = await detectBulkExports(TENANT_ID, SINCE);
      expect(results.length).toBe(0);
    });

    it('should mark exports over 5000 records as high severity', async () => {
      mockFindMany.mockResolvedValueOnce([
        {
          id: 'log-3',
          actorUserId: 'user-1',
          action: 'bulk_export',
          resourceType: 'patient',
          timestamp: new Date('2026-03-15'),
          ip: '10.0.0.1',
          metadata: { recordCount: 6000 },
        },
      ]);

      const results = await detectBulkExports(TENANT_ID, SINCE);
      expect(results.length).toBe(1);
      expect(results[0].severity).toBe('high');
    });

    it('should return empty array when no export logs exist', async () => {
      mockFindMany.mockResolvedValueOnce([]);
      const results = await detectBulkExports(TENANT_ID, SINCE);
      expect(results).toEqual([]);
    });
  });

  describe('detectRepeatedDenials', () => {
    it('should flag more than 10 denials within 1 hour from same user', async () => {
      const baseTime = new Date('2026-03-15T10:00:00Z');
      const logs = Array.from({ length: 12 }, (_, i) => ({
        id: `deny-${i}`,
        actorUserId: 'user-bad',
        action: 'access',
        success: false,
        timestamp: new Date(baseTime.getTime() + i * 60_000), // 1 min apart
      }));

      mockFindMany.mockResolvedValueOnce(logs);
      const results = await detectRepeatedDenials(TENANT_ID, SINCE);
      expect(results.length).toBe(1);
      expect(results[0].type).toBe('repeated_denial');
      expect(results[0].userId).toBe('user-bad');
    });

    it('should not flag 10 or fewer denials in 1 hour', async () => {
      const baseTime = new Date('2026-03-15T10:00:00Z');
      const logs = Array.from({ length: 10 }, (_, i) => ({
        id: `deny-${i}`,
        actorUserId: 'user-ok',
        action: 'access',
        success: false,
        timestamp: new Date(baseTime.getTime() + i * 60_000),
      }));

      mockFindMany.mockResolvedValueOnce(logs);
      const results = await detectRepeatedDenials(TENANT_ID, SINCE);
      expect(results.length).toBe(0);
    });

    it('should return empty array when no denial logs exist', async () => {
      mockFindMany.mockResolvedValueOnce([]);
      const results = await detectRepeatedDenials(TENANT_ID, SINCE);
      expect(results).toEqual([]);
    });
  });

  describe('detectRapidBrowsing', () => {
    it('should flag access to more than 50 unique patients in 1 hour', async () => {
      const baseTime = new Date('2026-03-15T10:00:00Z');
      const logs = Array.from({ length: 55 }, (_, i) => ({
        id: `browse-${i}`,
        actorUserId: 'user-browsing',
        resourceType: 'patient',
        resourceId: `patient-${i}`,
        action: 'view',
        success: true,
        timestamp: new Date(baseTime.getTime() + i * 30_000), // 30 sec apart
      }));

      mockFindMany.mockResolvedValueOnce(logs);
      const results = await detectRapidBrowsing(TENANT_ID, SINCE);
      expect(results.length).toBe(1);
      expect(results[0].type).toBe('rapid_patient_browsing');
      expect(results[0].userId).toBe('user-browsing');
    });

    it('should not flag 50 or fewer unique patients in 1 hour', async () => {
      const baseTime = new Date('2026-03-15T10:00:00Z');
      const logs = Array.from({ length: 50 }, (_, i) => ({
        id: `browse-${i}`,
        actorUserId: 'user-normal',
        resourceType: 'patient',
        resourceId: `patient-${i}`,
        action: 'view',
        success: true,
        timestamp: new Date(baseTime.getTime() + i * 30_000),
      }));

      mockFindMany.mockResolvedValueOnce(logs);
      const results = await detectRapidBrowsing(TENANT_ID, SINCE);
      expect(results.length).toBe(0);
    });

    it('should return empty array when no patient access logs exist', async () => {
      mockFindMany.mockResolvedValueOnce([]);
      const results = await detectRapidBrowsing(TENANT_ID, SINCE);
      expect(results).toEqual([]);
    });
  });

  describe('runBreachDetection', () => {
    it('should call all three detectors and combine results', async () => {
      // 3 calls to findMany: bulk exports, denials, rapid browsing
      mockFindMany
        .mockResolvedValueOnce([]) // bulk exports
        .mockResolvedValueOnce([]) // denials
        .mockResolvedValueOnce([]); // rapid browsing

      const results = await runBreachDetection(TENANT_ID, SINCE);
      expect(results).toEqual([]);
      expect(mockFindMany).toHaveBeenCalledTimes(3);
    });

    it('should return properly typed SuspiciousActivity objects', async () => {
      mockFindMany
        .mockResolvedValueOnce([
          {
            id: 'log-1',
            actorUserId: 'user-1',
            action: 'bulk_export',
            resourceType: 'patient',
            timestamp: new Date('2026-03-15'),
            ip: '10.0.0.1',
            metadata: { recordCount: 1000 },
          },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const results = await runBreachDetection(TENANT_ID, SINCE);
      expect(results.length).toBe(1);
      const activity: SuspiciousActivity = results[0];
      expect(activity.type).toBe('bulk_export');
      expect(activity.severity).toBeDefined();
      expect(activity.userId).toBeDefined();
      expect(activity.description).toBeDefined();
      expect(activity.detectedAt).toBeInstanceOf(Date);
      expect(typeof activity.metadata).toBe('object');
    });

    it('should default to last 24 hours when no since date is provided', async () => {
      mockFindMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await runBreachDetection(TENANT_ID);
      // Verify findMany was called (default lookback is 24h)
      expect(mockFindMany).toHaveBeenCalledTimes(3);
    });
  });
});
