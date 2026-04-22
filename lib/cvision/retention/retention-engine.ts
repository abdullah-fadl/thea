/**
 * CVision Retention AI Engine
 *
 * Predicts employee flight risk using 7 weighted factors:
 *   1. Salary Stagnation       (20%)
 *   2. Performance Decline     (20%)
 *   3. Leave Patterns          (15%)
 *   4. Tenure Risk Window      (10%)
 *   5. Career Growth Stall     (15%)
 *   6. Disciplinary Issues     (10%)
 *   7. Workload / Burnout      (10%)
 *
 * Pure computation — all DB fetching happens in the API layer.
 * The engine receives pre-fetched data arrays and returns scored profiles.
 */

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type RiskTrend = 'INCREASING' | 'STABLE' | 'DECREASING';
export type FactorCategory =
  | 'COMPENSATION'
  | 'PERFORMANCE'
  | 'ENGAGEMENT'
  | 'WORKLOAD'
  | 'TENURE'
  | 'DISCIPLINARY'
  | 'GROWTH';
export type FactorSeverity = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
export type RecommendationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type AlertStatus = 'NEW' | 'ACKNOWLEDGED' | 'ACTION_TAKEN' | 'RESOLVED' | 'DISMISSED';
export type DepartmentTrend = 'IMPROVING' | 'STABLE' | 'WORSENING';

export interface RetentionRiskFactor {
  id: string;
  name: string;
  category: FactorCategory;
  weight: number;
  score: number;
  weightedScore: number;
  details: string;
  dataPoints: Record<string, any>;
  severity: FactorSeverity;
}

export interface RetentionRecommendation {
  id: string;
  priority: RecommendationPriority;
  action: string;
  category: string;
  estimatedImpact: string;
  estimatedCost?: number;
}

export interface RetentionRiskProfile {
  employeeId: string;
  employeeName: string;
  department: string;
  departmentId: string;
  jobTitle: string;
  hireDate: string | null;
  tenure: number;

  flightRiskScore: number;
  riskLevel: RiskLevel;
  riskTrend: RiskTrend;

  factors: RetentionRiskFactor[];
  recommendations: RetentionRecommendation[];

  alertSent: boolean;
  alertSentDate?: string;
  calculatedAt: string;
}

