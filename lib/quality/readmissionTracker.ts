/**
 * Readmission Tracker — Detects and tracks 30-day hospital readmissions.
 *
 * The 30-day readmission rate is a key quality metric required by CBAHI
 * (Saudi Central Board for Accreditation of Healthcare Institutions).
 * This module compares new inpatient admissions against previous discharges
 * to identify readmissions, calculate rates, and support root cause review.
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReadmissionFilters {
  patientId?: string;
  department?: string;
  reviewStatus?: string;
  isPreventable?: string;
  rootCause?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}

export interface ReadmissionRateResult {
  overallRate: number;         // Percentage
  totalDischarges: number;
  totalReadmissions: number;
  preventableCount: number;
  preventableRate: number;
  byDepartment: { department: string; rate: number; discharges: number; readmissions: number }[];
  byRootCause: { cause: string; count: number }[];
  trend: { period: string; rate: number; readmissions: number; discharges: number }[];
}

export interface ReadmissionStats {
  thirtyDayRate: number;
  totalReadmissions: number;
  pendingReview: number;
  reviewedCount: number;
  actionTakenCount: number;
  preventablePercent: number;
  byRootCause: { cause: string; causeAr: string; count: number }[];
  bySeverity: { preventable: number; notPreventable: number; unknown: number; underReview: number };
  trend: { period: string; rate: number; count: number }[];
}

export interface ReviewData {
  isPreventable: string;
  rootCause?: string;
  rootCauseAr?: string;
  reviewNotes?: string;
  actionPlan?: string;
}

// ---------------------------------------------------------------------------
// Root cause labels (bilingual)
// ---------------------------------------------------------------------------

const ROOT_CAUSES: Record<string, string> = {
  premature_discharge: 'خروج مبكر',
  inadequate_follow_up: 'متابعة غير كافية',
  medication_issue: 'مشكلة دوائية',
  social_factors: 'عوامل اجتماعية',
  disease_progression: 'تطور المرض',
  complication: 'مضاعفات',
};

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/**
 * Detect if a new admission is a readmission (within 30 days of previous discharge).
 * Creates a ReadmissionRecord if a readmission is detected.
 */
