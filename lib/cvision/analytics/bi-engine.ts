/**
 * Advanced BI Analytics Engine
 *
 * Provides absence pattern analysis, resignation seasonality detection,
 * workforce trend aggregation, executive summaries, department scorecards,
 * and KPI computation with period-over-period comparison.
 *
 * Reads from existing collections (leaves, employees, status history,
 * retention scores, performance reviews, etc.) — never writes to them.
 * Uses data-warehouse snapshots when available for historical trends.
 */

import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_COLLECTIONS } from '@/lib/cvision/constants';

// ─── Collection helpers ─────────────────────────────────────────────────────

async function col(tenantId: string, name: string) {
  const db = await getCVisionDb(tenantId);
  return db.collection(name);
}

const SNAPSHOT_COL = 'cvision_data_snapshots';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AbsencePattern {
  dayOfWeekDistribution: {
    day: string;
    dayIndex: number;
    totalAbsences: number;
    percentage: number;
    trend: 'HIGH' | 'NORMAL' | 'LOW';
  }[];
  monthlyDistribution: {
    month: string;
    monthIndex: number;
    totalAbsences: number;
    avgPerEmployee: number;
    isHighSeason: boolean;
  }[];
  departmentPatterns: {
    department: string;
    totalAbsences: number;
    avgPerEmployee: number;
    topReasons: { reason: string; count: number }[];
    sunThuRate: number;
  }[];
  employeePatterns: {
    employeeId: string;
    employeeName: string;
    department: string;
    totalAbsences: number;
    pattern: string;
    severity: 'NORMAL' | 'WATCH' | 'CONCERN' | 'CRITICAL';
    details: string;
  }[];
  summary: {
    totalAbsences: number;
    totalEmployees: number;
    avgAbsencesPerEmployee: number;
    periodStart: string;
    periodEnd: string;
  };
  insights: string[];
}

export interface ResignationSeasonality {
  monthlyRates: {
    period: string;
    month: string;
    resignations: number;
    turnoverRate: number;
    avgTenureAtDeparture: number;
    topReasons: string[];
  }[];
  predictions: {
    period: string;
    month: string;
    predictedResignations: number;
    confidence: number;
    riskFactors: string[];
  }[];
  peakSeasons: {
    months: string[];
    reason: string;
  }[];
  departmentVulnerability: {
    department: string;
    resignationsLast12Months: number;
    currentHighRiskCount: number;
    predictedNext3Months: number;
    vulnerabilityScore: number;
  }[];
  costImpact: {
    last12MonthsCost: number;
    projected12MonthsCost: number;
    costByDepartment: { department: string; cost: number }[];
    preventableSavings: number;
  };
  insights: string[];
}

export interface WorkforceTrend {
  metric: string;
  unit: string;
  dataPoints: { period: string; value: number; change?: number }[];
  trend: 'UP' | 'DOWN' | 'STABLE';
}

export interface KPICard {
  key: string;
  label: string;
  value: number;
  formatted: string;
  unit: string;
  previousValue: number;
  change: number;
  changePercent: number;
  status: 'GOOD' | 'WARNING' | 'CRITICAL' | 'NEUTRAL';
}

export interface DepartmentScorecard {
  department: string;
  headcount: number;
  avgSalary: number;
  turnoverRate: number;
  absenceRate: number;
  avgRiskScore: number;
  performanceAvg: number;
  compositeScore: number;
}

export interface ExecutiveSummary {
  period: string;
  kpis: KPICard[];
  departmentScorecard: DepartmentScorecard[];
  topConcerns: string[];
  recommendations: string[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const REPLACEMENT_COST_MONTHS = 3;

// ─── Helpers ────────────────────────────────────────────────────────────────

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 1000) / 10;
}

