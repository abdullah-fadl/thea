import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Default thresholds (can be overridden per-tenant via TenantSettings)
const DEFAULT_LAB_OVERDUE_HOURS = 48;
const DEFAULT_RAD_OVERDUE_HOURS = 72;
const DEFAULT_FOLLOWUP_OVERDUE_DAYS = 14;
const DEFAULT_PROCEDURE_OVERDUE_DAYS = 30;

/**
 * GET /api/cron/care-gaps-scanner?secret=...
 *
 * Scans all tenants for overdue orders and creates care gaps automatically.
 * Triggered by Vercel Cron or manual invocation.
 *
 * Looks at OrdersHub for orders that have been in ORDERED status
 * past their expected fulfillment window.
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  // 1. Validate cron secret
  if (!env.CRON_SECRET) {
    logger.error('CRON_SECRET environment variable is not set', { category: 'opd' });
    return NextResponse.json({ error: 'Cron secret not configured' }, { status: 500 });
  }

  const headerSecret = request.headers.get('x-cron-secret');
  const querySecret = request.nextUrl.searchParams.get('secret');
  const providedSecret = headerSecret || querySecret;

  if (!providedSecret || providedSecret !== env.CRON_SECRET) {
    logger.warn('Unauthorized cron request - invalid secret', { category: 'opd' });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  let totalScanned = 0;
  let totalCreated = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  try {
    // 2. Get all active tenants that have the health entitlement
    const tenants = await prisma.tenant.findMany({
      where: {
        status: 'ACTIVE',
        entitlementHealth: true,
      },
      select: { id: true, tenantId: true },
    });

    for (const tenant of tenants) {
      try {
        // 3. Load tenant-specific settings for care gap thresholds
        const tenantSettings = await prisma.tenantSetting.findUnique({
          where: {
            tenantId_key: {
              tenantId: tenant.id,
              key: 'care_gaps',
            },
          },
        });

        const settings = (tenantSettings?.settings as Record<string, unknown>) || {};
        const labOverdueHours = Number(settings.labOverdueHours) || DEFAULT_LAB_OVERDUE_HOURS;
        const radOverdueHours = Number(settings.radOverdueHours) || DEFAULT_RAD_OVERDUE_HOURS;
        const followupOverdueDays = Number(settings.followupOverdueDays) || DEFAULT_FOLLOWUP_OVERDUE_DAYS;
        const procedureOverdueDays = Number(settings.procedureOverdueDays) || DEFAULT_PROCEDURE_OVERDUE_DAYS;
        const enabled = settings.enabled !== false; // Default: enabled

        if (!enabled) continue;

        // 4. Find overdue LAB orders
        const labCutoff = new Date(now.getTime() - labOverdueHours * 60 * 60 * 1000);
        const overdueLabOrders = await prisma.ordersHub.findMany({
          where: {
            tenantId: tenant.id,
            kind: 'LAB',
            status: 'ORDERED',
            orderedAt: { lt: labCutoff },
          },
          select: {
            id: true,
            patientMasterId: true,
            encounterCoreId: true,
            orderName: true,
            orderNameAr: true,
            priority: true,
            orderedAt: true,
          },
        });
        totalScanned += overdueLabOrders.length;

        for (const order of overdueLabOrders) {
          if (!order.patientMasterId) continue;
          const created = await createGapIfNotExists(tenant.id, {
            patientMasterId: order.patientMasterId,
            encounterCoreId: order.encounterCoreId,
            gapType: 'LAB_OVERDUE',
            sourceOrderId: order.id,
            sourceOrderKind: 'LAB',
            sourceOrderName: order.orderName,
            sourceOrderNameAr: order.orderNameAr,
            reason: `Lab order "${order.orderName}" overdue (ordered ${formatTimeAgo(order.orderedAt, now)})`,
            reasonAr: `تحليل "${order.orderNameAr || order.orderName}" متأخر`,
            dueAt: order.orderedAt ? new Date(new Date(order.orderedAt).getTime() + labOverdueHours * 60 * 60 * 1000) : null,
            priority: order.priority || 'ROUTINE',
            severityScore: calculateSeverity('LAB', order.orderedAt, now),
          });
          if (created) totalCreated++;
          else totalSkipped++;
        }

        // 5. Find overdue RADIOLOGY orders
        const radCutoff = new Date(now.getTime() - radOverdueHours * 60 * 60 * 1000);
        const overdueRadOrders = await prisma.ordersHub.findMany({
          where: {
            tenantId: tenant.id,
            kind: { in: ['RADIOLOGY', 'RAD'] },
            status: 'ORDERED',
            orderedAt: { lt: radCutoff },
          },
          select: {
            id: true,
            patientMasterId: true,
            encounterCoreId: true,
            orderName: true,
            orderNameAr: true,
            priority: true,
            orderedAt: true,
          },
        });
        totalScanned += overdueRadOrders.length;

        for (const order of overdueRadOrders) {
          if (!order.patientMasterId) continue;
          const created = await createGapIfNotExists(tenant.id, {
            patientMasterId: order.patientMasterId,
            encounterCoreId: order.encounterCoreId,
            gapType: 'RAD_OVERDUE',
            sourceOrderId: order.id,
            sourceOrderKind: 'RADIOLOGY',
            sourceOrderName: order.orderName,
            sourceOrderNameAr: order.orderNameAr,
            reason: `Radiology order "${order.orderName}" overdue (ordered ${formatTimeAgo(order.orderedAt, now)})`,
            reasonAr: `أشعة "${order.orderNameAr || order.orderName}" متأخرة`,
            dueAt: order.orderedAt ? new Date(new Date(order.orderedAt).getTime() + radOverdueHours * 60 * 60 * 1000) : null,
            priority: order.priority || 'ROUTINE',
            severityScore: calculateSeverity('RADIOLOGY', order.orderedAt, now),
          });
          if (created) totalCreated++;
          else totalSkipped++;
        }

        // 6. Find completed encounters without follow-up (FOLLOWUP_MISSED)
        const followupCutoff = new Date(now.getTime() - followupOverdueDays * 24 * 60 * 60 * 1000);
        const encountersNeedingFollowup = await prisma.opdRecommendation.findMany({
          where: {
            tenantId: tenant.id,
            type: 'clinical',
            status: 'pending',
            createdAt: { lt: followupCutoff },
          },
          select: {
            id: true,
            encounterId: true,
            patientId: true,
            title: true,
            createdAt: true,
          },
        });
        totalScanned += encountersNeedingFollowup.length;

        for (const rec of encountersNeedingFollowup) {
          if (!rec.patientId) continue;
          const created = await createGapIfNotExists(tenant.id, {
            patientMasterId: rec.patientId,
            encounterCoreId: rec.encounterId,
            gapType: 'FOLLOWUP_MISSED',
            sourceOrderId: rec.id,
            sourceOrderKind: 'FOLLOW_UP',
            sourceOrderName: rec.title || 'Follow-up visit',
            sourceOrderNameAr: 'زيارة متابعة',
            reason: `Follow-up recommended but not scheduled (${formatTimeAgo(rec.createdAt, now)})`,
            reasonAr: 'تم التوصية بمتابعة ولم تتم جدولتها',
            dueAt: new Date(new Date(rec.createdAt).getTime() + followupOverdueDays * 24 * 60 * 60 * 1000),
            priority: 'ROUTINE',
            severityScore: calculateSeverity('FOLLOWUP', rec.createdAt, now),
          });
          if (created) totalCreated++;
          else totalSkipped++;
        }
        // 7. Find overdue PROCEDURE orders
        // Procedures use meta.dueWithinDays if set, otherwise fall back to default threshold
        const procedureCutoff = new Date(now.getTime() - procedureOverdueDays * 24 * 60 * 60 * 1000);
        const overdueProcedureOrders = await prisma.ordersHub.findMany({
          where: {
            tenantId: tenant.id,
            kind: 'PROCEDURE',
            status: 'ORDERED',
            orderedAt: { lt: procedureCutoff },
          },
          select: {
            id: true,
            patientMasterId: true,
            encounterCoreId: true,
            orderName: true,
            orderNameAr: true,
            priority: true,
            orderedAt: true,
            meta: true,
          },
        });
        totalScanned += overdueProcedureOrders.length;

        for (const order of overdueProcedureOrders) {
          if (!order.patientMasterId) continue;

          // Use per-order dueWithinDays from meta if available, otherwise default
          const meta = (order.meta as Record<string, unknown>) || {};
          const orderDueDays = Number(meta.dueWithinDays) || procedureOverdueDays;
          const orderDueAt = order.orderedAt
            ? new Date(new Date(order.orderedAt).getTime() + orderDueDays * 24 * 60 * 60 * 1000)
            : null;

          // Only flag as overdue if actually past the per-order due date
          if (orderDueAt && orderDueAt > now) continue;

          const created = await createGapIfNotExists(tenant.id, {
            patientMasterId: order.patientMasterId,
            encounterCoreId: order.encounterCoreId,
            gapType: 'PROCEDURE_OVERDUE',
            sourceOrderId: order.id,
            sourceOrderKind: 'PROCEDURE',
            sourceOrderName: order.orderName,
            sourceOrderNameAr: order.orderNameAr,
            reason: `Procedure "${order.orderName}" overdue (ordered ${formatTimeAgo(order.orderedAt, now)}, due within ${orderDueDays}d)`,
            reasonAr: `إجراء "${order.orderNameAr || order.orderName}" متأخر`,
            dueAt: orderDueAt,
            priority: order.priority || 'ROUTINE',
            severityScore: calculateSeverity('PROCEDURE', order.orderedAt, now),
          });
          if (created) totalCreated++;
          else totalSkipped++;
        }
      } catch (tenantError: any) {
        const msg = `Error scanning tenant ${tenant.tenantId}: ${tenantError.message}`;
        logger.error(msg, { category: 'opd' });
        errors.push(msg);
      }
    }

    logger.info(`Care gaps scanner completed: scanned=${totalScanned}, created=${totalCreated}, skipped=${totalSkipped}`, {
      category: 'opd',
    });

    return NextResponse.json({
      ok: true,
      scanned: totalScanned,
      created: totalCreated,
      skipped: totalSkipped,
      tenantsProcessed: tenants.length,
      ...(errors.length > 0 && { errors }),
    });
  } catch (err: any) {
    logger.error(`Care gaps scanner failed: ${err.message}`, { category: 'opd' });
    return NextResponse.json({ error: 'Scanner failed', message: err.message }, { status: 500 });
  }
});

/**
 * Helper: Create a care gap only if one doesn't already exist for the same order.
 */