export async function detectReadmission(
  encounterId: string,
  tenantId: string
): Promise<{ isReadmission: boolean; record?: any }> {
  // Get the new encounter details
  const encounter = await prisma.ehrEncounter.findFirst({
    where: { id: encounterId, tenantId },
  });

  if (!encounter || encounter.encounterType !== 'INPATIENT') {
    return { isReadmission: false };
  }

  // Also check IpdEpisode for richer discharge data
  const ipdEpisode = await prisma.ipdEpisode.findFirst({
    where: { tenantId, encounterId },
  });

  const admitDate = encounter.admissionDate || encounter.createdAt;
  const thirtyDaysBefore = new Date(new Date(admitDate).getTime() - 30 * 24 * 60 * 60 * 1000);

  // Find any discharge within the last 30 days for this patient
  const previousDischarges = await prisma.ehrEncounter.findMany({
    where: {
      tenantId,
      patientId: encounter.patientId,
      encounterType: 'INPATIENT',
      status: { in: ['DISCHARGED', 'COMPLETED', 'CLOSED'] },
      dischargeDate: { gte: thirtyDaysBefore, lt: admitDate },
      id: { not: encounterId }, // Exclude current encounter
    },
    orderBy: { dischargeDate: 'desc' },
    take: 1,
  });

  // Also check IPD episodes for discharges
  let previousIpdDischarges: any[] = [];
  if (previousDischarges.length === 0) {
    previousIpdDischarges = await prisma.ipdEpisode.findMany({
      where: {
        tenantId,
        patient: { path: ['id'], equals: encounter.patientId },
        status: 'DISCHARGED',
        closedAt: { gte: thirtyDaysBefore, lt: admitDate },
        encounterId: { not: encounterId },
      },
      orderBy: { closedAt: 'desc' },
      take: 1,
    });
  }

  const prevEncounter = previousDischarges[0];
  const prevIpdEpisode = previousIpdDischarges[0];

  if (!prevEncounter && !prevIpdEpisode) {
    return { isReadmission: false };
  }

  // Determine previous discharge details
  const prevDischargeDate = prevEncounter?.dischargeDate || prevIpdEpisode?.closedAt;
  const prevEncounterId = prevEncounter?.id || prevIpdEpisode?.encounterId;
  const prevAdmitDate = prevEncounter?.admissionDate || prevEncounter?.createdAt || prevIpdEpisode?.createdAt;

  if (!prevDischargeDate || !prevEncounterId) {
    return { isReadmission: false };
  }

  const daysBetween = Math.floor(
    (new Date(admitDate).getTime() - new Date(prevDischargeDate).getTime()) / (24 * 60 * 60 * 1000)
  );

  // Get patient name
  const patient = await prisma.patientMaster.findFirst({
    where: { id: encounter.patientId, tenantId },
    select: { fullName: true },
  });

  // Create readmission record (idempotent — unique on tenantId + readmitEncounterId)
  try {
    const record = await prisma.readmissionRecord.create({
      data: {
        tenantId,
        patientId: encounter.patientId,
        patientName: patient?.fullName || null,
        originalEncounterId: prevEncounterId,
        originalAdmitDate: prevAdmitDate || new Date(),
        originalDischargeDate: prevDischargeDate,
        originalDiagnosis: prevEncounter?.primaryDiagnosis || null,
        originalDepartment: prevEncounter?.department || null,
        readmitEncounterId: encounterId,
        readmitDate: admitDate,
        readmitDiagnosis: encounter.primaryDiagnosis || null,
        readmitDepartment: encounter.department || null,
        daysBetween,
        isPreventable: 'unknown',
        reviewStatus: 'pending',
      },
    });

    logger.info(
      `[ReadmissionTracker] Readmission detected: patient ${encounter.patientId}, ${daysBetween} days between admissions`,
      { category: 'quality' }
    );

    return { isReadmission: true, record };
  } catch (err: any) {
    if (err.code === 'P2002') {
      // Already recorded
      const existing = await prisma.readmissionRecord.findFirst({
        where: { tenantId, readmitEncounterId: encounterId },
      });
      return { isReadmission: true, record: existing };
    }
    throw err;
  }
}

/**
 * Calculate readmission rates for a tenant within a date range.
 */
