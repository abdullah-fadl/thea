/**
 * Automated breach detection utilities.
 * Analyzes audit logs for suspicious patterns that may indicate a data breach.
 *
 * PDPL requires organizations to detect and report breaches promptly.
 * These checks run against the audit_logs table to identify:
 * - Bulk data exports (>500 records)
 * - Repeated access denials (>10 in 1 hour)
 * - Rapid patient browsing (>50 different patients in 1 hour)
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SuspiciousActivity {
  type: 'bulk_export' | 'repeated_denial' | 'off_hours_access' | 'break_glass_abuse' | 'rapid_patient_browsing';
  severity: 'low' | 'medium' | 'high';
  userId: string;
  description: string;
  detectedAt: Date;
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Detection: Bulk Exports (>500 records in a single export)
// ---------------------------------------------------------------------------

export async function detectBulkExports(tenantId: string, since: Date): Promise<SuspiciousActivity[]> {
  const results: SuspiciousActivity[] = [];

  try {
    const exportLogs = await prisma.auditLog.findMany({
      where: {
        tenantId,
        action: { in: ['data_export', 'bulk_export', 'report_export'] },
        timestamp: { gte: since },
      },
      orderBy: { timestamp: 'desc' },
      take: 500,
    });

    for (const log of exportLogs) {
      const meta = log.metadata as Record<string, unknown> | null;
      const recordCount = typeof meta?.recordCount === 'number' ? meta.recordCount : 0;

      if (recordCount > 500) {
        results.push({
          type: 'bulk_export',
          severity: recordCount > 5000 ? 'high' : 'medium',
          userId: log.actorUserId,
          description: `User exported ${recordCount} records in a single operation`,
          detectedAt: new Date(),
          metadata: {
            auditLogId: log.id,
            action: log.action,
            resourceType: log.resourceType,
            recordCount,
            timestamp: log.timestamp.toISOString(),
            ip: log.ip,
          },
        });
      }
    }
  } catch (error) {
    logger.error('Breach detection: bulk export check failed', { category: 'privacy', tenantId, error });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Detection: Repeated Access Denials (>10 in 1 hour from same user)
// ---------------------------------------------------------------------------

export async function detectRepeatedDenials(tenantId: string, since: Date): Promise<SuspiciousActivity[]> {
  const results: SuspiciousActivity[] = [];

  try {
    const denialLogs = await prisma.auditLog.findMany({
      where: {
        tenantId,
        success: false,
        timestamp: { gte: since },
      },
      orderBy: { timestamp: 'asc' },
      take: 1000,
    });

    // Group by userId and check for >10 denials within any 1-hour window
    const byUser = new Map<string, Date[]>();
    for (const log of denialLogs) {
      const existing = byUser.get(log.actorUserId) || [];
      existing.push(log.timestamp);
      byUser.set(log.actorUserId, existing);
    }

    const ONE_HOUR_MS = 60 * 60 * 1000;

    for (const [userId, timestamps] of Array.from(byUser.entries())) {
      // Sliding window: check if any 1-hour window has >10 denials
      for (let i = 0; i < timestamps.length; i++) {
        const windowStart = timestamps[i].getTime();
        let count = 0;

        for (let j = i; j < timestamps.length; j++) {
          if (timestamps[j].getTime() - windowStart <= ONE_HOUR_MS) {
            count++;
          } else {
            break;
          }
        }

        if (count > 10) {
          results.push({
            type: 'repeated_denial',
            severity: count > 50 ? 'high' : 'medium',
            userId,
            description: `User had ${count} access denials within 1 hour`,
            detectedAt: new Date(),
            metadata: {
              denialCount: count,
              windowStart: timestamps[i].toISOString(),
              windowEnd: new Date(windowStart + ONE_HOUR_MS).toISOString(),
            },
          });
          // Only report once per user
          break;
        }
      }
    }
  } catch (error) {
    logger.error('Breach detection: repeated denials check failed', { category: 'privacy', tenantId, error });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Detection: Rapid Patient Browsing (>50 different patients in 1 hour)
// ---------------------------------------------------------------------------

export async function detectRapidBrowsing(tenantId: string, since: Date): Promise<SuspiciousActivity[]> {
  const results: SuspiciousActivity[] = [];

  try {
    const patientAccessLogs = await prisma.auditLog.findMany({
      where: {
        tenantId,
        resourceType: { in: ['patient', 'encounter', 'clinical_note'] },
        action: { in: ['view', 'read', 'access', 'patient_view', 'encounter_view'] },
        success: true,
        timestamp: { gte: since },
      },
      orderBy: { timestamp: 'asc' },
      take: 5000,
    });

    // Group by user, then track unique resourceIds per 1-hour window
    const byUser = new Map<string, Array<{ resourceId: string; timestamp: Date }>>();

    for (const log of patientAccessLogs) {
      if (!log.resourceId) continue;
      const existing = byUser.get(log.actorUserId) || [];
      existing.push({ resourceId: log.resourceId, timestamp: log.timestamp });
      byUser.set(log.actorUserId, existing);
    }

    const ONE_HOUR_MS = 60 * 60 * 1000;

    for (const [userId, accesses] of Array.from(byUser.entries())) {
      for (let i = 0; i < accesses.length; i++) {
        const windowStart = accesses[i].timestamp.getTime();
        const uniqueIds = new Set<string>();

        for (let j = i; j < accesses.length; j++) {
          if (accesses[j].timestamp.getTime() - windowStart <= ONE_HOUR_MS) {
            uniqueIds.add(accesses[j].resourceId);
          } else {
            break;
          }
        }

        if (uniqueIds.size > 50) {
          results.push({
            type: 'rapid_patient_browsing',
            severity: uniqueIds.size > 200 ? 'high' : 'medium',
            userId,
            description: `User accessed ${uniqueIds.size} different patient records within 1 hour`,
            detectedAt: new Date(),
            metadata: {
              uniquePatientCount: uniqueIds.size,
              windowStart: accesses[i].timestamp.toISOString(),
            },
          });
          // Only report once per user
          break;
        }
      }
    }
  } catch (error) {
    logger.error('Breach detection: rapid browsing check failed', { category: 'privacy', tenantId, error });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Run all detection checks
// ---------------------------------------------------------------------------

export async function runBreachDetection(tenantId: string, since?: Date): Promise<SuspiciousActivity[]> {
  const lookbackDate = since || new Date(Date.now() - 24 * 60 * 60 * 1000); // Default: last 24 hours

  logger.info('Running breach detection checks', {
    category: 'privacy',
    tenantId,
    since: lookbackDate.toISOString(),
  });

  const [bulkExports, repeatedDenials, rapidBrowsing] = await Promise.all([
    detectBulkExports(tenantId, lookbackDate),
    detectRepeatedDenials(tenantId, lookbackDate),
    detectRapidBrowsing(tenantId, lookbackDate),
  ]);

  const allActivities = [...bulkExports, ...repeatedDenials, ...rapidBrowsing];

  if (allActivities.length > 0) {
    logger.warn('Suspicious activities detected', {
      category: 'privacy',
      tenantId,
      count: allActivities.length,
      types: allActivities.map((a) => a.type),
    });
  }

  return allActivities;
}
