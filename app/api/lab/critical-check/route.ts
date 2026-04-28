/**
 * Lab Critical Value Check API
 *
 * POST /api/lab/critical-check
 *
 * Accepts an array of lab results, runs them through the critical/panic
 * value detection engine, and returns any alerts found. For PANIC-level
 * alerts, automatically emits notifications to the ordering physician
 * and charge nurse via the notification system.
 *
 * Permission: lab.results (any user who can view lab results can trigger checks)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { validateBody } from '@/lib/validation/helpers';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { emitNotification, emitNotificationToRole } from '@/lib/notifications/emit';
import {
  processBatchLabResults,
  buildCriticalAlertNotificationMessage,
  type CriticalLabAlert,
} from '@/lib/clinical/criticalLabValues';
import { logger } from '@/lib/monitoring/logger';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const labResultInputSchema = z.object({
  testCode: z.string().min(1, 'testCode is required'),
  testName: z.string().min(1, 'testName is required'),
  value: z.number({ error: 'value is required' }),
  unit: z.string().default(''),
  patientId: z.string().min(1, 'patientId is required'),
  encounterId: z.string().optional(),
  patientAge: z.number().optional(),
  orderedBy: z.string().optional(),
});

const requestBodySchema = z.object({
  results: z.array(labResultInputSchema).min(1, 'At least one lab result is required').max(200, 'Maximum 200 results per batch'),
});

// ---------------------------------------------------------------------------
// Route config
// ---------------------------------------------------------------------------

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, requestBodySchema);
    if ('error' in v) return v.error;
    const { results } = v.data;

    // Run the critical value detection engine
    const batchResult = processBatchLabResults(results);

    // If no alerts, return early
    if (batchResult.alerts.length === 0) {
      return NextResponse.json({
        alerts: [],
        criticalCount: 0,
        panicCount: 0,
        requiresImmediateAction: false,
      });
    }

    // Log the detection event
    logger.warn('[CriticalLabCheck] Critical values detected', {
      category: 'clinical',
      tenantId,
      userId,
      criticalCount: batchResult.criticalCount,
      panicCount: batchResult.panicCount,
    } as Prisma.InputJsonValue);

    // Persist alerts to the database
    const persistedAlerts: string[] = [];
    for (const alert of batchResult.alerts) {
      try {
        const saved = await prisma.labCriticalAlert.create({
          data: {
            tenantId,
            testCode: alert.testCode,
            testName: alert.testName,
            patientId: alert.patientId,
            encounterId: alert.encounterId || null,
            value: String(alert.value),
            unit: alert.unit,
            criticalType: `${alert.severity}_${alert.threshold.type}`,
            threshold: String(alert.threshold.criticalValue),
            source: 'critical-check-api',
          },
        });
        persistedAlerts.push(saved.id);
      } catch (err) {
        logger.error('[CriticalLabCheck] Failed to persist alert', {
          category: 'clinical',
          error: err instanceof Error ? err : undefined,
        } as unknown as Prisma.InputJsonValue);
      }
    }

    // For PANIC-level alerts, emit notifications
    const panicAlerts = batchResult.alerts.filter((a) => a.severity === 'PANIC');
    if (panicAlerts.length > 0) {
      await emitPanicNotifications(panicAlerts, tenantId, userId, user?.email);
    }

    return NextResponse.json({
      alerts: batchResult.alerts,
      criticalCount: batchResult.criticalCount,
      panicCount: batchResult.panicCount,
      requiresImmediateAction: batchResult.requiresImmediateAction,
      persistedAlertIds: persistedAlerts,
    });
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKey: 'lab.results.create',
  },
);

// ---------------------------------------------------------------------------
// GET handler — list critical thresholds reference
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  withErrorHandler(async () => {
    // Dynamic import to keep the handler lean
    const { getSupportedCriticalTestCodes } = await import('@/lib/clinical/criticalLabValues');
    const codes = getSupportedCriticalTestCodes();

    return NextResponse.json({
      thresholds: codes,
      count: codes.length,
      standards: {
        notificationTimelineCritical: '30 minutes',
        notificationTimelinePanic: '15 minutes',
        readBackRequired: true,
        guidelines: ['CAP Critical Values Consensus', 'CLSI GP47', 'CBAHI Standards'],
      },
    });
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKey: 'lab.results.create',
  },
);

// ---------------------------------------------------------------------------
// Notification helper
// ---------------------------------------------------------------------------

async function emitPanicNotifications(
  alerts: CriticalLabAlert[],
  tenantId: string,
  actorUserId: string,
  actorEmail?: string,
): Promise<void> {
  for (const alert of alerts) {
    const msg = buildCriticalAlertNotificationMessage(alert);

    try {
      // Notify the ordering physician directly if known
      if (alert.encounterId) {
        // Try to find the ordering doctor from the encounter
        const encounter = await prisma.encounterCore.findFirst({
          where: { tenantId, id: alert.encounterId },
          select: { createdByUserId: true },
        });

        const physicianId = encounter?.createdByUserId;
        if (physicianId) {
          await emitNotification({
            tenantId,
            recipientUserId: physicianId,
            scope: 'RESULTS',
            kind: 'PANIC_LAB_VALUE',
            severity: 'CRITICAL',
            title: msg.title,
            message: msg.message,
            entity: {
              type: 'lab_critical_alert',
              id: alert.testCode,
              patientMasterId: alert.patientId,
              encounterCoreId: alert.encounterId || null,
            },
            dedupeKey: `panic_lab_${alert.testCode}_${alert.patientId}_${alert.value}_${alert.detectedAt}`,
            actorUserId,
            actorUserEmail: actorEmail,
          });
        }
      }

      // Also notify charge nurses (role-based broadcast)
      await emitNotificationToRole({
        tenantId,
        recipientRole: 'CHARGE',
        scope: 'RESULTS',
        kind: 'PANIC_LAB_VALUE',
        severity: 'CRITICAL',
        title: msg.title,
        message: msg.message,
        entity: {
          type: 'lab_critical_alert',
          id: alert.testCode,
          patientMasterId: alert.patientId,
          encounterCoreId: alert.encounterId || null,
        },
        dedupeKey: `panic_lab_charge_${alert.testCode}_${alert.patientId}_${alert.value}_${alert.detectedAt}`,
        actorUserId,
        actorUserEmail: actorEmail,
      });
    } catch (err) {
      // Notification failure should NOT block the critical alert response
      logger.error('[CriticalLabCheck] Failed to emit panic notification', {
        category: 'clinical',
        error: err instanceof Error ? err : undefined,
      } as unknown as Prisma.InputJsonValue);
    }
  }
}