export async function getReadmissionRate(
  tenantId: string,
  dateRange: { from: Date; to: Date },
  options?: { department?: string }
): Promise<ReadmissionRateResult> {
  const { from, to } = dateRange;

  // Count total discharges in the period
  const dischargeWhere: any = {
    tenantId,
    encounterType: 'INPATIENT',
    status: { in: ['DISCHARGED', 'COMPLETED', 'CLOSED'] },
    dischargeDate: { gte: from, lte: to },
  };
  if (options?.department) dischargeWhere.department = options.department;

  const totalDischarges = await prisma.ehrEncounter.count({ where: dischargeWhere });

  // Count readmissions in the period
  const readmissionWhere: any = {
    tenantId,
    readmitDate: { gte: from, lte: to },
  };
  if (options?.department) readmissionWhere.readmitDepartment = options.department;

  const [totalReadmissions, preventableCount] = await Promise.all([
    prisma.readmissionRecord.count({ where: readmissionWhere }),
    prisma.readmissionRecord.count({ where: { ...readmissionWhere, isPreventable: 'yes' } }),
  ]);

  const overallRate = totalDischarges > 0 ? Math.round((totalReadmissions / totalDischarges) * 1000) / 10 : 0;
  const preventableRate = totalReadmissions > 0 ? Math.round((preventableCount / totalReadmissions) * 1000) / 10 : 0;

  // By department
  const departments = await prisma.readmissionRecord.groupBy({
    by: ['readmitDepartment'],
    where: { tenantId, readmitDate: { gte: from, lte: to } },
    _count: { id: true },
  });

  const byDepartment = await Promise.all(
    departments.map(async (d) => {
      const dept = d.readmitDepartment || 'Unknown';
      const deptDischarges = await prisma.ehrEncounter.count({
        where: {
          tenantId,
          encounterType: 'INPATIENT',
          department: dept,
          dischargeDate: { gte: from, lte: to },
          status: { in: ['DISCHARGED', 'COMPLETED', 'CLOSED'] },
        },
      });
      return {
        department: dept,
        readmissions: d._count.id,
        discharges: deptDischarges,
        rate: deptDischarges > 0 ? Math.round((d._count.id / deptDischarges) * 1000) / 10 : 0,
      };
    })
  );

  // By root cause
  const rootCauseGroups = await prisma.readmissionRecord.groupBy({
    by: ['rootCause'],
    where: { tenantId, readmitDate: { gte: from, lte: to }, rootCause: { not: null } },
    _count: { id: true },
  });

  const byRootCause = rootCauseGroups.map((g) => ({
    cause: g.rootCause || 'unknown',
    count: g._count.id,
  }));

  // Monthly trend (last 6 months)
  const trend: ReadmissionRateResult['trend'] = [];
  const now = to;
  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

    const [monthReadmissions, monthDischarges] = await Promise.all([
      prisma.readmissionRecord.count({
        where: { tenantId, readmitDate: { gte: monthStart, lt: monthEnd } },
      }),
      prisma.ehrEncounter.count({
        where: {
          tenantId,
          encounterType: 'INPATIENT',
          dischargeDate: { gte: monthStart, lt: monthEnd },
          status: { in: ['DISCHARGED', 'COMPLETED', 'CLOSED'] },
        },
      }),
    ]);

    trend.push({
      period: monthStart.toISOString().slice(0, 7),
      readmissions: monthReadmissions,
      discharges: monthDischarges,
      rate: monthDischarges > 0 ? Math.round((monthReadmissions / monthDischarges) * 1000) / 10 : 0,
    });
  }

  return {
    overallRate,
    totalDischarges,
    totalReadmissions,
    preventableCount,
    preventableRate,
    byDepartment,
    byRootCause,
    trend,
  };
}

/**
 * Query readmission records with filters.
 */