function monthsAgo(n: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function periodStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function getDeptMap(tenantId: string): Promise<Map<string, string>> {
  const deptCol = await col(tenantId, CVISION_COLLECTIONS.departments);
  const depts = await deptCol.find({ tenantId, deletedAt: { $exists: false } }).limit(500).toArray();
  const map = new Map<string, string>();
  for (const d of depts) map.set(d.id, d.name || d.id);
  return map;
}

async function getActiveEmployees(tenantId: string) {
  const empCol = await col(tenantId, CVISION_COLLECTIONS.employees);
  const activeStatuses = ['ACTIVE', 'PROBATION', 'ON_ANNUAL_LEAVE', 'ON_SICK_LEAVE', 'ON_MATERNITY_LEAVE', 'ON_UNPAID_LEAVE'];
  return empCol.find({
    tenantId,
    deletedAt: { $exists: false },
    status: { $in: activeStatuses },
  }).limit(5000).toArray();
}

async function getAllEmployees(tenantId: string) {
  const empCol = await col(tenantId, CVISION_COLLECTIONS.employees);
  return empCol.find({ tenantId, deletedAt: { $exists: false } }).limit(5000).toArray();
}

// ─── 1. Absence Pattern Analysis ────────────────────────────────────────────

export async function analyzeAbsencePatterns(
  tenantId: string,
  options?: { startDate?: string; endDate?: string; department?: string }
): Promise<AbsencePattern> {
  const leaveCol = await col(tenantId, CVISION_COLLECTIONS.leaves);
  const deptMap = await getDeptMap(tenantId);
  const employees = await getActiveEmployees(tenantId);

  const empMap = new Map<string, any>();
  for (const e of employees) empMap.set(e.id, e);

  // Build leave query
  const query: Record<string, any> = {
    tenantId,
    deletedAt: { $exists: false },
    status: { $in: ['APPROVED', 'approved'] },
  };

  const now = new Date();
  const start = options?.startDate ? new Date(options.startDate) : monthsAgo(12);
  const end = options?.endDate ? new Date(options.endDate) : now;

  query.$or = [
    { startDate: { $gte: start, $lte: end } },
    { createdAt: { $gte: start, $lte: end } },
  ];

  if (options?.department) {
    const empIds = employees.filter((e: any) => {
      const dept = deptMap.get(e.departmentId) || e.departmentId;
      return dept === options.department || e.departmentId === options.department;
    }).map((e: any) => e.id);
    query.employeeId = { $in: empIds };
  }

  const leaves = await leaveCol.find(query).limit(10000).toArray();

  // ── Day of week distribution ──
  const dayCount = new Array(7).fill(0);
  const monthCount = new Array(12).fill(0);

  // Per-employee tracking
  const empAbsences = new Map<string, { total: number; days: number[]; months: number[]; types: string[] }>();

  // Per-department tracking
  const deptAbsences = new Map<string, { total: number; types: string[]; sunThu: number; empIds: Set<string> }>();

  for (const lv of leaves) {
    const sd = lv.startDate ? new Date(lv.startDate) : (lv.createdAt ? new Date(lv.createdAt) : null);
    if (!sd || isNaN(sd.getTime())) continue;

    const days = lv.days || lv.totalDays || 1;
    const dayOfWeek = sd.getDay();
    const monthIdx = sd.getMonth();
    const leaveType = lv.leaveType || lv.type || 'OTHER';

    dayCount[dayOfWeek] += days;
    monthCount[monthIdx] += days;

    // Employee tracking
    const eid = lv.employeeId;
    const entry = empAbsences.get(eid) || { total: 0, days: new Array(7).fill(0), months: new Array(12).fill(0), types: [] };
    entry.total += days;
    entry.days[dayOfWeek] += days;
    entry.months[monthIdx] += days;
    entry.types.push(leaveType);
    empAbsences.set(eid, entry);

    // Department tracking
    const emp = empMap.get(eid);
    const dept = emp ? (deptMap.get(emp.departmentId) || emp.departmentId || 'Unknown') : 'Unknown';
    const dEntry = deptAbsences.get(dept) || { total: 0, types: [], sunThu: 0, empIds: new Set<string>() };
    dEntry.total += days;
    dEntry.types.push(leaveType);
    if (dayOfWeek === 0 || dayOfWeek === 4) dEntry.sunThu += days; // Sun=0, Thu=4
    dEntry.empIds.add(eid);
    deptAbsences.set(dept, dEntry);
  }

  const totalAbsences = dayCount.reduce((s, v) => s + v, 0);
  const avgPerDay = totalAbsences / 7;

  const dayOfWeekDistribution = DAYS_EN.map((day, i) => ({
    day,
    dayIndex: i,
    totalAbsences: dayCount[i],
    percentage: pct(dayCount[i], totalAbsences),
    trend: (dayCount[i] > avgPerDay * 1.3 ? 'HIGH' : dayCount[i] < avgPerDay * 0.7 ? 'LOW' : 'NORMAL') as 'HIGH' | 'NORMAL' | 'LOW',
  }));

  const avgPerMonth = totalAbsences / 12;
  const monthlyDistribution = MONTHS_EN.map((month, i) => ({
    month,
    monthIndex: i,
    totalAbsences: monthCount[i],
    avgPerEmployee: employees.length > 0 ? Math.round(monthCount[i] / employees.length * 10) / 10 : 0,
    isHighSeason: monthCount[i] > avgPerMonth * 1.5,
  }));

  // Department patterns
  const departmentPatterns = [...deptAbsences].map(([department, d]) => {
    const typeCounts = new Map<string, number>();
    for (const t of d.types) typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
    const topReasons = [...typeCounts].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([reason, count]) => ({ reason, count }));

    return {
      department,
      totalAbsences: d.total,
      avgPerEmployee: d.empIds.size > 0 ? Math.round(d.total / d.empIds.size * 10) / 10 : 0,
      topReasons,
      sunThuRate: d.total > 0 ? pct(d.sunThu, d.total) : 0,
    };
  }).sort((a, b) => b.avgPerEmployee - a.avgPerEmployee);

  // Employee patterns (watchlist)
  const employeePatterns: AbsencePattern['employeePatterns'] = [];

  for (const [eid, data] of empAbsences) {
    const emp = empMap.get(eid);
    if (!emp) continue;
    const dept = deptMap.get(emp.departmentId) || emp.departmentId || 'Unknown';
    const name = [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.fullName || eid;

    let severity: 'NORMAL' | 'WATCH' | 'CONCERN' | 'CRITICAL' = 'NORMAL';
    let pattern = '';
    let details = '';

    const sunAbsences = data.days[0];
    const thuAbsences = data.days[4];
    const sickCount = data.types.filter(t => t.toUpperCase().includes('SICK')).length;

    if (data.total >= 10) {
      severity = 'CRITICAL';
      pattern = 'Excessive absences';
      details = `${data.total} absence days in the analysis period`;
    } else if (sunAbsences >= 3 || thuAbsences >= 3) {
      severity = 'CONCERN';
      pattern = `Frequent ${sunAbsences >= 3 ? 'Sunday' : 'Thursday'} absences`;
      details = `${Math.max(sunAbsences, thuAbsences)} absences on ${sunAbsences >= 3 ? 'Sundays' : 'Thursdays'} (adjacent to weekend)`;
    } else if (sickCount >= 4) {
      severity = 'CONCERN';
      pattern = 'Frequent sick leave';
      details = `${sickCount} sick leave instances in the analysis period`;
    } else if (data.total >= 5) {
      severity = 'WATCH';
      pattern = 'Above average absences';
      details = `${data.total} total absence days`;
    }

    if (severity !== 'NORMAL') {
      employeePatterns.push({ employeeId: eid, employeeName: name, department: dept, totalAbsences: data.total, pattern, severity, details });
    }
  }

  employeePatterns.sort((a, b) => {
    const sev = { CRITICAL: 0, CONCERN: 1, WATCH: 2, NORMAL: 3 };
    return sev[a.severity] - sev[b.severity] || b.totalAbsences - a.totalAbsences;
  });

  // Insights
  const insights: string[] = [];
  const highDays = dayOfWeekDistribution.filter(d => d.trend === 'HIGH');
  if (highDays.length > 0) {
    insights.push(`${highDays.map(d => d.day).join(' and ')} absences are significantly above average — consider flexible scheduling.`);
  }
  const highMonths = monthlyDistribution.filter(m => m.isHighSeason);
  if (highMonths.length > 0) {
    insights.push(`Peak absence months: ${highMonths.map(m => m.month).join(', ')} — plan coverage accordingly.`);
  }
  const highSunThu = departmentPatterns.filter(d => d.sunThuRate > 40);
  if (highSunThu.length > 0) {
    insights.push(`${highSunThu.map(d => d.department).join(', ')} — over 40% of absences are on Sun/Thu (adjacent to weekend).`);
  }
  const criticalEmps = employeePatterns.filter(e => e.severity === 'CRITICAL' || e.severity === 'CONCERN');
  if (criticalEmps.length > 0) {
    insights.push(`${criticalEmps.length} employee(s) flagged with concerning absence patterns — review recommended.`);
  }
  if (insights.length === 0) insights.push('Absence patterns are within normal ranges across all departments.');

  return {
    dayOfWeekDistribution,
    monthlyDistribution,
    departmentPatterns,
    employeePatterns: employeePatterns.slice(0, 20),
    summary: {
      totalAbsences,
      totalEmployees: employees.length,
      avgAbsencesPerEmployee: employees.length > 0 ? Math.round(totalAbsences / employees.length * 10) / 10 : 0,
      periodStart: start.toISOString().slice(0, 10),
      periodEnd: end.toISOString().slice(0, 10),
    },
    insights,
  };
}

// ─── 2. Resignation Seasonality ─────────────────────────────────────────────

export async function analyzeResignationSeasonality(tenantId: string): Promise<ResignationSeasonality> {
  const histCol = await col(tenantId, CVISION_COLLECTIONS.employeeStatusHistory);
  const empCol = await col(tenantId, CVISION_COLLECTIONS.employees);
  const retCol = await col(tenantId, CVISION_COLLECTIONS.retentionScores);
  const contractCol = await col(tenantId, CVISION_COLLECTIONS.contracts);
  const deptMap = await getDeptMap(tenantId);

  const allEmployees = await getAllEmployees(tenantId);
  const empMap = new Map<string, any>();
  for (const e of allEmployees) empMap.set(e.id, e);

  const activeEmployees = allEmployees.filter(e => !['RESIGNED', 'TERMINATED', 'END_OF_CONTRACT', 'RETIRED', 'DECEASED'].includes(e.status));
  const totalActive = activeEmployees.length || 1;

  // Fetch resignation events from status history
  const past24Months = monthsAgo(24);
  const departures = await histCol.find({
    tenantId,
    toStatus: { $in: ['RESIGNED', 'TERMINATED', 'END_OF_CONTRACT'] },
    effectiveDate: { $gte: past24Months },
  }).limit(5000).toArray();

  // Also check employees directly for cases without history
  const terminatedEmps = allEmployees.filter(e => {
    if (!['RESIGNED', 'TERMINATED', 'END_OF_CONTRACT'].includes(e.status)) return false;
    const dt = e.resignedAt || e.terminatedAt || e.updatedAt;
    return dt && new Date(dt) >= past24Months;
  });

  // Merge into unified departure list
  interface Departure { employeeId: string; date: Date; status: string; reason: string; tenureMonths: number }
  const deptList: Departure[] = [];
  const seen = new Set<string>();

  for (const d of departures) {
    const key = `${d.employeeId}-${d.toStatus}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const emp = empMap.get(d.employeeId);
    const hireDate = emp?.hiredAt ? new Date(emp.hiredAt) : null;
    const depDate = new Date(d.effectiveDate);
    const tenure = hireDate ? Math.max(0, (depDate.getTime() - hireDate.getTime()) / 2_592_000_000) : 0;

    deptList.push({
      employeeId: d.employeeId,
      date: depDate,
      status: d.toStatus,
      reason: d.reason || d.toStatus,
      tenureMonths: tenure,
    });
  }

  for (const e of terminatedEmps) {
    const key = `${e.id}-${e.status}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const dt = e.resignedAt || e.terminatedAt || e.updatedAt;
    const depDate = new Date(dt);
    const hireDate = e.hiredAt ? new Date(e.hiredAt) : null;
    const tenure = hireDate ? Math.max(0, (depDate.getTime() - hireDate.getTime()) / 2_592_000_000) : 0;

    deptList.push({
      employeeId: e.id,
      date: depDate,
      status: e.status,
      reason: e.statusReason || e.status,
      tenureMonths: tenure,
    });
  }

  // Group by month
  const byMonth = new Map<string, Departure[]>();
  for (const d of deptList) {
    const p = periodStr(d.date);
    const list = byMonth.get(p) || [];
    list.push(d);
    byMonth.set(p, list);
  }

  // Build monthly rates (last 12 months)
  const monthlyRates: ResignationSeasonality['monthlyRates'] = [];
  for (let i = 11; i >= 0; i--) {
    const d = monthsAgo(i);
    const p = periodStr(d);
    const deps = byMonth.get(p) || [];
    const reasons = new Map<string, number>();
    let totalTenure = 0;
    for (const dep of deps) {
      reasons.set(dep.reason, (reasons.get(dep.reason) || 0) + 1);
      totalTenure += dep.tenureMonths;
    }

    monthlyRates.push({
      period: p,
      month: MONTHS_EN[d.getMonth()],
      resignations: deps.length,
      turnoverRate: pct(deps.length, totalActive),
      avgTenureAtDeparture: deps.length > 0 ? Math.round(totalTenure / deps.length * 10) / 10 : 0,
      topReasons: [...reasons].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([r]) => r),
    });
  }

  // Peak seasons
  const monthTotals = new Array(12).fill(0);
  for (const d of deptList) monthTotals[d.date.getMonth()]++;
  const avgMonthly = deptList.length / 12;

  const peakSeasons: ResignationSeasonality['peakSeasons'] = [];
  const peakMonths = monthTotals.map((c, i) => ({ month: MONTHS_EN[i], count: c, idx: i }))
    .filter(m => m.count > avgMonthly * 1.3 && m.count > 0);

  if (peakMonths.some(m => m.idx === 0 || m.idx === 1)) {
    peakSeasons.push({ months: ['January', 'February'], reason: 'Post-bonus season — employees leave after receiving annual bonus' });
  }
  if (peakMonths.some(m => m.idx === 8 || m.idx === 9)) {
    peakSeasons.push({ months: ['September', 'October'], reason: 'School year start — families relocate, career resets' });
  }
  if (peakMonths.some(m => m.idx === 2 || m.idx === 3)) {
    peakSeasons.push({ months: ['March', 'April'], reason: 'Post-Ramadan — seasonal resignation pattern in Saudi Arabia' });
  }
  if (peakSeasons.length === 0) {
    peakSeasons.push({ months: [], reason: 'No clear seasonal pattern detected — resignations are evenly distributed.' });
  }

  // Predictions (based on retention risk scores)
  const retScores = await retCol.find({ tenantId }).limit(5000).toArray();
  const highRiskEmps = retScores.filter(r => r.riskLevel === 'HIGH' || r.riskLevel === 'CRITICAL');

  const predictions: ResignationSeasonality['predictions'] = [];
  const now = new Date();
  for (let i = 1; i <= 3; i++) {
    const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const p = periodStr(futureDate);
    const monthIdx = futureDate.getMonth();

    const historicalRate = monthTotals[monthIdx];
    const predicted = Math.max(0, Math.round((historicalRate / Math.max(1, deptList.length / 12) * highRiskEmps.length) / 3));
    const confidence = deptList.length >= 6 ? 65 : deptList.length >= 3 ? 45 : 25;

    const riskFactors: string[] = [];
    if (highRiskEmps.length > 0) riskFactors.push(`${highRiskEmps.length} employee(s) at HIGH/CRITICAL retention risk`);
    if (peakMonths.some(m => m.idx === monthIdx)) riskFactors.push(`${MONTHS_EN[monthIdx]} is historically a peak resignation month`);
    if (riskFactors.length === 0) riskFactors.push('No elevated risk factors detected');

    predictions.push({
      period: p,
      month: MONTHS_EN[monthIdx],
      predictedResignations: predicted,
      confidence,
      riskFactors,
    });
  }

  // Department vulnerability
  const deptDepartures = new Map<string, number>();
  for (const d of deptList) {
    const emp = empMap.get(d.employeeId);
    const dept = emp ? (deptMap.get(emp.departmentId) || emp.departmentId || 'Unknown') : 'Unknown';
    deptDepartures.set(dept, (deptDepartures.get(dept) || 0) + 1);
  }

  const deptRisk = new Map<string, number>();
  for (const r of highRiskEmps) {
    const dept = r.department || (empMap.get(r.employeeId) ? (deptMap.get(empMap.get(r.employeeId).departmentId) || 'Unknown') : 'Unknown');
    deptRisk.set(dept, (deptRisk.get(dept) || 0) + 1);
  }

  const allDepts = new Set([...deptDepartures.keys(), ...deptRisk.keys()]);
  const departmentVulnerability: ResignationSeasonality['departmentVulnerability'] = [...allDepts].map(department => {
    const left = deptDepartures.get(department) || 0;
    const hrCount = deptRisk.get(department) || 0;
    const predicted = Math.round(hrCount * 0.3);
    const score = Math.min(100, left * 15 + hrCount * 25 + predicted * 10);
    return { department, resignationsLast12Months: left, currentHighRiskCount: hrCount, predictedNext3Months: predicted, vulnerabilityScore: score };
  }).sort((a, b) => b.vulnerabilityScore - a.vulnerabilityScore);

  // Cost impact
  const contracts = await contractCol.find({ tenantId, deletedAt: { $exists: false } }).limit(5000).toArray();
  const avgSalary = contracts.length > 0
    ? contracts.reduce((s: number, c: any) => s + (c.basicSalary || 0) + (c.housingAllowance || 0), 0) / contracts.length
    : 8000;

  const replacementCost = avgSalary * REPLACEMENT_COST_MONTHS;
  const last12Cost = deptList.length * replacementCost;
  const predictedDeps = predictions.reduce((s, p) => s + p.predictedResignations, 0);
  const projected = Math.round(predictedDeps * 4 * replacementCost);

  const costByDept: { department: string; cost: number }[] = [...deptDepartures].map(([department, count]) => ({
    department,
    cost: Math.round(count * replacementCost),
  })).sort((a, b) => b.cost - a.cost);

  const costImpact: ResignationSeasonality['costImpact'] = {
    last12MonthsCost: Math.round(last12Cost),
    projected12MonthsCost: Math.round(projected),
    costByDepartment: costByDept,
    preventableSavings: Math.round(highRiskEmps.length * replacementCost * 0.6),
  };

  // Insights
  const insights: string[] = [];
  if (deptList.length > 0) {
    insights.push(`${deptList.length} departure(s) in the last 24 months — turnover cost estimated at SAR ${last12Cost.toLocaleString()}.`);
  } else {
    insights.push('No departures recorded in the last 24 months — excellent retention.');
  }
  if (peakSeasons.length > 0 && peakSeasons[0].months.length > 0) {
    insights.push(`Peak resignation months: ${peakSeasons.map(s => s.months.join('/')).join(', ')}.`);
  }
  if (highRiskEmps.length > 0) {
    insights.push(`${highRiskEmps.length} employee(s) currently at HIGH/CRITICAL retention risk — proactive retention recommended.`);
  }
  if (departmentVulnerability.length > 0 && departmentVulnerability[0].vulnerabilityScore > 50) {
    insights.push(`${departmentVulnerability[0].department} is the most vulnerable department (score ${departmentVulnerability[0].vulnerabilityScore}/100).`);
  }

  return { monthlyRates, predictions, peakSeasons, departmentVulnerability, costImpact, insights };
}

