/**
 * Patient Experience Report — Real Prisma implementation
 *
 * Queries PatientExperience (visit records with JSON data) and
 * PxCase (case tracking) to produce KPIs, row-level data, and
 * breakdown analytics.
 */

import { prisma, prismaModel } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export interface PXReportParams {
  from?: string;
  to?: string;
  floorKey?: string;
  departmentKey?: string;
  severity?: string;
  status?: string;
  tenantId?: string;
}

export interface SummaryKPIs {
  totalVisits: number;
  totalComplaints: number;
  totalPraise: number;
  avgSatisfaction: number;
  totalCases: number;
  openCases: number;
  overdueCases: number;
  avgResolutionMinutes: number;
  slaBreachPercent: number;
}

export interface VisitRow {
  createdAt: string;
  staffId: string;
  staffName: string;
  patientName: string;
  patientFileNumber: string;
  floorLabel: string;
  departmentLabel: string;
  roomLabel: string;
  domainLabel: string;
  typeLabel: string;
  severity: string;
  status: string;
  detailsEn: string;
}

export interface CaseRow {
  caseId: string;
  visitId: string;
  status: string;
  severity: string;
  assignedDeptLabel: string;
  dueAt: string;
  overdue: boolean;
  escalationLevel: number;
  resolvedAt?: string;
  resolutionMinutes?: number;
  detailsEn: string;
}

export interface BreakdownRow {
  key: string;
  label_en: string;
  count: number;
  percentage: number;
}

export interface PXReportData {
  summaryKPIs: SummaryKPIs;
  visitsRows: VisitRow[];
  casesRows: CaseRow[];
  breakdownRows: {
    departments: BreakdownRow[];
    types: BreakdownRow[];
    severity: BreakdownRow[];
  };
}

/* ---------- helpers ---------- */

/** Safely read a string field from the JSON data blob */
function dataStr(data: any, key: string): string {
  if (!data || typeof data !== 'object') return '';
  const val = data[key];
  return typeof val === 'string' ? val : '';
}

/** Safely read a number field from the JSON data blob */
function dataNum(data: any, key: string): number {
  if (!data || typeof data !== 'object') return 0;
  const val = data[key];
  return typeof val === 'number' ? val : 0;
}