export async function getReadmissions(tenantId: string, filters?: ReadmissionFilters) {
  const where: any = { tenantId };
  if (filters?.patientId) where.patientId = filters.patientId;
  if (filters?.department) {
    where.OR = [
      { originalDepartment: filters.department },
      { readmitDepartment: filters.department },
    ];
  }
  if (filters?.reviewStatus) where.reviewStatus = filters.reviewStatus;
  if (filters?.isPreventable) where.isPreventable = filters.isPreventable;
  if (filters?.rootCause) where.rootCause = filters.rootCause;
  if (filters?.dateFrom || filters?.dateTo) {
    where.readmitDate = {};
    if (filters.dateFrom) where.readmitDate.gte = filters.dateFrom;
    if (filters.dateTo) where.readmitDate.lte = filters.dateTo;
  }

  const page = Math.max(filters?.page || 1, 1);
  const limit = Math.min(Math.max(filters?.limit || 20, 1), 100);
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.readmissionRecord.findMany({
      where,
      orderBy: { readmitDate: 'desc' },
      skip,
      take: limit,
    }),
    prisma.readmissionRecord.count({ where }),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/**
 * Submit a review for a readmission record.
 */
export async function reviewReadmission(
  recordId: string,
  tenantId: string,
  reviewerId: string,
  data: ReviewData
) {
  const record = await prisma.readmissionRecord.findFirst({
    where: { id: recordId, tenantId },
  });

  if (!record) return null;

  return prisma.readmissionRecord.update({
    where: { id: recordId },
    data: {
      isPreventable: data.isPreventable,
      rootCause: data.rootCause || null,
      rootCauseAr: data.rootCauseAr || ROOT_CAUSES[data.rootCause || ''] || null,
      reviewNotes: data.reviewNotes || null,
      actionPlan: data.actionPlan || null,
      reviewStatus: data.actionPlan ? 'action_taken' : 'reviewed',
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    },
  });
}

/**
 * Get readmission dashboard KPIs.
 */
export async function getReadmissionStats(tenantId: string): Promise<ReadmissionStats> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Count discharges in last 30 days for rate calculation
  const totalDischarges30 = await prisma.ehrEncounter.count({
    where: {
      tenantId,
      encounterType: 'INPATIENT',
      status: { in: ['DISCHARGED', 'COMPLETED', 'CLOSED'] },
      dischargeDate: { gte: thirtyDaysAgo },
    },
  });

  const [
    totalReadmissions30,
    totalReadmissions,
    pendingReview,
    reviewedCount,
    actionTakenCount,
    preventableYes,
    preventableNo,
    preventableUnknown,
    preventableUnderReview,
  ] = await Promise.all([
    prisma.readmissionRecord.count({
      where: { tenantId, readmitDate: { gte: thirtyDaysAgo } },
    }),
    prisma.readmissionRecord.count({ where: { tenantId } }),
    prisma.readmissionRecord.count({ where: { tenantId, reviewStatus: 'pending' } }),
    prisma.readmissionRecord.count({ where: { tenantId, reviewStatus: 'reviewed' } }),
    prisma.readmissionRecord.count({ where: { tenantId, reviewStatus: 'action_taken' } }),
    prisma.readmissionRecord.count({ where: { tenantId, isPreventable: 'yes' } }),
    prisma.readmissionRecord.count({ where: { tenantId, isPreventable: 'no' } }),
    prisma.readmissionRecord.count({ where: { tenantId, isPreventable: 'unknown' } }),
    prisma.readmissionRecord.count({ where: { tenantId, isPreventable: 'under_review' } }),
  ]);

  const thirtyDayRate = totalDischarges30 > 0
    ? Math.round((totalReadmissions30 / totalDischarges30) * 1000) / 10
    : 0;

  const preventablePercent = totalReadmissions > 0
    ? Math.round((preventableYes / totalReadmissions) * 1000) / 10
    : 0;

  // Root cause breakdown
  const rootCauseGroups = await prisma.readmissionRecord.groupBy({
    by: ['rootCause'],
    where: { tenantId, rootCause: { not: null } },
    _count: { id: true },
  });

  const byRootCause = rootCauseGroups.map((g) => ({
    cause: g.rootCause || 'unknown',
    causeAr: ROOT_CAUSES[g.rootCause || ''] || 'غير محدد',
    count: g._count.id,
  }));

  // Monthly trend (last 6 months)
  const trend: ReadmissionStats['trend'] = [];
  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

    const [monthReadmissions, monthDischarges] = await Promise.all([
      prisma.readmissionRecord.count({
        where: { tenantId, readmitDate: { gte: monthStart, lt: monthEnd } },
      }),
      prisma.ehrEncounter.count({
        where: {
          tenantId,
          encounterType: 'INPATIENT',
          dischargeDate: { gte: monthStart, lt: monthEnd },
          status: { in: ['DISCHARGED', 'COMPLETED', 'CLOSED'] },
        },
      }),
    ]);

    trend.push({
      period: monthStart.toISOString().slice(0, 7),
      rate: monthDischarges > 0 ? Math.round((monthReadmissions / monthDischarges) * 1000) / 10 : 0,
      count: monthReadmissions,
    });
  }

  return {
    thirtyDayRate,
    totalReadmissions,
    pendingReview,
    reviewedCount,
    actionTakenCount,
    preventablePercent,
    byRootCause,
    bySeverity: {
      preventable: preventableYes,
      notPreventable: preventableNo,
      unknown: preventableUnknown,
      underReview: preventableUnderReview,
    },
    trend,
  };
}
