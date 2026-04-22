/**
 * Data Warehouse, ETL Pipeline, and Archiving Engine
 *
 * Generates periodic snapshots of HR data for historical analysis, manages
 * data archival of terminated employees / closed requisitions, and provides
 * period-over-period comparison and trend utilities.
 *
 * Collections:
 *   cvision_data_snapshots  — Point-in-time workforce/compensation/etc snapshots
 *   cvision_archive         — Archived (moved) documents from active collections
 *   cvision_etl_logs        — Pipeline run history
 */

import { v4 as uuidv4 } from 'uuid';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_COLLECTIONS } from '@/lib/cvision/constants';
import { GOSI_RATES } from '@/lib/cvision/gosi';
import type {
  WarehouseEmployeeDoc,
  WarehouseDepartmentDoc,
  WarehouseContractDoc,
  WarehouseReviewDoc,
  WarehouseLeaveDoc,
  WarehouseRequisitionDoc,
  WarehouseCandidateDoc,
  WarehouseRetentionScoreDoc,
  WarehouseSnapshotDoc,
  WarehouseETLLogDoc,
} from '@/lib/cvision/types';

// ─── Collection Helpers ─────────────────────────────────────────────────────

const SNAPSHOT_COL = 'cvision_data_snapshots';
const ARCHIVE_COL = 'cvision_archive';
const ETL_LOG_COL = 'cvision_etl_logs';

async function snapshotCol(tenantId: string) {
  const db = await getCVisionDb(tenantId);
  return db.collection(SNAPSHOT_COL);
}

async function archiveCol(tenantId: string) {
  const db = await getCVisionDb(tenantId);
  return db.collection(ARCHIVE_COL);
}

async function etlLogCol(tenantId: string) {
  const db = await getCVisionDb(tenantId);
  return db.collection(ETL_LOG_COL);
}

