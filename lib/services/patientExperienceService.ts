/**
 * Patient Experience Service Layer — Real Prisma implementation
 *
 * Queries PatientExperience (visit records with JSON data) and
 * PxCase (case tracking) via Prisma. Supports filtering, pagination,
 * sorting, and aggregate KPIs.
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export interface PXQueryOptions {
  tenantId: string;
  from?: Date;
  to?: Date;
  floorKey?: string;
  departmentKey?: string;
  roomKey?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status?: string;
  staffId?: string;
  limit?: number;
  skip?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PXVisit {
  id: string;
  staffName: string;
  staffId: string;
  patientName: string;
  patientFileNumber: string;
  floorKey: string;
  departmentKey: string;
  roomKey: string;
  domainKey: string;
  typeKey: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: string;
  detailsOriginal: string;
  detailsLang: 'ar' | 'en';
  detailsEn: string;
  visitDate: Date;
  createdAt: Date;
  tenantId: string;
  [key: string]: unknown;
}

export interface PXCase {
  id: string;
  visitId: string;
  status: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  assignedDeptKey?: string;
  dueAt: Date;
  escalationLevel: number;
  createdAt: Date;
  tenantId: string;
  active?: boolean;
  [key: string]: unknown;
}

/* ---------- helpers ---------- */

/** Safe string extraction from JSON data blob */
function ds(data: Record<string, unknown>, key: string): string {
  if (!data || typeof data !== 'object') return '';
  const v = data[key];
  return typeof v === 'string' ? v : '';
}

/** Safe number extraction from JSON data blob */
function dn(data: Record<string, unknown>, key: string): number {
  if (!data || typeof data !== 'object') return 0;
  const v = data[key];
  return typeof v === 'number' ? v : 0;
}

interface PXRow {
  id: string;
  type?: string;
  data: Record<string, unknown>;
  createdAt: Date;
  tenantId: string;
}

interface CaseRow {
  id: string;
  visitId?: string;
  status?: string;
  severity?: string;
  assignedDeptKey?: string;
  dueAt?: Date;
  escalationLevel?: number;
  createdAt: Date;
  tenantId: string;
  active?: boolean;
  resolvedAt?: Date;
  resolutionMinutes?: number;
  detailsEn?: string;
  detailsAr?: string;
}

/** Map a raw PatientExperience row to PXVisit */
function toVisit(row: PXRow): PXVisit {
  const d = (row.data ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    staffName: ds(d, 'staffName'),
    staffId: ds(d, 'staffId'),
    patientName: ds(d, 'patientName'),
    patientFileNumber: ds(d, 'patientFileNumber'),
    floorKey: ds(d, 'floorKey'),
    departmentKey: ds(d, 'departmentKey'),
    roomKey: ds(d, 'roomKey'),
    domainKey: ds(d, 'domainKey'),
    typeKey: row.type || ds(d, 'type') || '',
    severity: (ds(d, 'severity') || 'LOW') as PXVisit['severity'],
    status: ds(d, 'status'),
    detailsOriginal: ds(d, 'detailsOriginal') || ds(d, 'detailsAr') || ds(d, 'detailsEn'),
    detailsLang: (ds(d, 'detailsLang') || 'en') as 'ar' | 'en',
    detailsEn: ds(d, 'detailsEn'),
    visitDate: d.visitDate ? new Date(d.visitDate as string) : row.createdAt,
    createdAt: row.createdAt,
    tenantId: row.tenantId,
    data: d,
  };
}

/** Map a raw PxCase row to PXCase */
function toCase(row: CaseRow): PXCase {
  return {
    id: row.id,
    visitId: row.visitId ?? '',
    status: row.status ?? 'OPEN',
    severity: (row.severity || 'LOW') as PXCase['severity'],
    assignedDeptKey: row.assignedDeptKey ?? undefined,
    dueAt: row.dueAt ?? row.createdAt,
    escalationLevel: row.escalationLevel ?? 0,
    createdAt: row.createdAt,
    tenantId: row.tenantId,
    active: row.active ?? true,
    resolvedAt: row.resolvedAt ?? undefined,
    resolutionMinutes: row.resolutionMinutes ?? undefined,
    detailsEn: row.detailsEn ?? '',
    detailsAr: row.detailsAr ?? '',
  };
}

