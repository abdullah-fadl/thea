import type { Db } from '@/lib/cvision/infra/mongo-compat';

/* ── Cron Job Definitions ──────────────────────────────────────────
 *
 * This module defines all scheduled tasks. Actual cron scheduling
 * requires node-cron or a cloud scheduler (Render cron, Vercel cron, etc.).
 * Each job is an exported async function that can be invoked by the
 * scheduler OR called directly via API for manual execution.
 * ───────────────────────────────────────────────────────────────────── */

const CRON_LOGS = 'cvision_cron_logs';

/* ── Log Helper ────────────────────────────────────────────────────── */

async function logCronRun(db: Db, tenantId: string, jobName: string, fn: () => Promise<any>) {
  const start = Date.now();
  try {
    const results = await fn();
    await db.collection(CRON_LOGS).insertOne({
      tenantId, jobName, startedAt: new Date(start), completedAt: new Date(),
      duration: Date.now() - start, status: 'SUCCESS', results,
    });
    return results;
  } catch (err: any) {
    await db.collection(CRON_LOGS).insertOne({
      tenantId, jobName, startedAt: new Date(start), completedAt: new Date(),
      duration: Date.now() - start, status: 'FAILED', results: {}, error: err.message,
    });
    throw err;
  }
}

/* ── Daily Jobs (6:00 AM Riyadh) ───────────────────────────────────── */

export async function dailyExpiringDocuments(db: Db, tenantId: string) {
  return logCronRun(db, tenantId, 'daily.expiringDocuments', async () => {
    const now = new Date();
    const alerts: any[] = [];
    const dayMs = 24 * 60 * 60 * 1000;

    for (const daysAhead of [90, 30, 7, 1]) {
      const targetStart = new Date(now.getTime() + daysAhead * dayMs);
      targetStart.setHours(0, 0, 0, 0);
      const targetEnd = new Date(targetStart.getTime() + dayMs);

      for (const field of ['iqamaExpiry', 'contractEndDate', 'passportExpiry']) {
        const expiring = await db.collection('cvision_employees').find({
          tenantId, status: 'ACTIVE', deletedAt: null,
          [field]: { $gte: targetStart, $lt: targetEnd },
        } as Record<string, unknown>).toArray();

        for (const emp of expiring) {
          alerts.push({
            employeeId: emp.id || emp.employeeId || emp._id?.toString(),
            employeeName: emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee',
            field, daysRemaining: daysAhead,
          });

          await db.collection('cvision_notifications').insertOne({
            tenantId, recipientId: 'HR',
            type: 'WARNING', category: field.includes('iqama') ? 'IQAMA' : field.includes('contract') ? 'CONTRACT' : 'PASSPORT',
            title: `${emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee'}'s ${field === 'iqamaExpiry' ? 'Iqama' : field === 'contractEndDate' ? 'Contract' : 'Passport'} expires in ${daysAhead} day(s)`,
            priority: daysAhead <= 7 ? 'URGENT' : daysAhead <= 30 ? 'HIGH' : 'MEDIUM',
            actionUrl: `/cvision/employees?id=${emp._id}`,
            read: false, createdAt: now,
          });
        }
      }
    }
    return { alertsSent: alerts.length, details: alerts };
  });
}