/** Build a breakdown from a frequency map */
function buildBreakdown(counts: Record<string, number>, total: number): BreakdownRow[] {
  return Object.entries(counts)
    .filter(([key]) => key !== '')
    .map(([key, count]) => ({
      key,
      label_en: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      count,
      percentage: total > 0 ? Math.round((count / total) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

const EMPTY_REPORT: PXReportData = {
  summaryKPIs: {
    totalVisits: 0,
    totalComplaints: 0,
    totalPraise: 0,
    avgSatisfaction: 0,
    totalCases: 0,
    openCases: 0,
    overdueCases: 0,
    avgResolutionMinutes: 0,
    slaBreachPercent: 0,
  },
  visitsRows: [],
  casesRows: [],
  breakdownRows: { departments: [], types: [], severity: [] },
};

/**
 * Get Patient Experience report data with English labels resolved.
 * Queries PatientExperience + PxCase via Prisma, computes KPIs and breakdowns.
 */
export async function getPXReportData(params: PXReportParams): Promise<PXReportData> {
  try {
    const { from, to, floorKey, departmentKey, severity, status, tenantId } = params;

    /* ---- 1. Query PatientExperience visits ---- */

    const visitWhere: any = {};
    if (tenantId) visitWhere.tenantId = tenantId;
    if (from || to) {
      visitWhere.createdAt = {};
      if (from) visitWhere.createdAt.gte = new Date(from);
      if (to) visitWhere.createdAt.lte = new Date(to);
    }

    // PatientExperience stores most fields inside `data` JSON.
    // We fetch all rows matching tenant + date range, then filter in-memory
    // for JSON-level fields (floorKey, departmentKey, severity, status).
    const allVisits: any[] = await prismaModel('patientExperience').findMany({
      where: visitWhere,
      orderBy: { createdAt: 'desc' },
    });

    // In-memory filter for JSON data fields
    const visits = allVisits.filter((v: any) => {
      const d = v.data ?? {};
      if (floorKey && dataStr(d, 'floorKey') !== floorKey) return false;
      if (departmentKey && dataStr(d, 'departmentKey') !== departmentKey) return false;
      if (severity && dataStr(d, 'severity') !== severity) return false;
      if (status && dataStr(d, 'status') !== status) return false;
      return true;
    });

    const visitIds = visits.map((v: any) => v.id);

    /* ---- 2. Query PxCase records linked to those visits ---- */

    const caseWhere: any = { active: true };
    if (tenantId) caseWhere.tenantId = tenantId;
    if (visitIds.length > 0) {
      caseWhere.visitId = { in: visitIds };
    } else if (tenantId) {
      // If no visits matched but we have a tenantId, still load cases for KPI completeness
      // within the date range
      if (from || to) {
        caseWhere.createdAt = {};
        if (from) caseWhere.createdAt.gte = new Date(from);
        if (to) caseWhere.createdAt.lte = new Date(to);
      }
    }

    const cases: any[] = await prismaModel('pxCase').findMany({
      where: caseWhere,
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();

    /* ---- 3. Build visit rows ---- */

    const visitsRows: VisitRow[] = visits.map((v: any) => {
      const d = v.data ?? {};
      return {
        createdAt: v.createdAt?.toISOString?.() ?? '',
        staffId: dataStr(d, 'staffId'),
        staffName: dataStr(d, 'staffName'),
        patientName: dataStr(d, 'patientName'),
        patientFileNumber: dataStr(d, 'patientFileNumber'),
        floorLabel: dataStr(d, 'floorLabel') || dataStr(d, 'floorKey'),
        departmentLabel: dataStr(d, 'departmentLabel') || dataStr(d, 'departmentKey'),
        roomLabel: dataStr(d, 'roomLabel') || dataStr(d, 'roomKey'),
        domainLabel: dataStr(d, 'domainLabel') || dataStr(d, 'domainKey'),
        typeLabel: dataStr(d, 'typeLabel') || v.type || '',
        severity: dataStr(d, 'severity'),
        status: dataStr(d, 'status'),
        detailsEn: dataStr(d, 'detailsEn'),
      };
    });

    /* ---- 4. Build case rows ---- */

    const casesRows: CaseRow[] = cases.map((c: any) => ({
      caseId: c.id,
      visitId: c.visitId ?? '',
      status: c.status ?? '',
      severity: c.severity ?? '',
      assignedDeptLabel: (c.assignedDeptKey ?? '').replace(/_/g, ' ').replace(/\b\w/g, (ch: string) => ch.toUpperCase()),
      dueAt: c.dueAt?.toISOString?.() ?? '',
      overdue: c.dueAt ? now > new Date(c.dueAt) && !['RESOLVED', 'CLOSED'].includes(c.status) : false,
      escalationLevel: c.escalationLevel ?? 0,
      resolvedAt: c.resolvedAt?.toISOString?.() ?? undefined,
      resolutionMinutes: c.resolutionMinutes ?? undefined,
      detailsEn: c.detailsEn ?? '',
    }));

    /* ---- 5. KPIs ---- */

    const totalVisits = visits.length;
    const totalComplaints = visits.filter((v: any) => {
      const t = (v.type || dataStr(v.data, 'type') || '').toLowerCase();
      return t === 'complaint' || t === 'شكوى';
    }).length;
    const totalPraise = visits.filter((v: any) => {
      const t = (v.type || dataStr(v.data, 'type') || '').toLowerCase();
      return t === 'praise' || t === 'إشادة' || t === 'compliment';
    }).length;

    // Average satisfaction from JSON data
    const satisfactionScores = visits
      .map((v: any) => dataNum(v.data, 'satisfaction'))
      .filter((s: number) => s > 0);
    const avgSatisfaction =
      satisfactionScores.length > 0
        ? Math.round((satisfactionScores.reduce((a: number, b: number) => a + b, 0) / satisfactionScores.length) * 100) / 100
        : 0;

    const totalCases = cases.length;
    const openCases = cases.filter((c: any) => ['OPEN', 'IN_PROGRESS', 'ESCALATED'].includes(c.status)).length;
    const overdueCases = casesRows.filter((r) => r.overdue).length;

    const resolvedCases = cases.filter((c: any) => c.resolutionMinutes != null && c.resolutionMinutes > 0);
    const avgResolutionMinutes =
      resolvedCases.length > 0
        ? Math.round(
            resolvedCases.reduce((sum: number, c: any) => sum + (c.resolutionMinutes ?? 0), 0) / resolvedCases.length,
          )
        : 0;

    // SLA breach: cases that were overdue when resolved, or still overdue now
    const breachedCount = cases.filter((c: any) => {
      if (!c.dueAt) return false;
      const due = new Date(c.dueAt);
      if (['RESOLVED', 'CLOSED'].includes(c.status) && c.resolvedAt) {
        return new Date(c.resolvedAt) > due;
      }
      return now > due && !['RESOLVED', 'CLOSED'].includes(c.status);
    }).length;
    const slaBreachPercent = totalCases > 0 ? Math.round((breachedCount / totalCases) * 10000) / 100 : 0;

    const summaryKPIs: SummaryKPIs = {
      totalVisits,
      totalComplaints,
      totalPraise,
      avgSatisfaction,
      totalCases,
      openCases,
      overdueCases,
      avgResolutionMinutes,
      slaBreachPercent,
    };

    /* ---- 6. Breakdowns ---- */

    // Department breakdown
    const deptCounts: Record<string, number> = {};
    for (const v of visits) {
      const key = dataStr(v.data, 'departmentKey') || 'unknown';
      deptCounts[key] = (deptCounts[key] ?? 0) + 1;
    }

    // Type breakdown (complaint, praise, suggestion, etc.)
    const typeCounts: Record<string, number> = {};
    for (const v of visits) {
      const key = v.type || dataStr(v.data, 'type') || 'unknown';
      typeCounts[key] = (typeCounts[key] ?? 0) + 1;
    }

    // Severity breakdown
    const sevCounts: Record<string, number> = {};
    for (const v of visits) {
      const key = dataStr(v.data, 'severity') || 'unset';
      sevCounts[key] = (sevCounts[key] ?? 0) + 1;
    }

    return {
      summaryKPIs,
      visitsRows,
      casesRows,
      breakdownRows: {
        departments: buildBreakdown(deptCounts, totalVisits),
        types: buildBreakdown(typeCounts, totalVisits),
        severity: buildBreakdown(sevCounts, totalVisits),
      },
    };
  } catch (err) {
    logger.error('Failed to generate PX report, returning empty defaults', {
      category: 'general',
      error: err instanceof Error ? err.message : String(err),
    });
    return EMPTY_REPORT;
  }
}