// ─── 3. Workforce Trends ───────────────────────────────────────────────────

const METRIC_META: Record<string, { label: string; unit: string }> = {
  headcount: { label: 'Headcount', unit: 'employees' },
  payroll: { label: 'Total Payroll', unit: 'SAR' },
  avgSalary: { label: 'Avg Salary', unit: 'SAR' },
  turnover: { label: 'Turnover Rate', unit: '%' },
  saudization: { label: 'Saudization', unit: '%' },
  attendance: { label: 'Attendance Rate', unit: '%' },
  performance: { label: 'Avg Performance', unit: '/5' },
  flightRisk: { label: 'Avg Flight Risk', unit: '/100' },
  newHires: { label: 'New Hires', unit: 'employees' },
  departures: { label: 'Departures', unit: 'employees' },
  openPositions: { label: 'Open Positions', unit: 'positions' },
  overtime: { label: 'Overtime Hours', unit: 'hours' },
};

export async function getWorkforceTrends(
  tenantId: string,
  metrics: string[],
  periods: number = 12
): Promise<WorkforceTrend[]> {
  const db = await getCVisionDb(tenantId);
  const snapCol = db.collection(SNAPSHOT_COL);

  const snapshots = await snapCol.find({ tenantId }).sort({ period: -1 }).limit(periods).toArray();
  const ordered = snapshots.reverse();

  return metrics.map(metric => {
    const meta = METRIC_META[metric] || { label: metric, unit: '' };

    const dataPoints = ordered.map((s: any, i: number) => {
      let value = 0;
      switch (metric) {
        case 'headcount': value = s.workforce?.activeEmployees || 0; break;
        case 'payroll': value = s.compensation?.totalPayroll || 0; break;
        case 'avgSalary': value = s.compensation?.avgSalary || 0; break;
        case 'turnover': value = s.retention?.turnoverRate || 0; break;
        case 'saudization': value = s.workforce?.saudizationRate || 0; break;
        case 'attendance': value = s.attendance?.avgAttendanceRate || 0; break;
        case 'performance': value = s.performance?.avgPerformanceScore || 0; break;
        case 'flightRisk': value = s.retention?.avgFlightRiskScore || 0; break;
        case 'newHires': value = s.workforce?.newHires || 0; break;
        case 'departures': value = s.workforce?.departures || 0; break;
        case 'openPositions': value = s.recruitment?.openPositions || 0; break;
        case 'overtime': value = s.attendance?.totalOvertimeHours || 0; break;
      }
      const prev = i > 0 ? ordered[i - 1] : null;
      let prevVal = 0;
      if (prev) {
        switch (metric) {
          case 'headcount': prevVal = prev.workforce?.activeEmployees || 0; break;
          case 'payroll': prevVal = prev.compensation?.totalPayroll || 0; break;
          case 'avgSalary': prevVal = prev.compensation?.avgSalary || 0; break;
          case 'turnover': prevVal = prev.retention?.turnoverRate || 0; break;
          default: prevVal = value; break;
        }
      }
      return { period: s.period, value, change: prev ? value - prevVal : undefined };
    });

    let trend: 'UP' | 'DOWN' | 'STABLE' = 'STABLE';
    if (dataPoints.length >= 2) {
      const first = dataPoints[0].value;
      const last = dataPoints[dataPoints.length - 1].value;
      if (last > first * 1.05) trend = 'UP';
      else if (last < first * 0.95) trend = 'DOWN';
    }

    return { metric, unit: meta.unit, dataPoints, trend };
  });
}