export async function dailyProbationCheck(db: Db, tenantId: string) {
  return logCronRun(db, tenantId, 'daily.probationCheck', async () => {
    const now = new Date();
    const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const employees = await db.collection('cvision_employees').find({
      tenantId, status: 'ACTIVE', inProbation: true, deletedAt: null,
    }).toArray();

    const ending: any[] = [];
    for (const emp of employees) {
      const empJoinDate = emp.hiredAt || emp.joinDate;
      if (!empJoinDate) continue;
      const probMonths = emp.probationMonths || 3;
      const probEnd = new Date(new Date(empJoinDate).getTime() + probMonths * 30 * 24 * 60 * 60 * 1000);
      if (probEnd <= in14Days && probEnd > now) {
        ending.push({ employeeId: emp.id || emp.employeeId, name: emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee', probationEndDate: probEnd });
      }
    }
    return { probationEndingSoon: ending.length, employees: ending };
  });
}

export async function dailyBirthdayNotifications(db: Db, tenantId: string) {
  return logCronRun(db, tenantId, 'daily.birthdays', async () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    const birthdays = await db.collection('cvision_employees').find({
      tenantId, status: 'ACTIVE', deletedAt: null,
    }).toArray();

    const todayBirthdays = birthdays.filter(e => {
      if (!e.dateOfBirth) return false;
      const dob = new Date(e.dateOfBirth);
      return dob.getMonth() + 1 === month && dob.getDate() === day;
    });

    for (const emp of todayBirthdays) {
      await db.collection('cvision_notifications').insertOne({
        tenantId, recipientId: 'ALL',
        type: 'INFO', category: 'BIRTHDAY',
        title: `🎂 Happy Birthday ${emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee'}!`,
        priority: 'LOW', read: false, createdAt: now,
      });
    }
    return { birthdaysToday: todayBirthdays.length };
  });
}

export async function dailyOverdueApprovalEscalation(db: Db, tenantId: string, slaHours = 48) {
  return logCronRun(db, tenantId, 'daily.overdueApprovals', async () => {
    const cutoff = new Date(Date.now() - slaHours * 60 * 60 * 1000);
    const pending = await db.collection('cvision_workflow_instances').find({
      tenantId, status: 'IN_PROGRESS',
    }).toArray();

    let escalated = 0;
    for (const inst of pending) {
      const lastStep = inst.stepHistory?.[inst.stepHistory.length - 1];
      if (lastStep && new Date(lastStep.timestamp) < cutoff) {
        await db.collection('cvision_notifications').insertOne({
          tenantId, recipientId: 'HR',
          type: 'WARNING', category: 'SLA_BREACH',
          title: `SLA breach: ${inst.workflowName} (${inst.instanceId}) pending > ${slaHours}h`,
          priority: 'URGENT', read: false, createdAt: new Date(),
        });
        escalated++;
      }
    }
    return { escalated };
  });
}

/* ── Weekly Jobs (Monday 7:00 AM) ──────────────────────────────────── */

export async function weeklyComplianceCheck(db: Db, tenantId: string) {
  return logCronRun(db, tenantId, 'weekly.complianceCheck', async () => {
    const now = new Date();
    const deadlines = await db.collection('cvision_compliance_calendar').find({
      tenantId, status: { $ne: 'COMPLETED' },
    }).toArray();

    let updated = 0;
    for (const d of deadlines) {
      const daysUntil = Math.ceil((new Date(d.nextDueDate).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      let newStatus = d.status;
      if (daysUntil < 0) newStatus = 'OVERDUE';
      else if (daysUntil <= 7) newStatus = 'DUE_SOON';
      else newStatus = 'UPCOMING';

      if (newStatus !== d.status) {
        await db.collection('cvision_compliance_calendar').updateOne({ _id: d._id, tenantId }, { $set: { status: newStatus, updatedAt: now } });
        updated++;
      }
    }
    return { deadlinesChecked: deadlines.length, updated };
  });
}

export async function weeklyDataQualityReport(db: Db, tenantId: string) {
  return logCronRun(db, tenantId, 'weekly.dataQuality', async () => {
    const employees = await db.collection('cvision_employees').find({ tenantId, deletedAt: null }).limit(10000).toArray();
    const requiredFields = ['name', 'email', 'phone', 'nationalId', 'dateOfBirth', 'gender', 'department', 'position', 'joinDate', 'bankIBAN'];

    let totalComplete = 0;
    let totalMissing = 0;
    for (const emp of employees) {
      const filled = requiredFields.filter(f => emp[f] != null && emp[f] !== '').length;
      totalComplete += filled;
      totalMissing += requiredFields.length - filled;
    }

    const avgCompleteness = employees.length > 0 ? Math.round((totalComplete / (employees.length * requiredFields.length)) * 100) : 0;
    return { totalEmployees: employees.length, avgCompleteness, totalMissing };
  });
}

/* ── Monthly Jobs (1st of month 8:00 AM) ───────────────────────────── */

export async function monthlyKPICalculation(db: Db, tenantId: string) {
  return logCronRun(db, tenantId, 'monthly.kpiCalculation', async () => {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;
    const kpis = await db.collection('cvision_kpis').find({ tenantId, status: 'ACTIVE' }).toArray();

    let updated = 0;
    for (const kpi of kpis) {
      const currentValue = kpi.currentValue || 0;
      await db.collection('cvision_kpis').updateOne(
        { _id: kpi._id, tenantId },
        {
          $set: { lastCalculated: now, updatedAt: now },
          $push: { history: { period, value: currentValue } } as Record<string, unknown>,
        },
      );
      updated++;
    }
    return { kpisUpdated: updated };
  });
}

export async function monthlyArchiveNotifications(db: Db, tenantId: string, olderThanDays = 90) {
  return logCronRun(db, tenantId, 'monthly.archiveNotifications', async () => {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const result = await db.collection('cvision_notifications').deleteMany({
      tenantId, createdAt: { $lt: cutoff }, read: true,
    });
    return { archived: result.deletedCount };
  });
}

/* ── Cron Log Queries ──────────────────────────────────────────────── */

export async function getCronLogs(db: Db, tenantId: string, limit = 50) {
  return db.collection(CRON_LOGS).find({ tenantId }).sort({ startedAt: -1 }).limit(limit).toArray();
}

export async function getCronLogsByJob(db: Db, tenantId: string, jobName: string, limit = 20) {
  return db.collection(CRON_LOGS).find({ tenantId, jobName }).sort({ startedAt: -1 }).limit(limit).toArray();
}

/* ── Run All Daily / Weekly / Monthly ──────────────────────────────── */

export async function runDailyJobs(db: Db, tenantId: string) {
  const results: any = {};
  results.expiringDocs = await dailyExpiringDocuments(db, tenantId);
  results.probation = await dailyProbationCheck(db, tenantId);
  results.birthdays = await dailyBirthdayNotifications(db, tenantId);
  results.overdueApprovals = await dailyOverdueApprovalEscalation(db, tenantId);
  return results;
}

export async function runWeeklyJobs(db: Db, tenantId: string) {
  const results: any = {};
  results.compliance = await weeklyComplianceCheck(db, tenantId);
  results.dataQuality = await weeklyDataQualityReport(db, tenantId);
  return results;
}

export async function runMonthlyJobs(db: Db, tenantId: string) {
  const results: any = {};
  results.kpis = await monthlyKPICalculation(db, tenantId);
  results.archive = await monthlyArchiveNotifications(db, tenantId);
  return results;
}