interface PrismaDelegate {
  findMany: (args: Record<string, unknown>) => Promise<PXRow[]>;
  count: (args: Record<string, unknown>) => Promise<number>;
}

interface CaseDelegate {
  findMany: (args: Record<string, unknown>) => Promise<CaseRow[]>;
  count: (args: Record<string, unknown>) => Promise<number>;
}

const db = prisma as unknown as Record<string, PrismaDelegate>;
const caseDb = prisma as unknown as Record<string, CaseDelegate>;

/** Apply in-memory JSON-level filters since Prisma can't filter inside Json columns portably */
function matchesJsonFilters(row: PXRow, opts: PXQueryOptions): boolean {
  const d = (row.data ?? {}) as Record<string, unknown>;
  if (opts.floorKey && ds(d, 'floorKey') !== opts.floorKey) return false;
  if (opts.departmentKey && ds(d, 'departmentKey') !== opts.departmentKey) return false;
  if (opts.roomKey && ds(d, 'roomKey') !== opts.roomKey) return false;
  if (opts.severity && ds(d, 'severity') !== opts.severity) return false;
  if (opts.status && ds(d, 'status') !== opts.status) return false;
  if (opts.staffId && ds(d, 'staffId') !== opts.staffId) return false;
  return true;
}

/**
 * Get visits with filtering, sorting, and pagination.
 * Queries PatientExperience, filters JSON data fields in-memory,
 * then paginates the result.
 */
export async function getVisits(options: PXQueryOptions): Promise<{ visits: PXVisit[]; total: number }> {
  try {
    const where: Record<string, unknown> = { tenantId: options.tenantId };
    if (options.from || options.to) {
      const createdAt: Record<string, Date> = {};
      if (options.from) createdAt.gte = options.from;
      if (options.to) createdAt.lte = options.to;
      where.createdAt = createdAt;
    }

    const rawRows = await db.patientExperience.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // In-memory filter for JSON data fields
    const filtered = rawRows.filter((r) => matchesJsonFilters(r, options));

    const total = filtered.length;

    // Sort
    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder || 'desc';
    filtered.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      if (sortBy === 'createdAt') {
        aVal = a.createdAt?.getTime?.() ?? 0;
        bVal = b.createdAt?.getTime?.() ?? 0;
      } else {
        aVal = ds(a.data as Record<string, unknown>, sortBy);
        bVal = ds(b.data as Record<string, unknown>, sortBy);
      }
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // Paginate
    const skip = options.skip ?? 0;
    const limit = options.limit ?? 50;
    const page = filtered.slice(skip, skip + limit);

    return {
      visits: page.map(toVisit),
      total,
    };
  } catch (err) {
    logger.error('getVisits failed, returning empty', {
      category: 'general',
      error: err instanceof Error ? err.message : String(err),
    });
    return { visits: [], total: 0 };
  }
}

/**
 * Get cases with filtering and pagination.
 * Queries PxCase via Prisma with native column filters.
 */
export async function getCases(options: PXQueryOptions & { visitIds?: string[] }): Promise<{ cases: PXCase[]; total: number }> {
  try {
    const where: Record<string, unknown> = { tenantId: options.tenantId, active: true };

    if (options.visitIds && options.visitIds.length > 0) {
      where.visitId = { in: options.visitIds };
    }
    if (options.severity) {
      where.severity = options.severity;
    }
    if (options.status) {
      where.status = options.status;
    }
    if (options.departmentKey) {
      where.assignedDeptKey = options.departmentKey;
    }
    if (options.from || options.to) {
      const createdAt: Record<string, Date> = {};
      if (options.from) createdAt.gte = options.from;
      if (options.to) createdAt.lte = options.to;
      where.createdAt = createdAt;
    }

    const [rawRows, total] = await Promise.all([
      caseDb.pxCase.findMany({
        where,
        orderBy: { createdAt: options.sortOrder === 'asc' ? 'asc' : 'desc' },
        skip: options.skip ?? 0,
        take: options.limit ?? 50,
      }),
      caseDb.pxCase.count({ where }),
    ]);

    return {
      cases: rawRows.map(toCase),
      total,
    };
  } catch (err) {
    logger.error('getCases failed, returning empty', {
      category: 'general',
      error: err instanceof Error ? err.message : String(err),
    });
    return { cases: [], total: 0 };
  }
}

/**
 * Get summary KPIs by aggregating across PatientExperience and PxCase.
 */