// ─── 4. KPIs ────────────────────────────────────────────────────────────────

export async function getCurrentKPIs(tenantId: string): Promise<KPICard[]> {
  const employees = await getAllEmployees(tenantId);
  const activeStatuses = ['ACTIVE', 'PROBATION', 'ON_ANNUAL_LEAVE', 'ON_SICK_LEAVE', 'ON_MATERNITY_LEAVE', 'ON_UNPAID_LEAVE'];
  const active = employees.filter(e => activeStatuses.includes(e.status));
  const terminated = employees.filter(e => ['RESIGNED', 'TERMINATED', 'END_OF_CONTRACT'].includes(e.status));

  const deptMap = await getDeptMap(tenantId);
  const contractCol = await col(tenantId, CVISION_COLLECTIONS.contracts);
  const contracts = await contractCol.find({ tenantId, deletedAt: { $exists: false } }).limit(5000).toArray();
  const retCol = await col(tenantId, CVISION_COLLECTIONS.retentionScores);
  const retScores = await retCol.find({ tenantId }).limit(5000).toArray();
  const reviewCol = await col(tenantId, CVISION_COLLECTIONS.performanceReviews);
  const reviews = await reviewCol.find({ tenantId, status: 'COMPLETED', deletedAt: { $exists: false } }).limit(5000).toArray();
  const leaveCol = await col(tenantId, CVISION_COLLECTIONS.leaves);
  const last30 = new Date();
  last30.setDate(last30.getDate() - 30);
  const recentLeaves = await leaveCol.find({
    tenantId,
    deletedAt: { $exists: false },
    status: { $in: ['APPROVED', 'approved'] },
    $or: [{ startDate: { $gte: last30 } }, { createdAt: { $gte: last30 } }],
  }).limit(10000).toArray();
  const reqCol = await col(tenantId, CVISION_COLLECTIONS.jobRequisitions);
  const openReqs = await reqCol.find({ tenantId, deletedAt: { $exists: false }, status: { $in: ['open', 'approved'] } }).limit(1000).toArray();

  const activeIds = new Set(active.map((e: any) => e.id));
  const activeContracts = contracts.filter((c: any) => activeIds.has(c.employeeId));

  const totalPayroll = activeContracts.reduce((s: number, c: any) => s + (c.basicSalary || 0) + (c.housingAllowance || 0) + (c.transportAllowance || 0) + (c.otherAllowances || 0), 0);
  const avgSalary = activeContracts.length > 0 ? Math.round(totalPayroll / activeContracts.length) : 0;

  const saudiCount = active.filter((e: any) => {
    const nat = (e.nationality || '').toLowerCase();
    return nat === 'saudi' || nat === 'sa';
  }).length;
  const saudization = active.length > 0 ? pct(saudiCount, active.length) : 0;

  const turnoverRate = employees.length > 0 ? pct(terminated.length, employees.length) : 0;

  const totalAbsenceDays = recentLeaves.reduce((s: number, l: any) => s + (l.days || l.totalDays || 1), 0);
  const absencePerEmp = active.length > 0 ? Math.round(totalAbsenceDays / active.length * 10) / 10 : 0;

  const highRisk = retScores.filter((r: any) => r.riskLevel === 'HIGH' || r.riskLevel === 'CRITICAL').length;

  const avgPerf = reviews.length > 0 ? Math.round(reviews.reduce((s: number, r: any) => s + (r.finalScore || 0), 0) / reviews.length * 10) / 10 : 0;

  const openPositions = openReqs.reduce((s: number, r: any) => s + (r.headcount || 1), 0);

  // Snapshot for previous period comparison
  const db = await getCVisionDb(tenantId);
  const snapC = db.collection(SNAPSHOT_COL);
  const prevSnap = await snapC.findOne({ tenantId }, { sort: { period: -1 } });

  function kpi(
    key: string, label: string, value: number,
    formatted: string, unit: string,
    prevValue: number, invertGood: boolean = false
  ): KPICard {
    const change = value - prevValue;
    const changePct = prevValue !== 0 ? Math.round((change / prevValue) * 1000) / 10 : 0;
    let status: KPICard['status'] = 'NEUTRAL';
    if (Math.abs(changePct) > 10) {
      const isPositive = invertGood ? change < 0 : change > 0;
      status = isPositive ? 'GOOD' : 'WARNING';
    }
    return { key, label, value, formatted, unit, previousValue: prevValue, change, changePercent: changePct, status };
  }

  return [
    kpi('headcount', 'Headcount', active.length, String(active.length), 'employees', prevSnap?.workforce?.activeEmployees || active.length),
    kpi('payroll', 'Total Payroll', totalPayroll, `SAR ${(totalPayroll / 1000).toFixed(1)}K`, 'SAR', prevSnap?.compensation?.totalPayroll || totalPayroll),
    kpi('turnover', 'Turnover Rate', turnoverRate, `${turnoverRate}%`, '%', prevSnap?.retention?.turnoverRate || turnoverRate, true),
    kpi('saudization', 'Saudization', saudization, `${saudization}%`, '%', prevSnap?.workforce?.saudizationRate || saudization),
    kpi('absence', 'Absence Rate', absencePerEmp, `${absencePerEmp} d/emp`, 'days', 0, true),
    kpi('avgSalary', 'Avg Salary', avgSalary, `SAR ${avgSalary.toLocaleString()}`, 'SAR', prevSnap?.compensation?.avgSalary || avgSalary),
    kpi('performance', 'Performance', avgPerf, `${avgPerf}/5`, 'score', prevSnap?.performance?.avgPerformanceScore || avgPerf),
    kpi('riskCount', 'High Risk', highRisk, String(highRisk), 'employees', prevSnap?.retention?.highRiskCount || highRisk, true),
    kpi('openPositions', 'Open Positions', openPositions, String(openPositions), 'positions', prevSnap?.recruitment?.openPositions || openPositions),
  ];
}

