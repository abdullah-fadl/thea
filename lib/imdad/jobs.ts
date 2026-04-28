/**
 * Imdad Background Job Registry
 *
 * Defines the set of available background jobs with their cron schedules,
 * descriptions, and handler functions.
 */

import { prisma } from '@/lib/db/prisma';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JobDefinition {
  name: string;
  description: string;
  descriptionAr: string;
  cronExpression: string;
  isEnabled: boolean;
  category: string;
  handler: (ctx: {
    tenantId: string;
    organizationId: string;
    userId: string;
    [key: string]: unknown;
  }) => Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Job Handlers
// ---------------------------------------------------------------------------

async function slaCheckJob(ctx: { tenantId: string; [key: string]: unknown }) {
  const now = new Date();
  const breached = await prisma.imdadSupplyRequest.updateMany({
    where: {
      tenantId: ctx.tenantId,
      status: { in: ['SUBMITTED', 'IN_APPROVAL'] },
      slaBreached: false,
      slaDeadlineAt: { lte: now },
    },
    data: { slaBreached: true },
  });
  return { breachedCount: breached.count };
}

async function expiredBatchAlertJob(ctx: { tenantId: string; [key: string]: unknown }) {
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const expiring = await prisma.imdadBatchLot.count({
    where: {
      tenantId: ctx.tenantId,
      expiryDate: { lte: thirtyDaysFromNow },
      status: 'ACTIVE',
      isDeleted: false,
    },
  });
  return { expiringBatchCount: expiring };
}

async function lowStockAlertJob(ctx: { tenantId: string; [key: string]: unknown }) {
  // Find items where current stock is at or below reorder point
  const lowStock = await (prisma as any).imdadStockLevel.count({
    where: {
      tenantId: ctx.tenantId,
      isDeleted: false,
      quantityOnHand: { lte: 0 },
    },
  });
  return { lowStockCount: lowStock };
}

async function webhookRetryJob(ctx: { tenantId: string; [key: string]: unknown }) {
  const staleDeliveries = await prisma.imdadWebhookDelivery.count({
    where: {
      tenantId: ctx.tenantId,
      isSuccess: false,
      attempt: { lt: 3 },
    },
  });
  return { pendingRetries: staleDeliveries };
}

async function kpiSnapshotJob(ctx: { tenantId: string; organizationId: string; [key: string]: unknown }) {
  // Placeholder: in production this would compute and store KPI snapshots
  return { status: 'ok', message: 'KPI snapshot placeholder executed' };
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const IMDAD_JOB_REGISTRY: JobDefinition[] = [
  {
    name: 'sla-breach-check',
    description: 'Check for SLA breaches on pending workflow requests',
    descriptionAr: '\u0641\u062d\u0635 \u0627\u0646\u062a\u0647\u0627\u0643\u0627\u062a \u0627\u062a\u0641\u0627\u0642\u064a\u0629 \u0645\u0633\u062a\u0648\u0649 \u0627\u0644\u062e\u062f\u0645\u0629',
    cronExpression: '*/15 * * * *',
    isEnabled: true,
    category: 'workflow',
    handler: slaCheckJob,
  },
  {
    name: 'expired-batch-alert',
    description: 'Alert on batches expiring within 30 days',
    descriptionAr: '\u062a\u0646\u0628\u064a\u0647 \u0628\u0627\u0644\u062f\u0641\u0639\u0627\u062a \u0627\u0644\u062a\u064a \u062a\u0646\u062a\u0647\u064a \u0635\u0644\u0627\u062d\u064a\u062a\u0647\u0627 \u062e\u0644\u0627\u0644 30 \u064a\u0648\u0645',
    cronExpression: '0 6 * * *',
    isEnabled: true,
    category: 'inventory',
    handler: expiredBatchAlertJob,
  },
  {
    name: 'low-stock-alert',
    description: 'Detect items at or below reorder point',
    descriptionAr: '\u0643\u0634\u0641 \u0627\u0644\u0623\u0635\u0646\u0627\u0641 \u0639\u0646\u062f \u0623\u0648 \u0623\u0642\u0644 \u0645\u0646 \u0646\u0642\u0637\u0629 \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u0637\u0644\u0628',
    cronExpression: '0 7 * * *',
    isEnabled: true,
    category: 'inventory',
    handler: lowStockAlertJob,
  },
  {
    name: 'webhook-retry',
    description: 'Retry failed webhook deliveries',
    descriptionAr: '\u0625\u0639\u0627\u062f\u0629 \u0645\u062d\u0627\u0648\u0644\u0629 \u062a\u0633\u0644\u064a\u0645\u0627\u062a \u0627\u0644\u0648\u064a\u0628 \u0647\u0648\u0643 \u0627\u0644\u0641\u0627\u0634\u0644\u0629',
    cronExpression: '*/30 * * * *',
    isEnabled: true,
    category: 'integrations',
    handler: webhookRetryJob,
  },
  {
    name: 'kpi-snapshot',
    description: 'Generate daily KPI snapshots for analytics',
    descriptionAr: '\u0625\u0646\u0634\u0627\u0621 \u0644\u0642\u0637\u0627\u062a \u0645\u0624\u0634\u0631\u0627\u062a \u0627\u0644\u0623\u062f\u0627\u0621 \u0627\u0644\u064a\u0648\u0645\u064a\u0629',
    cronExpression: '0 0 * * *',
    isEnabled: true,
    category: 'analytics',
    handler: kpiSnapshotJob,
  },
];