export async function getSummaryKPIs(options: PXQueryOptions): Promise<{
  totalVisits: number;
  totalComplaints: number;
  totalPraise: number;
  avgSatisfaction: number;
  totalCases: number;
  openCases: number;
  overdueCases: number;
  avgResolutionMinutes: number;
  slaBreachPercent: number;
}> {
  const zeros = {
    totalVisits: 0,
    totalComplaints: 0,
    totalPraise: 0,
    avgSatisfaction: 0,
    totalCases: 0,
    openCases: 0,
    overdueCases: 0,
    avgResolutionMinutes: 0,
    slaBreachPercent: 0,
  };

  try {
    /* --- Visits --- */
    const visitWhere: Record<string, unknown> = { tenantId: options.tenantId };
    if (options.from || options.to) {
      const createdAt: Record<string, Date> = {};
      if (options.from) createdAt.gte = options.from;
      if (options.to) createdAt.lte = options.to;
      visitWhere.createdAt = createdAt;
    }

    const allVisits = await db.patientExperience.findMany({
      where: visitWhere,
    });

    const visits = allVisits.filter((r) => matchesJsonFilters(r, options));
    const totalVisits = visits.length;

    const totalComplaints = visits.filter((v) => {
      const t = (v.type || ds(v.data as Record<string, unknown>, 'type') || '').toLowerCase();
      return t === 'complaint' || t === 'شكوى';
    }).length;

    const totalPraise = visits.filter((v) => {
      const t = (v.type || ds(v.data as Record<string, unknown>, 'type') || '').toLowerCase();
      return t === 'praise' || t === 'إشادة' || t === 'compliment';
    }).length;

    const scores = visits.map((v) => dn(v.data as Record<string, unknown>, 'satisfaction')).filter((s) => s > 0);
    const avgSatisfaction =
      scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
        : 0;

    /* --- Cases --- */
    const caseWhere: Record<string, unknown> = { tenantId: options.tenantId, active: true };
    if (options.from || options.to) {
      const createdAt: Record<string, Date> = {};
      if (options.from) createdAt.gte = options.from;
      if (options.to) createdAt.lte = options.to;
      caseWhere.createdAt = createdAt;
    }
    if (options.severity) caseWhere.severity = options.severity;
    if (options.status) caseWhere.status = options.status;
    if (options.departmentKey) caseWhere.assignedDeptKey = options.departmentKey;

    const cases = await caseDb.pxCase.findMany({ where: caseWhere });

    const totalCases = cases.length;
    const openCases = cases.filter((c) => ['OPEN', 'IN_PROGRESS', 'ESCALATED'].includes(c.status ?? '')).length;

    const now = new Date();
    const overdueCases = cases.filter(
      (c) => c.dueAt && now > new Date(c.dueAt) && !['RESOLVED', 'CLOSED'].includes(c.status ?? ''),
    ).length;

    const resolved = cases.filter((c) => c.resolutionMinutes != null && (c.resolutionMinutes ?? 0) > 0);
    const avgResolutionMinutes =
      resolved.length > 0
        ? Math.round(resolved.reduce((sum: number, c) => sum + (c.resolutionMinutes ?? 0), 0) / resolved.length)
        : 0;

    const breached = cases.filter((c) => {
      if (!c.dueAt) return false;
      const due = new Date(c.dueAt);
      if (['RESOLVED', 'CLOSED'].includes(c.status ?? '') && c.resolvedAt) {
        return new Date(c.resolvedAt) > due;
      }
      return now > due && !['RESOLVED', 'CLOSED'].includes(c.status ?? '');
    }).length;
    const slaBreachPercent = totalCases > 0 ? Math.round((breached / totalCases) * 10000) / 100 : 0;

    return {
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
  } catch (err) {
    logger.error('getSummaryKPIs failed, returning zeros', {
      category: 'general',
      error: err instanceof Error ? err.message : String(err),
    });
    return zeros;
  }
}

/**
 * Debug helper: Log tenant filter and query details
 */
export function logPXQuery(
  endpoint: string,
  tenantId: string,
  query: Record<string, unknown>,
  collection: string
): void {
  if (process.env.DEBUG_TENANT === '1') {
    logger.debug('PX query', { category: 'general', endpoint, tenantId, collection, filter: JSON.stringify(query, null, 2) });
  }
}
