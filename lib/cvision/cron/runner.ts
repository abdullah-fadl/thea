import { getCVisionDb } from '@/lib/cvision/db';

export interface CronJob {
  name: string;
  schedule: string;
  description: string;
  handler: (tenantId: string) => Promise<{ itemsProcessed: number }>;
  enabled: boolean;
}

export const CRON_JOBS: CronJob[] = [
  {
    name: 'process_email_queue',
    schedule: '*/5 * * * *',
    description: 'Process pending email queue',
    handler: async (tenantId) => {
      const { processQueue } = await import('@/lib/cvision/email/queue');
      const result = await processQueue(tenantId);
      return { itemsProcessed: result.processed };
    },
    enabled: true,
  },
  {
    name: 'expiry_alerts',
    schedule: '0 8 * * *',
    description: 'Check document/contract expiry and send alerts',
    handler: async (tenantId) => {
      const db = await getCVisionDb(tenantId);
      const thirtyDays = new Date(); thirtyDays.setDate(thirtyDays.getDate() + 30);
      const expiring = await db.collection('cvision_employees').countDocuments({
        tenantId, status: { $in: ['ACTIVE', 'active'] },
        $or: [{ iqamaExpiry: { $lte: thirtyDays } }, { passportExpiry: { $lte: thirtyDays } }],
      });
      return { itemsProcessed: expiring };
    },
    enabled: true,
  },
  {
    name: 'sla_escalation',
    schedule: '0 * * * *',
    description: 'Escalate workflow instances exceeding SLA',
    handler: async (tenantId) => {
      const db = await getCVisionDb(tenantId);
      const now = new Date();
      const overdue = await db.collection('cvision_workflow_instances').updateMany(
        { tenantId, status: 'PENDING', slaDeadline: { $lt: now } },
        { $set: { escalated: true, escalatedAt: now } },
      );
      return { itemsProcessed: overdue.modifiedCount };
    },
    enabled: true,
  },
  {
    name: 'report_scheduler',
    schedule: '0 6 * * *',
    description: 'Generate scheduled reports',
    handler: async (tenantId) => {
      const db = await getCVisionDb(tenantId);
      const now = new Date();
      const due = await db.collection('cvision_report_schedules').countDocuments({
        tenantId, isActive: true, nextRun: { $lte: now },
      });
      return { itemsProcessed: due };
    },
    enabled: true,
  },
  {
    name: 'etl_daily',
    schedule: '0 2 * * *',
    description: 'Run data warehouse ETL',
    handler: async (tenantId) => {
      const { runETL } = await import('@/lib/cvision/data-warehouse/etl');
      const db = await getCVisionDb(tenantId);
      const results = await runETL(db, tenantId);
      return { itemsProcessed: results.reduce((s, r) => s + r.rowCount, 0) };
    },
    enabled: true,
  },
  {
    name: 'expire_contracts',
    schedule: '0 1 * * *',
    description: 'Mark contracts past their end date as EXPIRED',
    handler: async (tenantId) => {
      const db = await getCVisionDb(tenantId);
      const today = new Date().toISOString().split('T')[0];
      const result = await db.collection('cvision_contracts').updateMany(
        { tenantId, status: 'ACTIVE', endDate: { $lt: today } },
        { $set: { status: 'EXPIRED', updatedAt: new Date() } },
      );
      return { itemsProcessed: result.modifiedCount };
    },
    enabled: true,
  },
  {
    name: 'manage_delegations',
    schedule: '0 0 * * *',
    description: 'Activate pending delegations whose start date has arrived and expire past-due ones',
    handler: async (tenantId) => {
      const db = await getCVisionDb(tenantId);
      const now = new Date();
      // Activate PENDING delegations whose start date has arrived
      const activated = await db.collection('cvision_delegations').updateMany(
        { tenantId, status: 'PENDING', startDate: { $lte: now }, endDate: { $gte: now } },
        { $set: { status: 'ACTIVE', isActive: true, updatedAt: now } },
      );
      // Expire delegations past their end date
      const expired = await db.collection('cvision_delegations').updateMany(
        { tenantId, endDate: { $lt: now }, $or: [{ status: 'ACTIVE' }, { status: 'PENDING' }, { isActive: true }] },
        { $set: { status: 'EXPIRED', isActive: false, updatedAt: now } },
      );
      return { itemsProcessed: activated.modifiedCount + expired.modifiedCount };
    },
    enabled: true,
  },
  {
    name: 'cleanup_expired',
    schedule: '0 3 * * 0',
    description: 'Cleanup old notifications and expired records',
    handler: async (tenantId) => {
      const db = await getCVisionDb(tenantId);
      const ninetyDaysAgo = new Date(); ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const deleted = await db.collection('cvision_notifications').deleteMany({ tenantId, read: true, createdAt: { $lt: ninetyDaysAgo } });
      return { itemsProcessed: deleted.deletedCount };
    },
    enabled: true,
  },
];

export async function runJob(tenantId: string, jobName: string): Promise<{ success: boolean; itemsProcessed: number; durationMs: number; error?: string }> {
  const job = CRON_JOBS.find(j => j.name === jobName);
  if (!job) return { success: false, itemsProcessed: 0, durationMs: 0, error: 'Job not found' };

  const start = Date.now();
  try {
    const result = await job.handler(tenantId);
    const durationMs = Date.now() - start;

    const db = await getCVisionDb(tenantId);
    await db.collection('cvision_cron_logs').insertOne({
      tenantId, jobName, startedAt: new Date(start), completedAt: new Date(),
      status: 'SUCCESS', itemsProcessed: result.itemsProcessed, durationMs,
    });

    return { success: true, itemsProcessed: result.itemsProcessed, durationMs };
  } catch (e: any) {
    const durationMs = Date.now() - start;
    const db = await getCVisionDb(tenantId);
    await db.collection('cvision_cron_logs').insertOne({
      tenantId, jobName, startedAt: new Date(start), completedAt: new Date(),
      status: 'FAILED', error: e.message, itemsProcessed: 0, durationMs,
    });
    return { success: false, itemsProcessed: 0, durationMs, error: e.message };
  }
}

export function shouldRun(schedule: string, lastRun: Date | null): boolean {
  if (!lastRun) return true;
  const parts = schedule.split(' ');
  const now = new Date();
  const sinceLastRun = now.getTime() - lastRun.getTime();

  if (parts[0].startsWith('*/')) {
    const interval = parseInt(parts[0].slice(2)) * 60000;
    return sinceLastRun >= interval;
  }
  if (parts[1] === '*' && parts[0] === '0') return sinceLastRun >= 3600000;
  return sinceLastRun >= 86400000;
}