// ─── 5. Department Scorecard ────────────────────────────────────────────────

export async function getDepartmentScorecard(
  tenantId: string,
  departmentFilter?: string
): Promise<DepartmentScorecard[]> {
  const employees = await getAllEmployees(tenantId);
  const deptMap = await getDeptMap(tenantId);
  const contractCol = await col(tenantId, CVISION_COLLECTIONS.contracts);
  const contracts = await contractCol.find({ tenantId, deletedAt: { $exists: false } }).limit(5000).toArray();
  const retCol = await col(tenantId, CVISION_COLLECTIONS.retentionScores);
  const retScores = await retCol.find({ tenantId }).limit(5000).toArray();
  const reviewCol = await col(tenantId, CVISION_COLLECTIONS.performanceReviews);
  const reviews = await reviewCol.find({ tenantId, status: 'COMPLETED', deletedAt: { $exists: false } }).limit(5000).toArray();
  const leaveCol = await col(tenantId, CVISION_COLLECTIONS.leaves);
  const last90 = new Date();
  last90.setDate(last90.getDate() - 90);
  const recentLeaves = await leaveCol.find({
    tenantId, deletedAt: { $exists: false }, status: { $in: ['APPROVED', 'TAKEN', 'approved', 'taken'] },
    $or: [{ startDate: { $gte: last90 } }, { createdAt: { $gte: last90 } }],
  }).limit(10000).toArray();

  const activeStatuses = ['ACTIVE', 'PROBATION', 'ON_ANNUAL_LEAVE', 'ON_SICK_LEAVE', 'ON_MATERNITY_LEAVE', 'ON_UNPAID_LEAVE'];
  const termStatuses = ['RESIGNED', 'TERMINATED', 'END_OF_CONTRACT'];

  // Group by department
  const deptData = new Map<string, {
    active: any[]; terminated: any[]; salaries: number[]; riskScores: number[];
    perfScores: number[]; absenceDays: number;
  }>();

  for (const e of employees) {
    const dept = deptMap.get(e.departmentId) || e.departmentId || 'Unknown';
    if (departmentFilter && dept !== departmentFilter) continue;
    const d = deptData.get(dept) || { active: [], terminated: [], salaries: [], riskScores: [], perfScores: [], absenceDays: 0 };

    if (activeStatuses.includes(e.status)) d.active.push(e);
    if (termStatuses.includes(e.status)) d.terminated.push(e);

    const c = contracts.find((ct: any) => ct.employeeId === e.id);
    if (c) d.salaries.push((c.basicSalary || 0) + (c.housingAllowance || 0));

    const r = retScores.find((rs: any) => rs.employeeId === e.id);
    if (r) d.riskScores.push(r.flightRiskScore || 0);

    const rv = reviews.filter((rv: any) => rv.employeeId === e.id);
    for (const rev of rv) if (rev.finalScore) d.perfScores.push(rev.finalScore);

    deptData.set(dept, d);
  }

  for (const lv of recentLeaves) {
    const emp = employees.find((e: any) => e.id === lv.employeeId);
    if (!emp) continue;
    const dept = deptMap.get(emp.departmentId) || emp.departmentId || 'Unknown';
    if (departmentFilter && dept !== departmentFilter) continue;
    const d = deptData.get(dept);
    if (d) d.absenceDays += (lv.days || lv.totalDays || 1);
  }

  return [...deptData].map(([department, d]) => {
    const headcount = d.active.length;
    const totalEmps = headcount + d.terminated.length;
    const avgSalary = d.salaries.length > 0 ? Math.round(d.salaries.reduce((s, v) => s + v, 0) / d.salaries.length) : 0;
    const turnoverRate = totalEmps > 0 ? pct(d.terminated.length, totalEmps) : 0;
    const absenceRate = headcount > 0 ? Math.round(d.absenceDays / headcount * 10) / 10 : 0;
    const avgRiskScore = d.riskScores.length > 0 ? Math.round(d.riskScores.reduce((s, v) => s + v, 0) / d.riskScores.length) : 0;
    const performanceAvg = d.perfScores.length > 0 ? Math.round(d.perfScores.reduce((s, v) => s + v, 0) / d.perfScores.length * 10) / 10 : 0;

    // Composite: higher is better
    const turnoverPenalty = Math.min(40, turnoverRate);
    const riskPenalty = Math.min(30, avgRiskScore * 0.3);
    const absencePenalty = Math.min(20, absenceRate * 2);
    const perfBonus = Math.min(20, performanceAvg * 4);
    const compositeScore = Math.max(0, Math.min(100, Math.round(100 - turnoverPenalty - riskPenalty - absencePenalty + perfBonus)));

    return { department, headcount, avgSalary, turnoverRate, absenceRate, avgRiskScore, performanceAvg, compositeScore };
  }).sort((a, b) => b.compositeScore - a.compositeScore);
}

