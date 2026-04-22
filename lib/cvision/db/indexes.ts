import type { Db } from '@/lib/cvision/infra/mongo-compat';

/**
 * Ensure all performance-critical indexes are created.
 * Safe to call multiple times — createIndex is idempotent.
 */
export async function ensureAllIndexes(db: Db): Promise<{ created: string[] }> {
  const created: string[] = [];

  async function idx(coll: string, spec: any, opts?: any) {
    try {
      await db.collection(coll).createIndex(spec, opts);
      created.push(`${coll}: ${JSON.stringify(spec)}`);
    } catch {
      // Index may already exist with a different name — safe to ignore
    }
  }

  /* ── Employees (most queried) ────────────────────────────────────── */
  await idx('cvision_employees', { tenantId: 1, status: 1 });
  await idx('cvision_employees', { tenantId: 1, department: 1 });
  await idx('cvision_employees', { tenantId: 1, name: 1 });
  await idx('cvision_employees', { tenantId: 1, nationalId: 1 }, { unique: true, sparse: true });
  await idx('cvision_employees', { tenantId: 1, email: 1 }, { sparse: true });
  await idx('cvision_employees', { tenantId: 1, contractEndDate: 1 });
  await idx('cvision_employees', { tenantId: 1, iqamaExpiry: 1 });
  await idx('cvision_employees', { tenantId: 1, joinDate: -1 });

  /* ── Attendance (high volume) ────────────────────────────────────── */
  await idx('cvision_attendance', { tenantId: 1, employeeId: 1, date: -1 });
  await idx('cvision_attendance', { tenantId: 1, date: -1, status: 1 });

  /* ── Biometric logs (high volume) ──────────────────────────────── */
  await idx('cvision_biometric_logs', { tenantId: 1, timestamp: -1, verified: 1 });
  await idx('cvision_biometric_logs', { tenantId: 1, employeeId: 1, timestamp: -1 });

  /* ── Schedule entries (shift lookup) ───────────────────────────── */
  await idx('cvision_schedule_entries', { tenantId: 1, employeeId: 1, date: 1 });

  /* ── Payroll ─────────────────────────────────────────────────────── */
  await idx('cvision_payroll', { tenantId: 1, period: 1, status: 1 });
  await idx('cvision_payroll', { tenantId: 1, employeeId: 1, period: -1 });

  /* ── Leaves ──────────────────────────────────────────────────────── */
  await idx('cvision_leaves', { tenantId: 1, employeeId: 1, status: 1 });
  await idx('cvision_leaves', { tenantId: 1, startDate: 1, endDate: 1 });

  /* ── Contracts ──────────────────────────────────────────────────── */
  await idx('cvision_contracts', { tenantId: 1, employeeId: 1, status: 1 });
  await idx('cvision_contracts', { tenantId: 1, status: 1, endDate: 1 });

  /* ── Leave balances ────────────────────────────────────────────── */
  await idx('cvision_leave_balances', { tenantId: 1, employeeId: 1, year: 1, leaveType: 1 });

  /* ── Loans ─────────────────────────────────────────────────────── */
  await idx('cvision_loans', { tenantId: 1, employeeId: 1, status: 1 });

  /* ── Recruitment ─────────────────────────────────────────────────── */
  await idx('cvision_candidates', { tenantId: 1, jobId: 1, status: 1 });
  await idx('cvision_jobs', { tenantId: 1, status: 1 });

  /* ── Notifications ───────────────────────────────────────────────── */
  await idx('cvision_notifications', { tenantId: 1, recipientId: 1, read: 1, createdAt: -1 });

  /* ── Search index ────────────────────────────────────────────────── */
  await idx('cvision_search_index', { tenantId: 1, searchTokens: 1 });
  await idx('cvision_search_index', { tenantId: 1, type: 1, importance: -1 });
  try {
    await db.collection('cvision_search_index').createIndex(
      { title: 'text', subtitle: 'text', description: 'text' },
    );
    created.push('cvision_search_index: text(title,subtitle,description)');
  } catch { /* text index may already exist */ }

  /* ── Audit log (TTL 90 days) ─────────────────────────────────────── */
  await idx('cvision_audit_log', { tenantId: 1, timestamp: -1 });
  await idx('cvision_audit_log', { tenantId: 1, userId: 1, timestamp: -1 });
  await idx('cvision_audit_log', { timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

  /* ── Email queue ─────────────────────────────────────────────────── */
  await idx('cvision_email_queue', { status: 1, priority: -1, createdAt: 1 });
  await idx('cvision_email_queue', { tenantId: 1, status: 1 });

  /* ── Cron logs (TTL 90 days) ─────────────────────────────────────── */
  await idx('cvision_cron_logs', { tenantId: 1, startedAt: -1 });
  await idx('cvision_cron_logs', { startedAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

  /* ── Webhook deliveries ──────────────────────────────────────────── */
  await idx('cvision_webhook_deliveries', { tenantId: 1, status: 1, createdAt: -1 });

  /* ── Sessions ────────────────────────────────────────────────────── */
  await idx('cvision_sessions', { token: 1 }, { unique: true });
  await idx('cvision_sessions', { tenantId: 1, userId: 1, active: 1 });
  await idx('cvision_sessions', { expiresAt: 1 }, { expireAfterSeconds: 0 });

  /* ── Files ───────────────────────────────────────────────────────── */
  await idx('cvision_files', { tenantId: 1, module: 1, recordId: 1 });
  await idx('cvision_files', { tenantId: 1, expiryDate: 1 });

  /* ── Workflow instances ──────────────────────────────────────────── */
  await idx('cvision_workflow_instances', { tenantId: 1, status: 1, currentStepId: 1 });

  /* ── Compliance calendar ─────────────────────────────────────────── */
  await idx('cvision_compliance_calendar', { tenantId: 1, nextDueDate: 1, status: 1 });

  /* ── Bookmarks ───────────────────────────────────────────────────── */
  await idx('cvision_bookmarks', { tenantId: 1, userId: 1, pinned: -1, order: 1 });

  return { created };
}

/* ── Aggregation Pipelines ─────────────────────────────────────────── */

export async function getDepartmentSummary(db: Db, tenantId: string) {
  return db.collection('cvision_employees').aggregate([
    { $match: { tenantId, status: 'ACTIVE' } },
    {
      $group: {
        _id: '$department',
        headcount: { $sum: 1 },
        avgSalary: { $avg: '$basicSalary' },
        totalSalary: { $sum: '$basicSalary' },
        saudiCount: { $sum: { $cond: [{ $eq: ['$nationality', 'Saudi'] }, 1, 0] } },
        maleCount: { $sum: { $cond: [{ $eq: ['$gender', 'MALE'] }, 1, 0] } },
        femaleCount: { $sum: { $cond: [{ $eq: ['$gender', 'FEMALE'] }, 1, 0] } },
      },
    },
    {
      $addFields: {
        saudizationRate: { $multiply: [{ $divide: ['$saudiCount', '$headcount'] }, 100] },
      },
    },
    { $sort: { headcount: -1 } },
  ]).toArray();
}

export async function getHeadcountTrend(db: Db, tenantId: string, months = 12) {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);

  return db.collection('cvision_employees').aggregate([
    { $match: { tenantId, joinDate: { $gte: cutoff } } },
    {
      $group: {
        _id: {
          year: { $year: '$joinDate' },
          month: { $month: '$joinDate' },
        },
        joined: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]).toArray();
}

/* ── Archive Strategy ──────────────────────────────────────────────── */

const ARCHIVE_POLICIES = [
  { source: 'cvision_attendance', days: 730 },
  { source: 'cvision_notifications', days: 180 },
  { source: 'cvision_audit_log', days: 365 },
  { source: 'cvision_email_queue', days: 90 },
  { source: 'cvision_cron_logs', days: 90 },
  { source: 'cvision_webhook_deliveries', days: 90 },
];

export async function archiveOldRecords(db: Db, tenantId?: string) {
  const results: { collection: string; moved: number }[] = [];

  for (const { source, days } of ARCHIVE_POLICIES) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const query: any = { createdAt: { $lt: cutoff } };
    if (tenantId) query.tenantId = tenantId;

    const old = await db.collection(source).find(query).toArray();
    if (old.length > 0) {
      await db.collection(`${source}_archive`).insertMany(old);
      await db.collection(source).deleteMany(query);
      results.push({ collection: source, moved: old.length });
    }
  }

  return results;
}