async function createGapIfNotExists(
  tenantId: string,
  data: {
    patientMasterId: string;
    encounterCoreId: string | null;
    gapType: string;
    sourceOrderId: string;
    sourceOrderKind: string | null;
    sourceOrderName: string | null;
    sourceOrderNameAr: string | null;
    reason: string | null;
    reasonAr: string | null;
    dueAt: Date | null;
    priority: string;
    severityScore: number;
  }
): Promise<boolean> {
  try {
    await prisma.careGap.create({
      data: {
        tenantId,
        ...data,
        status: 'OPEN',
        createdByUserId: null, // System-created
      },
    });
    return true;
  } catch (err: any) {
    // Unique constraint violation — gap already exists for this order
    if (err.code === 'P2002') {
      return false;
    }
    throw err;
  }
}

/**
 * Calculate severity score based on how overdue the order is.
 * 0–100 scale, higher = more severe.
 */
function calculateSeverity(kind: string, orderedAt: Date | null, now: Date): number {
  if (!orderedAt) return 50;

  const hoursOverdue = (now.getTime() - new Date(orderedAt).getTime()) / (1000 * 60 * 60);

  let baseSeverity: number;
  switch (kind) {
    case 'LAB':
      // 48h = 50, 96h = 75, 168h+ = 90
      baseSeverity = Math.min(90, 50 + (hoursOverdue - 48) * 0.3);
      break;
    case 'RADIOLOGY':
      // 72h = 50, 144h = 75, 240h+ = 90
      baseSeverity = Math.min(90, 50 + (hoursOverdue - 72) * 0.2);
      break;
    case 'PROCEDURE':
      // 30d = 50, 60d = 65, 90d+ = 85
      const procDaysOverdue = hoursOverdue / 24;
      baseSeverity = Math.min(85, 50 + (procDaysOverdue - 30) * 0.25);
      break;
    case 'FOLLOWUP':
      // 14d = 50, 30d = 75, 60d+ = 90
      const daysOverdue = hoursOverdue / 24;
      baseSeverity = Math.min(90, 50 + (daysOverdue - 14) * 0.5);
      break;
    default:
      baseSeverity = 50;
  }

  return Math.round(Math.max(10, Math.min(100, baseSeverity)));
}

/**
 * Format a relative time string, e.g. "2 days ago".
 */
function formatTimeAgo(date: Date | null, now: Date): string {
  if (!date) return 'unknown time';
  const diffMs = now.getTime() - new Date(date).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