async function col(tenantId: string, name: string) {
  const db = await getCVisionDb(tenantId);
  return db.collection(name);
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DataSnapshot {
  id: string;
  tenantId: string;
  snapshotId: string;
  period: string;
  type: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'ON_DEMAND';
  createdAt: Date;

  workforce: {
    totalEmployees: number;
    activeEmployees: number;
    newHires: number;
    departures: number;
    departmentBreakdown: { department: string; count: number }[];
    nationalityBreakdown: { nationality: string; count: number }[];
    genderBreakdown: { gender: string; count: number }[];
    avgTenure: number;
    avgAge: number;
    saudizationRate: number;
  };

  compensation: {
    totalPayroll: number;
    avgSalary: number;
    medianSalary: number;
    salaryByDepartment: { department: string; avg: number; total: number }[];
    totalGOSIEmployer: number;
    totalGOSIEmployee: number;
    totalBenefits: number;
  };

  performance: {
    avgPerformanceScore: number;
    reviewsCompleted: number;
    reviewsPending: number;
    ratingDistribution: { rating: string; count: number }[];
    promotionsThisPeriod: number;
    disciplinaryActions: number;
  };

  attendance: {
    avgAttendanceRate: number;
    totalAbsenceDays: number;
    totalSickLeave: number;
    totalAnnualLeave: number;
    totalOvertimeHours: number;
    overtimeCost: number;
  };

  recruitment: {
    openPositions: number;
    applicationsReceived: number;
    candidatesHired: number;
    avgTimeToHire: number;
    avgCostPerHire: number;
    offerAcceptanceRate: number;
  };

  retention: {
    avgFlightRiskScore: number;
    highRiskCount: number;
    criticalRiskCount: number;
    turnoverRate: number;
    voluntaryTurnover: number;
    involuntaryTurnover: number;
    avgEndOfServiceCost: number;
  };

  compliance: {
    nitaqatBand: string;
    saudizationRate: number;
    gosiCompliant: boolean;
    wpsSubmittedOnTime: boolean;
    iqamasExpiringSoon: number;
    visasExpiringSoon: number;
  };
}

export interface ArchiveRecord {
  id: string;
  tenantId: string;
  collection: string;
  documentId: string;
  data: Record<string, any>;
  archivedAt: Date;
  archivedBy: string;
  reason: 'TERMINATED_EMPLOYEE' | 'CLOSED_REQUISITION' | 'OLD_DATA' | 'MANUAL';
  retentionUntil: Date;
}

export interface ETLPipeline {
  pipelineId: string;
  name: string;
  source: string;
  destination: 'SNAPSHOT' | 'ARCHIVE' | 'REPORT';
  schedule: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ON_DEMAND';
  lastRun?: Date;
  nextRun?: Date;
  status: 'ACTIVE' | 'PAUSED' | 'ERROR';
  lastResult?: {
    success: boolean;
    documentsProcessed: number;
    duration: number;
    error?: string;
  };
}

export interface PeriodComparison {
  workforce: ComparisonRow[];
  compensation: ComparisonRow[];
  retention: ComparisonRow[];
  recruitment: ComparisonRow[];
  highlights: string[];
}

interface ComparisonRow {
  metric: string;
  period1: number;
  period2: number;
  change: number;
  changePercent: number;
}

export interface StorageStats {
  totalDocuments: number;
  activeDocuments: number;
  archivedDocuments: number;
  snapshotCount: number;
  oldestSnapshot: string;
  newestSnapshot: string;
  collectionSizes: { collection: string; documents: number; estimatedSize: string }[];
}

// ─── Default Pipelines ──────────────────────────────────────────────────────

export const DEFAULT_PIPELINES: ETLPipeline[] = [
  {
    pipelineId: 'etl-monthly-snapshot',
    name: 'Monthly Snapshot',
    source: 'all_collections',
    destination: 'SNAPSHOT',
    schedule: 'MONTHLY',
    status: 'ACTIVE',
  },
  {
    pipelineId: 'etl-archive-terminated',
    name: 'Archive Terminated Employees',
    source: CVISION_COLLECTIONS.employees,
    destination: 'ARCHIVE',
    schedule: 'MONTHLY',
    status: 'ACTIVE',
  },
  {
    pipelineId: 'etl-archive-requisitions',
    name: 'Archive Closed Requisitions',
    source: CVISION_COLLECTIONS.jobRequisitions,
    destination: 'ARCHIVE',
    schedule: 'MONTHLY',
    status: 'ACTIVE',
  },
  {
    pipelineId: 'etl-archive-reviews',
    name: 'Archive Old Performance Reviews',
    source: CVISION_COLLECTIONS.performanceReviews,
    destination: 'ARCHIVE',
    schedule: 'MONTHLY',
    status: 'ACTIVE',
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function periodToDateRange(period: string): { start: Date; end: Date } {
  const [y, m] = period.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59, 999);
  return { start, end };
}

function monthsAgo(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function diffDays(a: Date, b: Date): number {
  return Math.max(0, Math.ceil((b.getTime() - a.getTime()) / 86_400_000));
}

function estimateDocSize(count: number, avgBytesPerDoc: number = 1024): string {
  const bytes = count * avgBytesPerDoc;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

// GOSI calculation — uses canonical rates from gosi.ts
function calcGOSI(basicSalary: number, housingAllowance: number, isSaudi: boolean) {
  const base = Math.min((basicSalary || 0) + (housingAllowance || 0), GOSI_RATES.MAX_SALARY);
  if (isSaudi) {
    return { employer: Math.round(base * GOSI_RATES.EMPLOYER_RATE * 100) / 100, employee: Math.round(base * GOSI_RATES.EMPLOYEE_RATE * 100) / 100 };
  }
  return { employer: Math.round(base * GOSI_RATES.HAZARD_RATE * 100) / 100, employee: 0 };
}

// ─── Core: Generate Monthly Snapshot ────────────────────────────────────────

export async function generateMonthlySnapshot(
  tenantId: string,
  period?: string,
  type: DataSnapshot['type'] = 'MONTHLY'
): Promise<DataSnapshot> {
  const targetPeriod = period || currentPeriod();
  const { start: periodStart, end: periodEnd } = periodToDateRange(targetPeriod);
  const snapshotId = `SNAP-${targetPeriod}`;
  const now = new Date();

  // Check if already exists
  const snapCol = await snapshotCol(tenantId);
  const existing = await snapCol.findOne({ tenantId, period: targetPeriod });
  if (existing) {
    return existing as unknown as DataSnapshot;
  }

  // ── Fetch raw data ──
  const empCol = await col(tenantId, CVISION_COLLECTIONS.employees);
  const contractCol = await col(tenantId, CVISION_COLLECTIONS.contracts);
  const reviewCol = await col(tenantId, CVISION_COLLECTIONS.performanceReviews);
  const leaveCol = await col(tenantId, CVISION_COLLECTIONS.leaves);
  const reqCol = await col(tenantId, CVISION_COLLECTIONS.jobRequisitions);
  const candCol = await col(tenantId, CVISION_COLLECTIONS.candidates);
  const retCol = await col(tenantId, CVISION_COLLECTIONS.retentionScores);
  const discCol = await col(tenantId, CVISION_COLLECTIONS.disciplinary);
  const promoCol = await col(tenantId, CVISION_COLLECTIONS.promotions);
  const deptCol = await col(tenantId, CVISION_COLLECTIONS.departments);

  const baseFilter = { tenantId, deletedAt: { $exists: false } };

  const allEmployees = await empCol.find(baseFilter).toArray();
  const activeStatuses = ['ACTIVE', 'PROBATION', 'ON_ANNUAL_LEAVE', 'ON_SICK_LEAVE', 'ON_MATERNITY_LEAVE', 'ON_UNPAID_LEAVE'];
  const terminatedStatuses = ['RESIGNED', 'TERMINATED', 'END_OF_CONTRACT', 'RETIRED', 'DECEASED'];

  const activeEmployees = (allEmployees as WarehouseEmployeeDoc[]).filter(e => activeStatuses.includes(e.status));
  const totalActive = activeEmployees.length;

  const newHires = (allEmployees as WarehouseEmployeeDoc[]).filter(e => {
    const hired = e.hiredAt ? new Date(e.hiredAt as string) : null;
    return hired && hired >= periodStart && hired <= periodEnd;
  });

  const departures = (allEmployees as WarehouseEmployeeDoc[]).filter(e => {
    const term = e.terminatedAt || e.resignedAt;
    if (!term) return false;
    const d = new Date(term as string);
    return d >= periodStart && d <= periodEnd && terminatedStatuses.includes(e.status);
  });

  // Department names lookup
  const departments = await deptCol.find(baseFilter).toArray();
  const deptMap = new Map<string, string>();
  for (const d of departments as WarehouseDepartmentDoc[]) deptMap.set(d.id, d.name || d.id);

  // ── Workforce ──
  const deptBreakdown = new Map<string, number>();
  const natBreakdown = new Map<string, number>();
  const genderBreakdown = new Map<string, number>();
  let totalTenureMonths = 0;
  let totalAge = 0;
  let tenureCount = 0;
  let ageCount = 0;
  let saudiCount = 0;

  for (const emp of activeEmployees) {
    const dept = deptMap.get(emp.departmentId) || emp.departmentId || 'Unknown';
    deptBreakdown.set(dept, (deptBreakdown.get(dept) || 0) + 1);

    const nat = emp.nationality || 'Unknown';
    natBreakdown.set(nat, (natBreakdown.get(nat) || 0) + 1);
    if (nat === 'Saudi' || nat === 'SA' || nat?.toLowerCase?.() === 'saudi') saudiCount++;

    const gen = emp.gender || 'Unknown';
    genderBreakdown.set(gen, (genderBreakdown.get(gen) || 0) + 1);

    if (emp.hiredAt) {
      const months = Math.max(0, (now.getTime() - new Date(emp.hiredAt as string).getTime()) / 2_592_000_000);
      totalTenureMonths += months;
      tenureCount++;
    }

    if (emp.dateOfBirth) {
      const age = Math.max(0, (now.getTime() - new Date(emp.dateOfBirth as string).getTime()) / 31_536_000_000);
      totalAge += age;
      ageCount++;
    }
  }

  const workforce: DataSnapshot['workforce'] = {
    totalEmployees: allEmployees.length,
    activeEmployees: totalActive,
    newHires: newHires.length,
    departures: departures.length,
    departmentBreakdown: [...deptBreakdown].map(([department, count]) => ({ department, count })).sort((a, b) => b.count - a.count),
    nationalityBreakdown: [...natBreakdown].map(([nationality, count]) => ({ nationality, count })).sort((a, b) => b.count - a.count),
    genderBreakdown: [...genderBreakdown].map(([gender, count]) => ({ gender, count })),
    avgTenure: tenureCount > 0 ? Math.round(totalTenureMonths / tenureCount * 10) / 10 : 0,
    avgAge: ageCount > 0 ? Math.round(totalAge / ageCount * 10) / 10 : 0,
    saudizationRate: totalActive > 0 ? pct(saudiCount, totalActive) : 0,
  };

  // ── Compensation ──
  const activeIds = new Set(activeEmployees.map(e => e.id));
  const contracts = await contractCol.find({ ...baseFilter }).toArray() as WarehouseContractDoc[];
  const activeContracts = contracts.filter(c => activeIds.has(c.employeeId));

  const salaries: number[] = [];
  let totalPayroll = 0;
  let totalGOSIEmployer = 0;
  let totalGOSIEmployee = 0;
  let totalBenefits = 0;
  const salaryByDept = new Map<string, { total: number; count: number }>();

  for (const c of activeContracts) {
    const basic = c.basicSalary || 0;
    const housing = c.housingAllowance || 0;
    const transport = c.transportAllowance || 0;
    const other = c.otherAllowances || 0;
    const total = basic + housing + transport + other;
    salaries.push(total);
    totalPayroll += total;
    totalBenefits += transport + other;

    // Find employee for nationality
    const emp = activeEmployees.find(e => e.id === c.employeeId);
    const isSaudi = emp?.nationality === 'Saudi' || emp?.nationality === 'SA' || emp?.nationality?.toLowerCase?.() === 'saudi';
    const gosi = calcGOSI(basic, housing, isSaudi);
    totalGOSIEmployer += gosi.employer;
    totalGOSIEmployee += gosi.employee;

    const dept = emp ? (deptMap.get(emp.departmentId) || emp.departmentId || 'Unknown') : 'Unknown';
    const entry = salaryByDept.get(dept) || { total: 0, count: 0 };
    entry.total += total;
    entry.count++;
    salaryByDept.set(dept, entry);
  }

  const compensation: DataSnapshot['compensation'] = {
    totalPayroll: Math.round(totalPayroll),
    avgSalary: salaries.length > 0 ? Math.round(totalPayroll / salaries.length) : 0,
    medianSalary: Math.round(median(salaries)),
    salaryByDepartment: [...salaryByDept].map(([department, v]) => ({
      department,
      avg: v.count > 0 ? Math.round(v.total / v.count) : 0,
      total: Math.round(v.total),
    })).sort((a, b) => b.total - a.total),
    totalGOSIEmployer: Math.round(totalGOSIEmployer),
    totalGOSIEmployee: Math.round(totalGOSIEmployee),
    totalBenefits: Math.round(totalBenefits),
  };

  // ── Performance ──
  const reviews = await reviewCol.find(baseFilter).toArray() as WarehouseReviewDoc[];
  const periodReviews = reviews; // all reviews currently in system
  const completedReviews = periodReviews.filter(r => r.status === 'COMPLETED' || r.completedAt);
  const pendingReviews = periodReviews.filter(r => r.status !== 'COMPLETED' && !r.completedAt);

  let totalPerfScore = 0;
  let perfCount = 0;
  const ratingDist = new Map<string, number>();
  for (const r of completedReviews) {
    if (r.finalScore != null) { totalPerfScore += r.finalScore; perfCount++; }
    const rating = r.rating || 'Unrated';
    ratingDist.set(rating, (ratingDist.get(rating) || 0) + 1);
  }

  const promotions = await promoCol.find({
    ...baseFilter,
    $or: [
      { effectiveDate: { $gte: periodStart, $lte: periodEnd } },
      { createdAt: { $gte: periodStart, $lte: periodEnd } },
    ],
  }).toArray();

  const disciplinaryActions = await discCol.countDocuments({
    ...baseFilter,
    createdAt: { $gte: periodStart, $lte: periodEnd },
  });

  const performance: DataSnapshot['performance'] = {
    avgPerformanceScore: perfCount > 0 ? Math.round(totalPerfScore / perfCount * 10) / 10 : 0,
    reviewsCompleted: completedReviews.length,
    reviewsPending: pendingReviews.length,
    ratingDistribution: [...ratingDist].map(([rating, count]) => ({ rating, count })),
    promotionsThisPeriod: promotions.length,
    disciplinaryActions,
  };

  // ── Attendance ──
  const leaves = await leaveCol.find({
    ...baseFilter,
    $or: [
      { startDate: { $gte: periodStart.toISOString(), $lte: periodEnd.toISOString() } },
      { createdAt: { $gte: periodStart, $lte: periodEnd } },
    ],
  }).toArray() as WarehouseLeaveDoc[];

  let totalAbsenceDays = 0;
  let totalSick = 0;
  let totalAnnual = 0;

  for (const lv of leaves) {
    const days = lv.days || lv.totalDays || (lv.startDate && lv.endDate ? diffDays(new Date(lv.startDate), new Date(lv.endDate)) + 1 : 1);
    totalAbsenceDays += days;
    const ltype = (lv.leaveType || lv.type || '').toUpperCase();
    if (ltype.includes('SICK')) totalSick += days;
    if (ltype.includes('ANNUAL')) totalAnnual += days;
  }

  const workingDaysInPeriod = 22;
  const expectedDays = totalActive * workingDaysInPeriod;
  const attendanceRate = expectedDays > 0 ? pct(expectedDays - totalAbsenceDays, expectedDays) : 100;

  const attendance: DataSnapshot['attendance'] = {
    avgAttendanceRate: Math.min(100, Math.max(0, attendanceRate)),
    totalAbsenceDays,
    totalSickLeave: totalSick,
    totalAnnualLeave: totalAnnual,
    totalOvertimeHours: 0,
    overtimeCost: 0,
  };

  // ── Recruitment ──
  const requisitions = await reqCol.find(baseFilter).toArray() as WarehouseRequisitionDoc[];
  const openReqs = requisitions.filter(r => r.status === 'open' || r.status === 'approved');
  const candidates = await candCol.find(baseFilter).toArray() as WarehouseCandidateDoc[];
  const periodCandidates = candidates.filter(c => {
    const d = c.createdAt ? new Date(c.createdAt as string) : null;
    return d && d >= periodStart && d <= periodEnd;
  });
  const hiredCandidates = candidates.filter(c => c.status === 'hired');
  const periodHired = hiredCandidates.filter(c => {
    const d = c.updatedAt ? new Date(c.updatedAt as string) : null;
    return d && d >= periodStart && d <= periodEnd;
  });

  const offeredCandidates = candidates.filter(c => c.status === 'offer' || c.status === 'hired');
  const offerAcceptance = offeredCandidates.length > 0 ? pct(hiredCandidates.length, offeredCandidates.length) : 0;

  let totalTimeToHire = 0;
  let hireTimeCount = 0;
  for (const c of hiredCandidates) {
    if (c.createdAt && c.updatedAt) {
      const days = diffDays(new Date(c.createdAt as string), new Date(c.updatedAt as string));
      if (days > 0 && days < 365) { totalTimeToHire += days; hireTimeCount++; }
    }
  }

  const recruitment: DataSnapshot['recruitment'] = {
    openPositions: openReqs.reduce((sum: number, r: WarehouseRequisitionDoc) => sum + (r.headcount || 1), 0),
    applicationsReceived: periodCandidates.length,
    candidatesHired: periodHired.length,
    avgTimeToHire: hireTimeCount > 0 ? Math.round(totalTimeToHire / hireTimeCount) : 0,
    avgCostPerHire: 0,
    offerAcceptanceRate: offerAcceptance,
  };

  // ── Retention ──
  const retentionScores = await retCol.find(baseFilter).toArray() as WarehouseRetentionScoreDoc[];
  let totalRisk = 0;
  let highRisk = 0;
  let criticalRisk = 0;
  for (const r of retentionScores) {
    totalRisk += r.flightRiskScore || 0;
    if (r.riskLevel === 'HIGH') highRisk++;
    if (r.riskLevel === 'CRITICAL') criticalRisk++;
  }

  const volDeps = departures.filter(e => e.status === 'RESIGNED').length;
  const involDeps = departures.filter(e => e.status === 'TERMINATED' || e.status === 'END_OF_CONTRACT').length;
  const turnoverBase = totalActive + departures.length;
  const turnoverRate = turnoverBase > 0 ? pct(departures.length, turnoverBase) : 0;

  const retention: DataSnapshot['retention'] = {
    avgFlightRiskScore: retentionScores.length > 0 ? Math.round(totalRisk / retentionScores.length * 10) / 10 : 0,
    highRiskCount: highRisk,
    criticalRiskCount: criticalRisk,
    turnoverRate,
    voluntaryTurnover: volDeps,
    involuntaryTurnover: involDeps,
    avgEndOfServiceCost: 0,
  };

  // ── Compliance ──
  const compliance: DataSnapshot['compliance'] = {
    nitaqatBand: workforce.saudizationRate >= 40 ? 'PLATINUM' :
      workforce.saudizationRate >= 27 ? 'GREEN_HIGH' :
      workforce.saudizationRate >= 23 ? 'GREEN_MID' :
      workforce.saudizationRate >= 17 ? 'GREEN_LOW' :
      workforce.saudizationRate >= 10 ? 'YELLOW' : 'RED',
    saudizationRate: workforce.saudizationRate,
    gosiCompliant: true,
    wpsSubmittedOnTime: true,
    iqamasExpiringSoon: 0,
    visasExpiringSoon: 0,
  };

  // ── Build & save snapshot ──
  const snapshot: DataSnapshot = {
    id: uuidv4(),
    tenantId,
    snapshotId,
    period: targetPeriod,
    type,
    createdAt: now,
    workforce,
    compensation,
    performance,
    attendance,
    recruitment,
    retention,
    compliance,
  };

  await snapCol.insertOne(snapshot as unknown as Record<string, unknown>);

  // Log ETL run
  await logETLRun(tenantId, 'etl-monthly-snapshot', true, allEmployees.length, now);

  return snapshot;
}

// ─── Snapshot Queries ───────────────────────────────────────────────────────

export async function getSnapshots(
  tenantId: string,
  filters?: { startPeriod?: string; endPeriod?: string; type?: string }
): Promise<DataSnapshot[]> {
  const c = await snapshotCol(tenantId);
  const query: Record<string, any> = { tenantId };
  if (filters?.startPeriod || filters?.endPeriod) {
    query.period = {};
    if (filters.startPeriod) query.period.$gte = filters.startPeriod;
    if (filters.endPeriod) query.period.$lte = filters.endPeriod;
  }
  if (filters?.type) query.type = filters.type;

  return (await c.find(query).sort({ period: -1 }).toArray()) as unknown as DataSnapshot[];
}

export async function getSnapshotDetail(
  tenantId: string,
  snapshotIdOrPeriod: string
): Promise<DataSnapshot | null> {
  const c = await snapshotCol(tenantId);
  const result = await c.findOne({
    tenantId,
    $or: [{ snapshotId: snapshotIdOrPeriod }, { period: snapshotIdOrPeriod }],
  });
  return (result as unknown as DataSnapshot) || null;
}

// ─── Period Comparison ──────────────────────────────────────────────────────

export async function comparePeriods(
  tenantId: string,
  period1: string,
  period2: string
): Promise<PeriodComparison> {
  const s1 = await getSnapshotDetail(tenantId, period1);
  const s2 = await getSnapshotDetail(tenantId, period2);

  if (!s1 || !s2) {
    return { workforce: [], compensation: [], retention: [], recruitment: [], highlights: ['One or both periods have no snapshot data.'] };
  }

  function row(metric: string, v1: number, v2: number): ComparisonRow {
    const change = v2 - v1;
    const changePercent = v1 !== 0 ? Math.round((change / v1) * 1000) / 10 : v2 !== 0 ? 100 : 0;
    return { metric, period1: v1, period2: v2, change, changePercent };
  }

  const wf: ComparisonRow[] = [
    row('Total Employees', s1.workforce.totalEmployees, s2.workforce.totalEmployees),
    row('Active Employees', s1.workforce.activeEmployees, s2.workforce.activeEmployees),
    row('New Hires', s1.workforce.newHires, s2.workforce.newHires),
    row('Departures', s1.workforce.departures, s2.workforce.departures),
    row('Avg Tenure (months)', s1.workforce.avgTenure, s2.workforce.avgTenure),
    row('Saudization Rate (%)', s1.workforce.saudizationRate, s2.workforce.saudizationRate),
  ];

  const comp: ComparisonRow[] = [
    row('Total Payroll (SAR)', s1.compensation.totalPayroll, s2.compensation.totalPayroll),
    row('Avg Salary (SAR)', s1.compensation.avgSalary, s2.compensation.avgSalary),
    row('Median Salary (SAR)', s1.compensation.medianSalary, s2.compensation.medianSalary),
    row('GOSI Employer (SAR)', s1.compensation.totalGOSIEmployer, s2.compensation.totalGOSIEmployer),
  ];

  const ret: ComparisonRow[] = [
    row('Avg Flight Risk', s1.retention.avgFlightRiskScore, s2.retention.avgFlightRiskScore),
    row('High Risk Count', s1.retention.highRiskCount, s2.retention.highRiskCount),
    row('Turnover Rate (%)', s1.retention.turnoverRate, s2.retention.turnoverRate),
  ];

  const rec: ComparisonRow[] = [
    row('Open Positions', s1.recruitment.openPositions, s2.recruitment.openPositions),
    row('Applications', s1.recruitment.applicationsReceived, s2.recruitment.applicationsReceived),
    row('Hired', s1.recruitment.candidatesHired, s2.recruitment.candidatesHired),
    row('Avg Time to Hire (days)', s1.recruitment.avgTimeToHire, s2.recruitment.avgTimeToHire),
  ];

  // Auto-generate highlights
  const highlights: string[] = [];
  const hcChange = s2.workforce.activeEmployees - s1.workforce.activeEmployees;
  if (hcChange > 0) highlights.push(`Headcount increased by ${hcChange} (${pct(hcChange, s1.workforce.activeEmployees)}%)`);
  if (hcChange < 0) highlights.push(`Headcount decreased by ${Math.abs(hcChange)} (${pct(Math.abs(hcChange), s1.workforce.activeEmployees)}%)`);

  const trChange = s2.retention.turnoverRate - s1.retention.turnoverRate;
  if (trChange > 0) highlights.push(`Turnover rate increased by ${trChange.toFixed(1)}%`);
  if (trChange < 0) highlights.push(`Turnover rate decreased by ${Math.abs(trChange).toFixed(1)}%`);

  const payChange = s2.compensation.totalPayroll - s1.compensation.totalPayroll;
  if (payChange !== 0) {
    const direction = payChange > 0 ? 'increased' : 'decreased';
    highlights.push(`Total payroll ${direction} by SAR ${Math.abs(payChange).toLocaleString()}`);
  }

  if (s2.workforce.saudizationRate !== s1.workforce.saudizationRate) {
    highlights.push(`Saudization rate moved from ${s1.workforce.saudizationRate}% to ${s2.workforce.saudizationRate}%`);
  }

  if (highlights.length === 0) highlights.push('No significant changes between the two periods.');

  return { workforce: wf, compensation: comp, retention: ret, recruitment: rec, highlights };
}

// ─── Trends (time-series for charting) ──────────────────────────────────────

export async function getTrends(
  tenantId: string,
  metric: string,
  periodCount: number = 6
): Promise<{ period: string; value: number }[]> {
  const snapshots = await getSnapshots(tenantId);
  const recent = snapshots.slice(0, periodCount).reverse();

  return recent.map(s => {
    let value = 0;
    switch (metric) {
      case 'headcount': value = s.workforce.activeEmployees; break;
      case 'totalEmployees': value = s.workforce.totalEmployees; break;
      case 'payroll': value = s.compensation.totalPayroll; break;
      case 'avgSalary': value = s.compensation.avgSalary; break;
      case 'turnover': value = s.retention.turnoverRate; break;
      case 'flightRisk': value = s.retention.avgFlightRiskScore; break;
      case 'saudization': value = s.workforce.saudizationRate; break;
      case 'attendance': value = s.attendance.avgAttendanceRate; break;
      case 'performance': value = s.performance.avgPerformanceScore; break;
      case 'newHires': value = s.workforce.newHires; break;
      case 'departures': value = s.workforce.departures; break;
      case 'openPositions': value = s.recruitment.openPositions; break;
      case 'highRisk': value = s.retention.highRiskCount; break;
      default: value = 0;
    }
    return { period: s.period, value };
  });
}

// ─── Archive Functions ──────────────────────────────────────────────────────

export async function archiveTerminatedEmployees(
  tenantId: string,
  olderThanMonths: number = 12,
  archivedBy: string = 'SYSTEM'
): Promise<{ archived: number }> {
  const empCol = await col(tenantId, CVISION_COLLECTIONS.employees);
  const archive = await archiveCol(tenantId);
  const cutoff = monthsAgo(olderThanMonths);

  const terminated = await empCol.find({
    tenantId,
    status: { $in: ['RESIGNED', 'TERMINATED', 'END_OF_CONTRACT', 'RETIRED', 'DECEASED'] },
    $or: [
      { terminatedAt: { $lt: cutoff } },
      { resignedAt: { $lt: cutoff } },
      { updatedAt: { $lt: cutoff } },
    ],
    isArchived: { $ne: true },
  }).toArray();

  if (terminated.length === 0) return { archived: 0 };

  const records = (terminated as WarehouseEmployeeDoc[]).map(doc => ({
    id: uuidv4(),
    tenantId,
    collection: CVISION_COLLECTIONS.employees,
    documentId: doc.id || String(doc._id),
    data: doc as unknown as Record<string, unknown>,
    archivedAt: new Date(),
    archivedBy,
    reason: 'TERMINATED_EMPLOYEE' as const,
    retentionUntil: new Date(Date.now() + 5 * 365 * 86_400_000), // 5-year retention
  }));

  await archive.insertMany(records);

  const docIds = (terminated as WarehouseEmployeeDoc[]).map(d => d._id);
  await empCol.updateMany(
    { _id: { $in: docIds } },
    { $set: { isArchived: true, updatedAt: new Date() } }
  );

  await logETLRun(tenantId, 'etl-archive-terminated', true, terminated.length, new Date());

  return { archived: terminated.length };
}

export async function archiveClosedRequisitions(
  tenantId: string,
  olderThanMonths: number = 12,
  archivedBy: string = 'SYSTEM'
): Promise<{ archived: number }> {
  const reqCol = await col(tenantId, CVISION_COLLECTIONS.jobRequisitions);
  const archive = await archiveCol(tenantId);
  const cutoff = monthsAgo(olderThanMonths);

  const closed = await reqCol.find({
    tenantId,
    status: { $in: ['closed', 'cancelled'] },
    updatedAt: { $lt: cutoff },
    isArchived: { $ne: true },
  }).toArray();

  if (closed.length === 0) return { archived: 0 };

  const records = (closed as WarehouseRequisitionDoc[]).map(doc => ({
    id: uuidv4(),
    tenantId,
    collection: CVISION_COLLECTIONS.jobRequisitions,
    documentId: doc.id || String(doc._id),
    data: doc as unknown as Record<string, unknown>,
    archivedAt: new Date(),
    archivedBy,
    reason: 'CLOSED_REQUISITION' as const,
    retentionUntil: new Date(Date.now() + 3 * 365 * 86_400_000),
  }));

  await archive.insertMany(records);
  const docIds = (closed as WarehouseRequisitionDoc[]).map(d => d._id);
  await reqCol.updateMany(
    { _id: { $in: docIds } },
    { $set: { isArchived: true, updatedAt: new Date() } }
  );

  await logETLRun(tenantId, 'etl-archive-requisitions', true, closed.length, new Date());
  return { archived: closed.length };
}

export async function archiveOldPerformanceReviews(
  tenantId: string,
  olderThanMonths: number = 24,
  archivedBy: string = 'SYSTEM'
): Promise<{ archived: number }> {
  const revCol = await col(tenantId, CVISION_COLLECTIONS.performanceReviews);
  const archive = await archiveCol(tenantId);
  const cutoff = monthsAgo(olderThanMonths);

  const old = await revCol.find({
    tenantId,
    status: 'COMPLETED',
    $or: [
      { completedAt: { $lt: cutoff.toISOString() } },
      { updatedAt: { $lt: cutoff } },
    ],
    isArchived: { $ne: true },
  }).toArray();

  if (old.length === 0) return { archived: 0 };

  const records = (old as WarehouseReviewDoc[]).map(doc => ({
    id: uuidv4(),
    tenantId,
    collection: CVISION_COLLECTIONS.performanceReviews,
    documentId: doc.id || String(doc._id),
    data: doc as unknown as Record<string, unknown>,
    archivedAt: new Date(),
    archivedBy,
    reason: 'OLD_DATA' as const,
    retentionUntil: new Date(Date.now() + 7 * 365 * 86_400_000),
  }));

  await archive.insertMany(records);
  const docIds = (old as WarehouseReviewDoc[]).map(d => d._id);
  await revCol.updateMany(
    { _id: { $in: docIds } },
    { $set: { isArchived: true, updatedAt: new Date() } }
  );

  await logETLRun(tenantId, 'etl-archive-reviews', true, old.length, new Date());
  return { archived: old.length };
}

// ─── Archive Search & Restore ───────────────────────────────────────────────

export async function searchArchive(
  tenantId: string,
  filters?: {
    collection?: string;
    documentId?: string;
    reason?: string;
    dateRange?: { start: Date; end: Date };
  }
): Promise<ArchiveRecord[]> {
  const c = await archiveCol(tenantId);
  const query: Record<string, any> = { tenantId };

  if (filters?.collection) query.collection = filters.collection;
  if (filters?.documentId) query.documentId = filters.documentId;
  if (filters?.reason) query.reason = filters.reason;
  if (filters?.dateRange) {
    query.archivedAt = { $gte: filters.dateRange.start, $lte: filters.dateRange.end };
  }

  return (await c.find(query).sort({ archivedAt: -1 }).limit(200).toArray()) as unknown as ArchiveRecord[];
}

export async function restoreFromArchive(
  tenantId: string,
  archiveId: string
): Promise<{ restored: boolean; collection: string; documentId: string }> {
  const c = await archiveCol(tenantId);
  const record = await c.findOne({ tenantId, id: archiveId });

  if (!record) {
    return { restored: false, collection: '', documentId: '' };
  }

  const rec = record as unknown as ArchiveRecord;
  const target = await col(tenantId, rec.collection);

  // Restore the document — un-archive it
  const { _id: _removedId, ...docRest } = rec.data as Record<string, unknown>;
  const docData = { ...docRest, isArchived: false, updatedAt: new Date() };

  await target.updateOne(
    { tenantId, id: rec.documentId },
    { $set: { isArchived: false, updatedAt: new Date() } }
  );

  await c.deleteOne({ tenantId, id: archiveId });

  return { restored: true, collection: rec.collection, documentId: rec.documentId };
}

// ─── Storage Stats ──────────────────────────────────────────────────────────

export async function getStorageStats(tenantId: string): Promise<StorageStats> {
  const db = await getCVisionDb(tenantId);
  const snapC = await snapshotCol(tenantId);
  const archC = await archiveCol(tenantId);

  const snapshotCount = await snapC.countDocuments({ tenantId });
  const archivedDocuments = await archC.countDocuments({ tenantId });

  // Get oldest/newest snapshot
  const oldest = await snapC.findOne({ tenantId }, { sort: { period: 1 } });
  const newest = await snapC.findOne({ tenantId }, { sort: { period: -1 } });

  // Count active documents per main collection
  const mainCollections = [
    'employees', 'contracts', 'jobRequisitions', 'candidates',
    'performanceReviews', 'leaves', 'disciplinary', 'promotions',
    'departments', 'units', 'jobTitles', 'grades',
    'retentionScores', 'branches',
  ] as const;

  const collectionSizes: StorageStats['collectionSizes'] = [];
  let totalDocuments = 0;
  let activeDocuments = 0;

  for (const key of mainCollections) {
    const collName = CVISION_COLLECTIONS[key];
    if (!collName) continue;
    try {
      const c = db.collection(collName);
      const total = await c.countDocuments({ tenantId });
      const active = await c.countDocuments({ tenantId, isArchived: { $ne: true }, deletedAt: { $exists: false } });
      totalDocuments += total;
      activeDocuments += active;
      collectionSizes.push({ collection: collName, documents: total, estimatedSize: estimateDocSize(total) });
    } catch {
      // collection may not exist yet
    }
  }

  totalDocuments += snapshotCount + archivedDocuments;

  return {
    totalDocuments,
    activeDocuments,
    archivedDocuments,
    snapshotCount,
    oldestSnapshot: (oldest as WarehouseSnapshotDoc | null)?.period || 'N/A',
    newestSnapshot: (newest as WarehouseSnapshotDoc | null)?.period || 'N/A',
    collectionSizes: collectionSizes.sort((a, b) => b.documents - a.documents),
  };
}

// ─── ETL Pipeline Management ────────────────────────────────────────────────

async function logETLRun(
  tenantId: string,
  pipelineId: string,
  success: boolean,
  documentsProcessed: number,
  startTime: Date,
  error?: string
) {
  const c = await etlLogCol(tenantId);
  await c.insertOne({
    id: uuidv4(),
    tenantId,
    pipelineId,
    success,
    documentsProcessed,
    duration: Date.now() - startTime.getTime(),
    error: error || null,
    ranAt: new Date(),
  });
}

export async function getETLPipelines(tenantId: string): Promise<(ETLPipeline & { lastRunLog?: WarehouseETLLogDoc })[]> {
  const logC = await etlLogCol(tenantId);

  return Promise.all(
    DEFAULT_PIPELINES.map(async (pipeline) => {
      const lastLog = await logC.findOne(
        { tenantId, pipelineId: pipeline.pipelineId },
        { sort: { ranAt: -1 } }
      ) as WarehouseETLLogDoc | null;

      return {
        ...pipeline,
        lastRun: lastLog ? lastLog.ranAt : undefined,
        lastResult: lastLog ? {
          success: lastLog.success,
          documentsProcessed: lastLog.documentsProcessed,
          duration: lastLog.duration,
          error: lastLog.error || undefined,
        } : undefined,
        lastRunLog: lastLog || undefined,
      };
    })
  );
}

export async function runETLPipeline(
  tenantId: string,
  pipelineId: string,
  archivedBy: string = 'SYSTEM'
): Promise<{ success: boolean; documentsProcessed: number; message: string }> {
  const start = new Date();

  try {
    switch (pipelineId) {
      case 'etl-monthly-snapshot': {
        const snap = await generateMonthlySnapshot(tenantId);
        return { success: true, documentsProcessed: snap.workforce.totalEmployees, message: `Snapshot ${snap.snapshotId} generated.` };
      }
      case 'etl-archive-terminated': {
        const result = await archiveTerminatedEmployees(tenantId, 12, archivedBy);
        return { success: true, documentsProcessed: result.archived, message: `${result.archived} terminated employees archived.` };
      }
      case 'etl-archive-requisitions': {
        const result = await archiveClosedRequisitions(tenantId, 12, archivedBy);
        return { success: true, documentsProcessed: result.archived, message: `${result.archived} closed requisitions archived.` };
      }
      case 'etl-archive-reviews': {
        const result = await archiveOldPerformanceReviews(tenantId, 24, archivedBy);
        return { success: true, documentsProcessed: result.archived, message: `${result.archived} old reviews archived.` };
      }
      default:
        return { success: false, documentsProcessed: 0, message: `Unknown pipeline: ${pipelineId}` };
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Pipeline failed';
    await logETLRun(tenantId, pipelineId, false, 0, start, errMsg);
    return { success: false, documentsProcessed: 0, message: errMsg };
  }
}

// ─── Backfill ───────────────────────────────────────────────────────────────

export async function backfillSnapshots(
  tenantId: string
): Promise<{ generated: number; periods: string[] }> {
  const snapC = await snapshotCol(tenantId);
  const count = await snapC.countDocuments({ tenantId });

  if (count > 0) {
    return { generated: 0, periods: [] };
  }

  // Generate current month snapshot
  const period = currentPeriod();
  await generateMonthlySnapshot(tenantId, period);
  return { generated: 1, periods: [period] };
}