export interface RetentionAlert {
  tenantId: string;
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  departmentId: string;
  managerId?: string;
  managerName?: string;
  riskScore: number;
  riskLevel: string;
  topFactors: { name: string; score: number }[];
  recommendations: string[];
  status: AlertStatus;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  actionTaken?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentRetentionStats {
  department: string;
  departmentId: string;
  employeeCount: number;
  avgRiskScore: number;
  highRiskCount: number;
  criticalRiskCount: number;
  topRiskFactors: { factor: string; avgScore: number }[];
  trend: DepartmentTrend;
}

export interface OrganizationRiskSummary {
  totalEmployees: number;
  avgRiskScore: number;
  distribution: { low: number; moderate: number; high: number; critical: number };
  topRiskDepartments: { department: string; departmentId: string; avgScore: number }[];
  topRiskFactors: { factor: string; avgScore: number }[];
  estimatedTurnoverRisk: number;
  costOfTurnover: number;
}

// ---------------------------------------------------------------------------
// Input data shapes (pre-fetched by API layer)
// ---------------------------------------------------------------------------

export interface EmployeeInput {
  id: string;
  name: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  department: string;
  departmentId: string;
  jobTitle: string;
  hireDate: string | Date | null;
  basicSalary?: number;
  managerId?: string;
  managerName?: string;
}

export interface SalaryChangeRecord {
  employeeId: string;
  effectiveDate: string | Date;
  newSalary: number;
  previousSalary?: number;
}

export interface PerformanceReviewRecord {
  employeeId: string;
  cycleId: string;
  finalScore: number;
  rating: string;
  completedAt?: string | Date | null;
}

export interface LeaveRecord {
  employeeId: string;
  type?: string;
  leaveType?: string;
  startDate: string | Date;
  endDate: string | Date;
  totalDays?: number;
  days?: number;
  status: string;
}

export interface PromotionRecord {
  employeeId: string;
  effectiveDate: string | Date;
  newJobTitle?: string;
  newGrade?: string;
}

export interface DisciplinaryRecord {
  employeeId: string;
  type: string;
  severity: string;
  status: string;
  isActive: boolean;
  createdAt: string | Date;
}

export interface AttendanceRecord {
  employeeId: string;
  date: string | Date;
  status: string;
  overtimeMinutes?: number;
  lateMinutes?: number;
}

export interface HistoricalScore {
  employeeId: string;
  flightRiskScore: number;
  calculatedAt: string | Date;
}

// ---------------------------------------------------------------------------
// Factor weights (sum = 100)
// ---------------------------------------------------------------------------

const FACTOR_WEIGHTS = {
  SALARY_STAGNATION: 20,
  PERFORMANCE_DECLINE: 20,
  LEAVE_PATTERNS: 15,
  TENURE_RISK: 10,
  CAREER_GROWTH: 15,
  DISCIPLINARY: 10,
  WORKLOAD_BURNOUT: 10,
} as const;

// ---------------------------------------------------------------------------
// Core: calculate risk for one employee
// ---------------------------------------------------------------------------

export function calculateEmployeeRisk(params: {
  employee: EmployeeInput;
  salaryChanges: SalaryChangeRecord[];
  performanceReviews: PerformanceReviewRecord[];
  leaves: LeaveRecord[];
  promotions: PromotionRecord[];
  disciplinary: DisciplinaryRecord[];
  attendance: AttendanceRecord[];
  departmentSize: number;
  previousScore?: number;
}): RetentionRiskProfile {
  const {
    employee, salaryChanges, performanceReviews, leaves,
    promotions, disciplinary, attendance, departmentSize, previousScore,
  } = params;

  const now = new Date();
  const hireDate = employee.hireDate ? toDate(employee.hireDate) : null;
  const tenureMonths = hireDate ? monthsBetween(hireDate, now) : 0;

  const factors: RetentionRiskFactor[] = [
    scoreSalaryStagnation(salaryChanges, employee.basicSalary),
    scorePerformanceDecline(performanceReviews),
    scoreLeavePatterns(leaves),
    scoreTenureRisk(tenureMonths),
    scoreCareerGrowth(promotions, tenureMonths),
    scoreDisciplinary(disciplinary),
    scoreWorkloadBurnout(attendance, departmentSize),
  ];

  const flightRiskScore = Math.min(
    100,
    Math.round(factors.reduce((s, f) => s + f.weightedScore, 0)),
  );

  const riskLevel = getRiskLevel(flightRiskScore);
  const riskTrend = calculateRiskTrend(flightRiskScore, previousScore);

  const profile: RetentionRiskProfile = {
    employeeId: employee.id,
    employeeName: employee.fullName || [employee.firstName, employee.lastName].filter(Boolean).join(' ') || 'Employee',
    department: employee.department,
    departmentId: employee.departmentId,
    jobTitle: employee.jobTitle,
    hireDate: hireDate?.toISOString() ?? null,
    tenure: tenureMonths,
    flightRiskScore,
    riskLevel,
    riskTrend,
    factors,
    recommendations: [],
    alertSent: false,
    calculatedAt: now.toISOString(),
  };

  profile.recommendations = generateRecommendations(profile);

  return profile;
}

// ---------------------------------------------------------------------------
// Batch: calculate risk for ALL employees
// ---------------------------------------------------------------------------

export function calculateAllRisks(params: {
  employees: EmployeeInput[];
  salaryChanges: SalaryChangeRecord[];
  performanceReviews: PerformanceReviewRecord[];
  leaves: LeaveRecord[];
  promotions: PromotionRecord[];
  disciplinary: DisciplinaryRecord[];
  attendance: AttendanceRecord[];
  departmentSizes: Record<string, number>;
  previousScores: HistoricalScore[];
}): RetentionRiskProfile[] {
  const {
    employees, salaryChanges, performanceReviews, leaves,
    promotions, disciplinary, attendance, departmentSizes, previousScores,
  } = params;

  const group = <T extends { employeeId: string }>(arr: T[]): Record<string, T[]> => {
    const m: Record<string, T[]> = {};
    for (const item of arr) {
      (m[item.employeeId] ||= []).push(item);
    }
    return m;
  };

  const salaryByEmp = group(salaryChanges);
  const perfByEmp = group(performanceReviews);
  const leaveByEmp = group(leaves);
  const promoByEmp = group(promotions);
  const discByEmp = group(disciplinary);
  const attendByEmp = group(attendance);
  const prevScoreMap = new Map(previousScores.map(s => [s.employeeId, s.flightRiskScore]));

  return employees.map(emp =>
    calculateEmployeeRisk({
      employee: emp,
      salaryChanges: salaryByEmp[emp.id] || [],
      performanceReviews: perfByEmp[emp.id] || [],
      leaves: leaveByEmp[emp.id] || [],
      promotions: promoByEmp[emp.id] || [],
      disciplinary: discByEmp[emp.id] || [],
      attendance: attendByEmp[emp.id] || [],
      departmentSize: departmentSizes[emp.departmentId] || 5,
      previousScore: prevScoreMap.get(emp.id),
    }),
  );
}

// ---------------------------------------------------------------------------
// Risk level & trend
// ---------------------------------------------------------------------------

export function getRiskLevel(score: number): RiskLevel {
  if (score <= 25) return 'LOW';
  if (score <= 50) return 'MODERATE';
  if (score <= 75) return 'HIGH';
  return 'CRITICAL';
}

export function calculateRiskTrend(current: number, previous?: number): RiskTrend {
  if (previous == null) return 'STABLE';
  const delta = current - previous;
  if (delta >= 5) return 'INCREASING';
  if (delta <= -5) return 'DECREASING';
  return 'STABLE';
}

// ---------------------------------------------------------------------------
// Factor 1: Salary Stagnation (20%)
// ---------------------------------------------------------------------------

function scoreSalaryStagnation(
  changes: SalaryChangeRecord[],
  currentSalary?: number,
): RetentionRiskFactor {
  const now = new Date();
  const weight = FACTOR_WEIGHTS.SALARY_STAGNATION;

  const sorted = [...changes]
    .filter(c => c.newSalary > (c.previousSalary || 0))
    .sort((a, b) => toDate(b.effectiveDate).getTime() - toDate(a.effectiveDate).getTime());

  const lastIncrease = sorted[0];
  let score: number;
  let details: string;
  let monthsSince: number | null = null;

  if (!lastIncrease && !currentSalary) {
    score = 40;
    details = 'No salary data available';
  } else if (!lastIncrease) {
    score = 80;
    details = 'No salary increase on record';
  } else {
    monthsSince = monthsBetween(toDate(lastIncrease.effectiveDate), now);
    if (monthsSince >= 24) { score = 100; details = `No increase in ${monthsSince} months`; }
    else if (monthsSince >= 18) { score = 80; details = `No increase in ${monthsSince} months`; }
    else if (monthsSince >= 12) { score = 50; details = `Last increase ${monthsSince} months ago`; }
    else if (monthsSince >= 6) { score = 20; details = `Last increase ${monthsSince} months ago`; }
    else { score = 0; details = `Recent increase ${monthsSince} months ago`; }
  }

  return {
    id: 'salary_stagnation',
    name: 'Salary Stagnation',
    category: 'COMPENSATION',
    weight,
    score,
    weightedScore: r2(score * weight / 100),
    details,
    dataPoints: {
      lastIncreaseDate: lastIncrease?.effectiveDate ?? null,
      monthsSinceIncrease: monthsSince,
      currentSalary: currentSalary ?? null,
    },
    severity: toSeverity(score),
  };
}

// ---------------------------------------------------------------------------
// Factor 2: Performance Decline (20%)
// ---------------------------------------------------------------------------

const RATING_RANK: Record<string, number> = {
  EXCEPTIONAL: 5, EXCEEDS_EXPECTATIONS: 4, OUTSTANDING: 4,
  MEETS_EXPECTATIONS: 3, SATISFACTORY: 3,
  NEEDS_IMPROVEMENT: 2, BELOW_EXPECTATIONS: 2,
  UNSATISFACTORY: 1, POOR: 1,
};

function normalizeRating(rating: string): number {
  return RATING_RANK[rating?.toUpperCase().replace(/\s+/g, '_')] || 3;
}

function scorePerformanceDecline(reviews: PerformanceReviewRecord[]): RetentionRiskFactor {
  const weight = FACTOR_WEIGHTS.PERFORMANCE_DECLINE;
  const sorted = [...reviews].sort((a, b) => {
    const da = a.completedAt ? toDate(a.completedAt).getTime() : 0;
    const db = b.completedAt ? toDate(b.completedAt).getTime() : 0;
    return db - da;
  });

  let score: number;
  let details: string;
  let currentRating: string | null = null;
  let previousRating: string | null = null;
  let trend = 'unknown';

  if (sorted.length === 0) {
    score = 30;
    details = 'No performance data';
  } else if (sorted.length === 1) {
    currentRating = sorted[0].rating;
    const rank = normalizeRating(currentRating);
    score = rank <= 2 ? 80 : rank === 3 ? 30 : 0;
    details = `Single review: ${currentRating}`;
    trend = 'single';
  } else {
    currentRating = sorted[0].rating;
    previousRating = sorted[1].rating;
    const curRank = normalizeRating(currentRating);
    const prevRank = normalizeRating(previousRating);
    const delta = curRank - prevRank;

    if (delta <= -2) { score = 100; trend = 'declining'; }
    else if (delta === -1) { score = 70; trend = 'declining'; }
    else if (delta === 0 && curRank <= 2) { score = 80; trend = 'stagnant_low'; }
    else if (delta === 0 && curRank === 3) { score = 30; trend = 'stable'; }
    else { score = 0; trend = 'improving'; }

    details = `${previousRating} → ${currentRating} (${trend})`;
  }

  return {
    id: 'performance_decline',
    name: 'Performance Decline',
    category: 'PERFORMANCE',
    weight,
    score,
    weightedScore: r2(score * weight / 100),
    details,
    dataPoints: { currentRating, previousRating, trend },
    severity: toSeverity(score),
  };
}

// ---------------------------------------------------------------------------
// Factor 3: Leave Patterns / Absenteeism (15%)
// ---------------------------------------------------------------------------

function scoreLeavePatterns(leaves: LeaveRecord[]): RetentionRiskFactor {
  const weight = FACTOR_WEIGHTS.LEAVE_PATTERNS;
  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const recentLeaves = leaves.filter(l =>
    l.status?.toUpperCase() === 'APPROVED' &&
    toDate(l.startDate).getTime() >= threeMonthsAgo.getTime(),
  );

  if (leaves.length === 0) {
    return buildFactor('leave_patterns', 'Leave Patterns', 'ENGAGEMENT',
      weight, 20, 'No leave data',
      { recentLeaves: 0 });
  }

  const sickLeaves = recentLeaves.filter(l => (l.leaveType || l.type)?.toUpperCase() === 'SICK');
  const sickCount = sickLeaves.length;

  // Monday/Friday pattern (weekend-adjacent)
  let mondayFridayCount = 0;
  for (const l of recentLeaves) {
    const d = toDate(l.startDate);
    const day = d.getDay();
    if (day === 1 || day === 5) mondayFridayCount++;
  }

  let score: number;
  let details: string;

  if (sickCount >= 4) {
    score = 90;
    details = `${sickCount} sick leaves in 3 months — frequent short absences`;
  } else if (mondayFridayCount >= 3) {
    score = 80;
    details = `${mondayFridayCount} Mon/Fri absences — weekend-adjacent pattern`;
  } else if (recentLeaves.length >= 5) {
    score = 60;
    details = `${recentLeaves.length} leaves in 3 months — increasing trend`;
  } else if (recentLeaves.length >= 2) {
    score = 30;
    details = `${recentLeaves.length} leaves in 3 months — moderate`;
  } else {
    score = 0;
    details = 'Normal leave usage';
  }

  return buildFactor('leave_patterns', 'Leave Patterns', 'ENGAGEMENT',
    weight, score, details,
    { recentLeaves: recentLeaves.length, sickLeaveCount: sickCount, mondayFridayCount });
}

// ---------------------------------------------------------------------------
// Factor 4: Tenure Risk Window (10%)
// ---------------------------------------------------------------------------

function scoreTenureRisk(tenureMonths: number): RetentionRiskFactor {
  const weight = FACTOR_WEIGHTS.TENURE_RISK;
  let score: number;
  let details: string;

  if (tenureMonths >= 12 && tenureMonths < 24) {
    score = 70; details = `${tenureMonths} months — peak turnover window (1-2 years)`;
  } else if (tenureMonths >= 6 && tenureMonths < 12) {
    score = 50; details = `${tenureMonths} months — still settling in`;
  } else if (tenureMonths >= 24 && tenureMonths < 48) {
    score = 40; details = `${tenureMonths} months — moderate tenure`;
  } else if (tenureMonths < 6) {
    score = 30; details = `${tenureMonths} months — new employee`;
  } else if (tenureMonths >= 48 && tenureMonths < 84) {
    score = 20; details = `${tenureMonths} months — established tenure (4-7 years)`;
  } else {
    score = 10; details = `${tenureMonths} months — loyal long-term (7+ years)`;
  }

  return buildFactor('tenure_risk', 'Tenure Risk Window', 'TENURE',
    weight, score, details, { hireDate: null, tenureMonths });
}

// ---------------------------------------------------------------------------
// Factor 5: Career Growth Stall (15%)
// ---------------------------------------------------------------------------

function scoreCareerGrowth(
  promotions: PromotionRecord[],
  tenureMonths: number,
): RetentionRiskFactor {
  const weight = FACTOR_WEIGHTS.CAREER_GROWTH;
  const now = new Date();

  const sorted = [...promotions].sort(
    (a, b) => toDate(b.effectiveDate).getTime() - toDate(a.effectiveDate).getTime(),
  );
  const last = sorted[0];
  const monthsSincePromo = last ? monthsBetween(toDate(last.effectiveDate), now) : null;

  let score: number;
  let details: string;

  if (tenureMonths < 12) {
    score = 10;
    details = 'New employee — too early for promotion assessment';
  } else if (!last && tenureMonths >= 36) {
    score = 90;
    details = `No promotion in ${tenureMonths} months of tenure`;
  } else if (!last && tenureMonths >= 24) {
    score = 70;
    details = `No promotion in ${tenureMonths} months`;
  } else if (monthsSincePromo != null && monthsSincePromo >= 36 && tenureMonths >= 36) {
    score = 90;
    details = `Last promoted ${monthsSincePromo} months ago`;
  } else if (monthsSincePromo != null && monthsSincePromo >= 24) {
    score = 70;
    details = `Last promoted ${monthsSincePromo} months ago`;
  } else if (monthsSincePromo != null && monthsSincePromo >= 12) {
    score = 40;
    details = `Last promoted ${monthsSincePromo} months ago`;
  } else {
    score = 0;
    details = monthsSincePromo != null
      ? `Recently promoted ${monthsSincePromo} months ago`
      : 'No promotion in 12-24 months';
  }

  return buildFactor('career_growth', 'Career Growth', 'GROWTH',
    weight, score, details,
    { lastPromotionDate: last?.effectiveDate ?? null, monthsSincePromotion: monthsSincePromo, totalPromotions: promotions.length });
}

// ---------------------------------------------------------------------------
// Factor 6: Disciplinary Issues (10%)
// ---------------------------------------------------------------------------

function scoreDisciplinary(records: DisciplinaryRecord[]): RetentionRiskFactor {
  const weight = FACTOR_WEIGHTS.DISCIPLINARY;

  const active = records.filter(r => r.isActive);
  const expired = records.filter(r => !r.isActive);
  const activeCount = active.length;

  let score: number;
  let details: string;

  const hasSevere = active.some(r =>
    ['CRITICAL', 'SEVERE', 'HIGH'].includes(r.severity?.toUpperCase()),
  );

  if (activeCount >= 2 || (activeCount >= 1 && hasSevere)) {
    score = 80;
    details = `${activeCount} active warning(s), including severe/management conflict`;
  } else if (activeCount >= 2) {
    score = 60;
    details = `${activeCount} active warnings`;
  } else if (activeCount === 1) {
    score = 40;
    details = '1 active warning';
  } else if (expired.length > 0) {
    score = 20;
    details = `${expired.length} past warning(s), all expired`;
  } else {
    score = 0;
    details = 'Clean disciplinary record';
  }

  return buildFactor('disciplinary', 'Disciplinary Issues', 'DISCIPLINARY',
    weight, score, details,
    { activeWarnings: activeCount, totalWarnings: records.length, lastWarningDate: active[0]?.createdAt ?? null });
}

// ---------------------------------------------------------------------------
// Factor 7: Workload / Burnout (10%)
// ---------------------------------------------------------------------------

function scoreWorkloadBurnout(
  attendance: AttendanceRecord[],
  departmentSize: number,
): RetentionRiskFactor {
  const weight = FACTOR_WEIGHTS.WORKLOAD_BURNOUT;
  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const recentAttendance = attendance.filter(a =>
    toDate(a.date).getTime() >= threeMonthsAgo.getTime(),
  );

  if (recentAttendance.length === 0) {
    return buildFactor('workload_burnout', 'Workload / Burnout', 'WORKLOAD',
      weight, 25, 'No attendance data',
      { avgOvertimeHours: null, departmentSize });
  }

  const totalOvertimeMin = recentAttendance.reduce((s, a) => s + (a.overtimeMinutes || 0), 0);
  const monthsOfData = Math.max(1, Math.min(3, Math.ceil(recentAttendance.length / 22)));
  const avgOvertimeHoursPerMonth = r2(totalOvertimeMin / 60 / monthsOfData);

  let score: number;
  let details: string;

  if (avgOvertimeHoursPerMonth >= 20) {
    score = 90;
    details = `${avgOvertimeHoursPerMonth}h avg overtime/month for ${monthsOfData}+ months — burnout risk`;
  } else if (avgOvertimeHoursPerMonth >= 10) {
    score = 50;
    details = `${avgOvertimeHoursPerMonth}h avg overtime/month — moderate`;
  } else if (departmentSize < 3) {
    score = 60;
    details = `Small team (${departmentSize} people) — potential overload`;
  } else {
    score = 0;
    details = 'Normal workload';
  }

  return buildFactor('workload_burnout', 'Workload / Burnout', 'WORKLOAD',
    weight, score, details,
    { avgOvertimeHours: avgOvertimeHoursPerMonth, departmentSize });
}

// ---------------------------------------------------------------------------
// Recommendations generator
// ---------------------------------------------------------------------------

export function generateRecommendations(profile: RetentionRiskProfile): RetentionRecommendation[] {
  const recs: RetentionRecommendation[] = [];
  const topFactors = [...profile.factors]
    .sort((a, b) => b.weightedScore - a.weightedScore)
    .filter(f => f.score > 30);

  for (const f of topFactors.slice(0, 3)) {
    switch (f.id) {
      case 'salary_stagnation':
        recs.push({
          id: 'rec_salary_review',
          priority: f.score >= 80 ? 'URGENT' : 'HIGH',
          action: 'Conduct salary benchmarking review and consider merit increase',
          category: 'Compensation',
          estimatedImpact: '-15 risk points',
          estimatedCost: Math.round((profile.factors[0]?.dataPoints?.currentSalary || 5000) * 0.1),
        });
        break;
      case 'performance_decline':
        recs.push({
          id: 'rec_performance_meeting',
          priority: f.score >= 80 ? 'URGENT' : 'HIGH',
          action: 'Schedule 1-on-1 meeting to discuss concerns and career goals',
          category: 'Performance',
          estimatedImpact: '-10 risk points',
        });
        if (f.score >= 70) {
          recs.push({
            id: 'rec_mentorship',
            priority: 'MEDIUM',
            action: 'Assign a mentorship program and clear performance improvement plan',
            category: 'Development',
            estimatedImpact: '-8 risk points',
          });
        }
        break;
      case 'leave_patterns':
        recs.push({
          id: 'rec_wellbeing_check',
          priority: f.score >= 80 ? 'HIGH' : 'MEDIUM',
          action: 'Review workload and schedule employee wellbeing check-in',
          category: 'Engagement',
          estimatedImpact: '-8 risk points',
        });
        break;
      case 'career_growth':
        recs.push({
          id: 'rec_promotion_eval',
          priority: f.score >= 80 ? 'URGENT' : 'HIGH',
          action: 'Evaluate for promotion or lateral move to a growth role',
          category: 'Career Development',
          estimatedImpact: '-20 risk points',
        });
        break;
      case 'disciplinary':
        recs.push({
          id: 'rec_mediation',
          priority: 'HIGH',
          action: 'Investigate root cause of disciplinary issues and consider mediation',
          category: 'Disciplinary',
          estimatedImpact: '-10 risk points',
        });
        break;
      case 'workload_burnout':
        recs.push({
          id: 'rec_reduce_overtime',
          priority: f.score >= 80 ? 'URGENT' : 'HIGH',
          action: 'Reduce overtime hours and evaluate team staffing needs',
          category: 'Workload',
          estimatedImpact: '-12 risk points',
        });
        break;
      case 'tenure_risk':
        if (f.score >= 50) {
          recs.push({
            id: 'rec_engagement_program',
            priority: 'MEDIUM',
            action: 'Enroll in employee engagement and onboarding reinforcement program',
            category: 'Engagement',
            estimatedImpact: '-5 risk points',
          });
        }
        break;
    }
  }

  if (recs.length === 0 && profile.flightRiskScore > 25) {
    recs.push({
      id: 'rec_general_checkin',
      priority: 'LOW',
      action: 'Schedule regular check-in and career development discussion',
      category: 'General',
      estimatedImpact: '-5 risk points',
    });
  }

  return recs;
}

// ---------------------------------------------------------------------------
// Department stats
// ---------------------------------------------------------------------------

export function getDepartmentStats(
  profiles: RetentionRiskProfile[],
  previousProfiles?: RetentionRiskProfile[],
): DepartmentRetentionStats[] {
  const depts = new Map<string, RetentionRiskProfile[]>();
  for (const p of profiles) {
    (depts.get(p.departmentId) || (() => { const a: RetentionRiskProfile[] = []; depts.set(p.departmentId, a); return a; })()).push(p);
  }

  const prevDeptAvg = new Map<string, number>();
  if (previousProfiles) {
    const prevDepts = new Map<string, number[]>();
    for (const p of previousProfiles) {
      (prevDepts.get(p.departmentId) || (() => { const a: number[] = []; prevDepts.set(p.departmentId, a); return a; })()).push(p.flightRiskScore);
    }
    for (const [id, scores] of prevDepts) {
      prevDeptAvg.set(id, scores.reduce((s, v) => s + v, 0) / scores.length);
    }
  }

  const stats: DepartmentRetentionStats[] = [];
  for (const [deptId, emps] of depts) {
    const avgScore = r2(emps.reduce((s, e) => s + e.flightRiskScore, 0) / emps.length);
    const highCount = emps.filter(e => e.riskLevel === 'HIGH').length;
    const critCount = emps.filter(e => e.riskLevel === 'CRITICAL').length;

    const factorTotals = new Map<string, { sum: number; count: number }>();
    for (const e of emps) {
      for (const f of e.factors) {
        const entry = factorTotals.get(f.name) || { sum: 0, count: 0 };
        entry.sum += f.weightedScore;
        entry.count++;
        factorTotals.set(f.name, entry);
      }
    }
    const topFactors = [...factorTotals.entries()]
      .map(([factor, { sum, count }]) => ({ factor, avgScore: r2(sum / count) }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 3);

    let trend: DepartmentTrend = 'STABLE';
    const prev = prevDeptAvg.get(deptId);
    if (prev != null) {
      if (avgScore > prev + 3) trend = 'WORSENING';
      else if (avgScore < prev - 3) trend = 'IMPROVING';
    }

    stats.push({
      department: emps[0]?.department || deptId,
      departmentId: deptId,
      employeeCount: emps.length,
      avgRiskScore: avgScore,
      highRiskCount: highCount,
      criticalRiskCount: critCount,
      topRiskFactors: topFactors,
      trend,
    });
  }

  return stats.sort((a, b) => b.avgRiskScore - a.avgRiskScore);
}

// ---------------------------------------------------------------------------
// Organization-wide summary
// ---------------------------------------------------------------------------

export function getOrganizationRiskSummary(
  profiles: RetentionRiskProfile[],
  avgMonthlySalary: number = 8000,
): OrganizationRiskSummary {
  const n = profiles.length || 1;
  const avgScore = r2(profiles.reduce((s, p) => s + p.flightRiskScore, 0) / n);

  const distribution = { low: 0, moderate: 0, high: 0, critical: 0 };
  for (const p of profiles) {
    if (p.riskLevel === 'LOW') distribution.low++;
    else if (p.riskLevel === 'MODERATE') distribution.moderate++;
    else if (p.riskLevel === 'HIGH') distribution.high++;
    else distribution.critical++;
  }

  // Department averages
  const deptScores = new Map<string, { dept: string; deptId: string; sum: number; count: number }>();
  for (const p of profiles) {
    const e = deptScores.get(p.departmentId) || { dept: p.department, deptId: p.departmentId, sum: 0, count: 0 };
    e.sum += p.flightRiskScore;
    e.count++;
    deptScores.set(p.departmentId, e);
  }
  const topRiskDepartments = [...deptScores.values()]
    .map(d => ({ department: d.dept, departmentId: d.deptId, avgScore: r2(d.sum / d.count) }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 5);

  // Factor averages across all employees
  const factorTotals = new Map<string, { sum: number; count: number }>();
  for (const p of profiles) {
    for (const f of p.factors) {
      const e = factorTotals.get(f.name) || { sum: 0, count: 0 };
      e.sum += f.weightedScore;
      e.count++;
      factorTotals.set(f.name, e);
    }
  }
  const topRiskFactors = [...factorTotals.entries()]
    .map(([factor, { sum, count }]) => ({ factor, avgScore: r2(sum / count) }))
    .sort((a, b) => b.avgScore - a.avgScore);

  // Estimated turnover: HIGH+CRITICAL employees with probability weights
  const likelyToLeave = profiles.filter(p => p.riskLevel === 'CRITICAL').length * 0.7
    + profiles.filter(p => p.riskLevel === 'HIGH').length * 0.3
    + profiles.filter(p => p.riskLevel === 'MODERATE').length * 0.05;
  const estimatedTurnoverRisk = r2((likelyToLeave / n) * 100);

  // Cost: ~3 months salary per departure (recruitment + onboarding + lost productivity)
  const costOfTurnover = Math.round(likelyToLeave * avgMonthlySalary * 3);

  return {
    totalEmployees: profiles.length,
    avgRiskScore: avgScore,
    distribution,
    topRiskDepartments,
    topRiskFactors,
    estimatedTurnoverRisk,
    costOfTurnover,
  };
}

// ---------------------------------------------------------------------------
// Alert generation
// ---------------------------------------------------------------------------

export function buildRetentionAlerts(
  profiles: RetentionRiskProfile[],
  tenantId: string,
  existingAlertEmployeeIds: Set<string>,
): RetentionAlert[] {
  const now = new Date().toISOString();
  const alerts: RetentionAlert[] = [];

  for (const p of profiles) {
    if ((p.riskLevel === 'HIGH' || p.riskLevel === 'CRITICAL') && !existingAlertEmployeeIds.has(p.employeeId)) {
      alerts.push({
        tenantId,
        id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        employeeId: p.employeeId,
        employeeName: p.employeeName,
        department: p.department,
        departmentId: p.departmentId,
        riskScore: p.flightRiskScore,
        riskLevel: p.riskLevel,
        topFactors: p.factors
          .sort((a, b) => b.weightedScore - a.weightedScore)
          .slice(0, 3)
          .map(f => ({ name: f.name, score: f.weightedScore })),
        recommendations: p.recommendations.map(r => r.action),
        status: 'NEW',
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDate(v: string | Date): Date {
  return v instanceof Date ? v : new Date(v);
}

function monthsBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()));
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toSeverity(score: number): FactorSeverity {
  if (score <= 10) return 'NONE';
  if (score <= 40) return 'LOW';
  if (score <= 70) return 'MEDIUM';
  return 'HIGH';
}

function buildFactor(
  id: string, name: string, category: FactorCategory,
  weight: number, score: number, details: string,
  dataPoints: Record<string, any>,
): RetentionRiskFactor {
  return {
    id, name, category, weight, score,
    weightedScore: r2(score * weight / 100),
    details, dataPoints,
    severity: toSeverity(score),
  };
}