// ─── 6. Executive Summary ───────────────────────────────────────────────────

export async function generateExecutiveSummary(tenantId: string): Promise<ExecutiveSummary> {
  const kpis = await getCurrentKPIs(tenantId);
  const scorecard = await getDepartmentScorecard(tenantId);

  const now = new Date();
  const period = `${MONTHS_EN[now.getMonth()]} ${now.getFullYear()}`;

  const topConcerns: string[] = [];
  const recommendations: string[] = [];

  // Analyze KPIs for concerns
  const turnover = kpis.find(k => k.key === 'turnover');
  if (turnover && turnover.value > 10) {
    topConcerns.push(`Turnover rate at ${turnover.value}% — above healthy threshold (10%).`);
    recommendations.push('Conduct stay interviews with top performers to understand retention drivers.');
  }

  const riskKpi = kpis.find(k => k.key === 'riskCount');
  if (riskKpi && riskKpi.value > 0) {
    topConcerns.push(`${riskKpi.value} employee(s) at HIGH/CRITICAL retention risk — action needed.`);
    recommendations.push('Review compensation and career development for high-risk employees.');
  }

  // Analyze scorecard for concerns
  const weakDepts = scorecard.filter(d => d.compositeScore < 60);
  if (weakDepts.length > 0) {
    topConcerns.push(`${weakDepts.map(d => d.department).join(', ')} scoring below 60/100 — investigate workload and management.`);
    recommendations.push(`Review ${weakDepts[0].department} department: workload distribution, manager effectiveness, and team satisfaction.`);
  }

  const highAbsence = scorecard.filter(d => d.absenceRate > 3);
  if (highAbsence.length > 0) {
    topConcerns.push(`High absence rates in ${highAbsence.map(d => d.department).join(', ')} (>${highAbsence[0].absenceRate} days/employee).`);
    recommendations.push('Analyze absence patterns for underlying causes — consider flexible scheduling.');
  }

  if (topConcerns.length === 0) topConcerns.push('No critical concerns — workforce metrics are within healthy ranges.');
  if (recommendations.length === 0) recommendations.push('Continue monitoring key metrics and maintaining current retention strategies.');

  return { period, kpis, departmentScorecard: scorecard, topConcerns, recommendations };
}
