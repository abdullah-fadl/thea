/**
 * OPD Intelligence — Rules-based Recommendations Engine
 * 7 rules: add_doctor, close_clinic, schedule_optimize, noshow_prevention,
 *          revenue_opportunity, burnout_risk, capacity_warning
 *
 * Each rule consumes data from dataQueries.ts and returns 0..N typed recommendations.
 */

import {
  getDeptWeeklyStats,
  getNoShowPatterns,
  getDoctorMonthlyPerf,
  getDayOfWeekDistribution,
  getUnmetDemand,
  getMonthlyTotals,
  type DeptWeeklyStats,
  type DoctorPerf,
  type DayDistribution,
  type NoShowPattern,
  type UnmetDemand,
} from './dataQueries';

// ── Types ──

export type RecommendationType =
  | 'add_doctor'
  | 'close_clinic'
  | 'schedule_optimize'
  | 'noshow_prevention'
  | 'revenue_opportunity'
  | 'burnout_risk'
  | 'capacity_warning';

export type RecommendationSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface OPDRecommendation {
  id: string; // generated UUID
  type: RecommendationType;
  severity: RecommendationSeverity;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  actionAr: string;
  actionEn: string;
  departmentId?: string;
  departmentName?: string;
  doctorId?: string;
  doctorName?: string;
  metric: string; // machine-readable metric name
  metricValue: number;
  threshold: number;
  confidence: number; // 0-100
  createdAt: string;
  expiresAt: string;
  acknowledged?: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  dismissed?: boolean;
  dismissedAt?: string;
  dismissedBy?: string;
  dismissReason?: string;
  accuracyScore?: number; // set later by accuracy tracker
}

// ── Configuration ──

interface RuleConfig {
  utilizationCeiling: number; // 85% → capacity_warning
  utilizationFloor: number;   // 30% → close_clinic
  noShowThreshold: number;    // 15% → noshow_prevention
  burnoutPatients: number;    // 40 patients/day → burnout_risk
  burnoutAchievement: number; // 120% target → burnout_risk
  addDoctorUtil: number;      // 90% + unmet demand → add_doctor
  revenueNoShowRate: number;  // 10% → revenue calculation
  scheduleVariance: number;   // 30% day-to-day variance → schedule_optimize
}

const DEFAULT_CONFIG: RuleConfig = {
  utilizationCeiling: 85,
  utilizationFloor: 30,
  noShowThreshold: 15,
  burnoutPatients: 40,
  burnoutAchievement: 120,
  addDoctorUtil: 90,
  revenueNoShowRate: 10,
  scheduleVariance: 30,
};

// ── Helpers ──

function uuid(): string {
  return 'rec_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function expiresIn(hours: number): string {
  return new Date(Date.now() + hours * 3600000).toISOString();
}

function now(): string {
  return new Date().toISOString();
}

// ── Rule 1: ADD_DOCTOR ──
// Trigger: department utilization ≥ 90% consistently + unmet demand exists
function ruleAddDoctor(
  weeklyStats: DeptWeeklyStats[],
  unmetDemand: UnmetDemand[],
  config: RuleConfig,
): OPDRecommendation[] {
  const results: OPDRecommendation[] = [];

  // Group weeks per department, check if last 4+ weeks all above threshold
  const byDept = new Map<string, DeptWeeklyStats[]>();
  for (const s of weeklyStats) {
    if (!byDept.has(s.departmentId)) byDept.set(s.departmentId, []);
    byDept.get(s.departmentId)!.push(s);
  }

  const unmetMap = new Map<string, number>();
  for (const u of unmetDemand) unmetMap.set(u.departmentId, u.cancelledCount);

  for (const [deptId, weeks] of byDept) {
    const sorted = weeks.sort((a, b) => b.weekStart.localeCompare(a.weekStart));
    const recent = sorted.slice(0, 4);
    if (recent.length < 2) continue;

    const avgUtil = Math.round(recent.reduce((s, w) => s + w.avgUtilization, 0) / recent.length);
    const cancelled = unmetMap.get(deptId) || 0;

    if (avgUtil >= config.addDoctorUtil && cancelled > 0) {
      const confidence = Math.min(95, 60 + (avgUtil - config.addDoctorUtil) + Math.min(cancelled, 20));
      results.push({
        id: uuid(),
        type: 'add_doctor',
        severity: avgUtil >= 95 ? 'critical' : 'high',
        titleAr: `${recent[0].departmentName} يحتاج طبيب إضافي`,
        titleEn: `${recent[0].departmentName} needs additional doctor`,
        descriptionAr: `متوسط الاستخدام ${avgUtil}% خلال آخر ${recent.length} أسابيع مع ${cancelled} حجز ملغى بسبب عدم التوفر`,
        descriptionEn: `Average utilization ${avgUtil}% over last ${recent.length} weeks with ${cancelled} cancelled bookings due to unavailability`,
        actionAr: 'تعيين طبيب إضافي أو فتح عيادة مسائية',
        actionEn: 'Assign additional doctor or open evening clinic',
        departmentId: deptId,
        departmentName: recent[0].departmentName,
        metric: 'avg_utilization_with_unmet_demand',
        metricValue: avgUtil,
        threshold: config.addDoctorUtil,
        confidence,
        createdAt: now(),
        expiresAt: expiresIn(168), // 1 week
      });
    }
  }

  return results;
}

// ── Rule 2: CLOSE_CLINIC ──
// Trigger: department utilization < 30% for 3+ weeks
function ruleCloseClinic(
  weeklyStats: DeptWeeklyStats[],
  config: RuleConfig,
): OPDRecommendation[] {
  const results: OPDRecommendation[] = [];

  const byDept = new Map<string, DeptWeeklyStats[]>();
  for (const s of weeklyStats) {
    if (!byDept.has(s.departmentId)) byDept.set(s.departmentId, []);
    byDept.get(s.departmentId)!.push(s);
  }

  for (const [deptId, weeks] of byDept) {
    const sorted = weeks.sort((a, b) => b.weekStart.localeCompare(a.weekStart));
    const recent = sorted.slice(0, 4);
    if (recent.length < 3) continue;

    const lowWeeks = recent.filter((w) => w.avgUtilization > 0 && w.avgUtilization < config.utilizationFloor);
    if (lowWeeks.length >= 3) {
      const avgUtil = Math.round(lowWeeks.reduce((s, w) => s + w.avgUtilization, 0) / lowWeeks.length);
      results.push({
        id: uuid(),
        type: 'close_clinic',
        severity: 'medium',
        titleAr: `${recent[0].departmentName} — استخدام منخفض جداً`,
        titleEn: `${recent[0].departmentName} — very low utilization`,
        descriptionAr: `متوسط الاستخدام ${avgUtil}% لمدة ${lowWeeks.length} أسابيع. يمكن دمج العيادات لتوفير الموارد`,
        descriptionEn: `Average utilization ${avgUtil}% for ${lowWeeks.length} weeks. Consider merging clinics to save resources`,
        actionAr: 'دمج العيادات أو تقليل أيام العمل',
        actionEn: 'Merge clinics or reduce operating days',
        departmentId: deptId,
        departmentName: recent[0].departmentName,
        metric: 'low_utilization_weeks',
        metricValue: avgUtil,
        threshold: config.utilizationFloor,
        confidence: Math.min(90, 50 + (config.utilizationFloor - avgUtil) * 2),
        createdAt: now(),
        expiresAt: expiresIn(168),
      });
    }
  }

  return results;
}

// ── Rule 3: SCHEDULE_OPTIMIZE ──
// Trigger: high day-to-day variance in patient load (>30% coefficient of variation)
function ruleScheduleOptimize(
  dayDistribution: DayDistribution[],
  config: RuleConfig,
): OPDRecommendation[] {
  const results: OPDRecommendation[] = [];

  // Group by department
  const byDept = new Map<string, DayDistribution[]>();
  for (const d of dayDistribution) {
    if (!byDept.has(d.departmentId)) byDept.set(d.departmentId, []);
    byDept.get(d.departmentId)!.push(d);
  }

  for (const [deptId, days] of byDept) {
    const values = days.map((d) => d.avgPatients).filter((v) => v > 0);
    if (values.length < 3) continue;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (mean === 0) continue;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    const cv = Math.round((Math.sqrt(variance) / mean) * 100);

    if (cv > config.scheduleVariance) {
      const peakDay = days.reduce((max, d) => (d.avgPatients > max.avgPatients ? d : max), days[0]);
      const lowDay = days.reduce((min, d) => (d.avgPatients < min.avgPatients && d.avgPatients > 0 ? d : min), days[0]);

      results.push({
        id: uuid(),
        type: 'schedule_optimize',
        severity: cv > 50 ? 'high' : 'medium',
        titleAr: `${days[0].departmentName} — توزيع غير متوازن`,
        titleEn: `${days[0].departmentName} — unbalanced distribution`,
        descriptionAr: `تباين ${cv}% بين الأيام. الذروة: ${peakDay.dayName} (${peakDay.avgPatients} مريض)، الأدنى: ${lowDay.dayName} (${lowDay.avgPatients} مريض)`,
        descriptionEn: `${cv}% variance across days. Peak: ${peakDay.dayName} (${peakDay.avgPatients} pts), Low: ${lowDay.dayName} (${lowDay.avgPatients} pts)`,
        actionAr: `نقل بعض المواعيد من ${peakDay.dayName} إلى ${lowDay.dayName}`,
        actionEn: `Move some appointments from ${peakDay.dayName} to ${lowDay.dayName}`,
        departmentId: deptId,
        departmentName: days[0].departmentName,
        metric: 'schedule_cv_percent',
        metricValue: cv,
        threshold: config.scheduleVariance,
        confidence: Math.min(85, 50 + cv - config.scheduleVariance),
        createdAt: now(),
        expiresAt: expiresIn(168),
      });
    }
  }

  return results;
}

// ── Rule 4: NOSHOW_PREVENTION ──
// Trigger: department no-show rate > 15%
function ruleNoShowPrevention(
  noShowPatterns: NoShowPattern[],
  config: RuleConfig,
): OPDRecommendation[] {
  const results: OPDRecommendation[] = [];

  for (const p of noShowPatterns) {
    if (p.noShowRate > config.noShowThreshold && p.totalBooked >= 20) {
      const lostRevenue = p.totalNoShow * 150; // estimated SAR per visit
      results.push({
        id: uuid(),
        type: 'noshow_prevention',
        severity: p.noShowRate > 25 ? 'high' : 'medium',
        titleAr: `${p.departmentName} — نسبة عدم حضور مرتفعة ${p.noShowRate}%`,
        titleEn: `${p.departmentName} — high no-show rate ${p.noShowRate}%`,
        descriptionAr: `${p.totalNoShow} من أصل ${p.totalBooked} لم يحضروا. خسائر تقديرية: ${lostRevenue} ريال`,
        descriptionEn: `${p.totalNoShow} of ${p.totalBooked} missed. Estimated loss: ${lostRevenue} SAR`,
        actionAr: 'تفعيل تذكيرات SMS قبل 24 ساعة + تطبيق سياسة الحجز الزائد 10%',
        actionEn: 'Enable 24h SMS reminders + apply 10% overbooking policy',
        departmentId: p.departmentId,
        departmentName: p.departmentName,
        metric: 'noshow_rate_percent',
        metricValue: p.noShowRate,
        threshold: config.noShowThreshold,
        confidence: Math.min(90, 60 + Math.min(p.totalBooked, 30)),
        createdAt: now(),
        expiresAt: expiresIn(72),
      });
    }
  }

  return results;
}

// ── Rule 5: REVENUE_OPPORTUNITY ──
// Trigger: high no-shows + low utilization = opportunity to overbook or add walk-ins
function ruleRevenueOpportunity(
  weeklyStats: DeptWeeklyStats[],
  noShowPatterns: NoShowPattern[],
  config: RuleConfig,
): OPDRecommendation[] {
  const results: OPDRecommendation[] = [];

  const noShowMap = new Map<string, NoShowPattern>();
  for (const p of noShowPatterns) noShowMap.set(p.departmentId, p);

  // Get latest week per department
  const latestByDept = new Map<string, DeptWeeklyStats>();
  for (const s of weeklyStats) {
    const existing = latestByDept.get(s.departmentId);
    if (!existing || s.weekStart > existing.weekStart) latestByDept.set(s.departmentId, s);
  }

  for (const [deptId, stat] of latestByDept) {
    const ns = noShowMap.get(deptId);
    if (!ns || ns.noShowRate < config.revenueNoShowRate) continue;
    if (stat.avgUtilization >= 85) continue; // already full

    const potentialSlots = Math.round(stat.totalPatients * (ns.noShowRate / 100));
    const potentialRevenue = potentialSlots * 150;

    if (potentialSlots >= 5) {
      results.push({
        id: uuid(),
        type: 'revenue_opportunity',
        severity: 'low',
        titleAr: `${stat.departmentName} — فرصة إيرادات إضافية`,
        titleEn: `${stat.departmentName} — additional revenue opportunity`,
        descriptionAr: `يمكن استيعاب ~${potentialSlots} مريض إضافي أسبوعياً عبر الحجز الزائد. عائد تقديري: ${potentialRevenue} ريال/أسبوع`,
        descriptionEn: `Can accommodate ~${potentialSlots} additional patients weekly via overbooking. Estimated: ${potentialRevenue} SAR/week`,
        actionAr: 'تفعيل الحجز الزائد بنسبة مناسبة مع مراقبة الجودة',
        actionEn: 'Enable proportional overbooking with quality monitoring',
        departmentId: deptId,
        departmentName: stat.departmentName,
        metric: 'potential_weekly_slots',
        metricValue: potentialSlots,
        threshold: 5,
        confidence: Math.min(75, 40 + potentialSlots * 2),
        createdAt: now(),
        expiresAt: expiresIn(168),
      });
    }
  }

  return results;
}

// ── Rule 6: BURNOUT_RISK ──
// Trigger: doctor achievement > 120% or daily patients > 40
function ruleBurnoutRisk(
  doctorPerf: DoctorPerf[],
  config: RuleConfig,
): OPDRecommendation[] {
  const results: OPDRecommendation[] = [];

  // Get latest month per doctor
  const latestByDoc = new Map<string, DoctorPerf>();
  for (const p of doctorPerf) {
    const existing = latestByDoc.get(p.doctorId);
    if (!existing || p.month > existing.month) latestByDoc.set(p.doctorId, p);
  }

  for (const [docId, perf] of latestByDoc) {
    const avgDailyPatients = Math.round(perf.totalPatients / 22); // ~22 working days
    const overTarget = perf.achievement > config.burnoutAchievement;
    const highVolume = avgDailyPatients > config.burnoutPatients;

    if (overTarget || highVolume) {
      results.push({
        id: uuid(),
        type: 'burnout_risk',
        severity: overTarget && highVolume ? 'high' : 'medium',
        titleAr: `د. ${perf.doctorName} — خطر إرهاق`,
        titleEn: `Dr. ${perf.doctorName} — burnout risk`,
        descriptionAr: `تحقيق ${perf.achievement}% من الهدف، ~${avgDailyPatients} مريض/يوم. الحمل يفوق المعايير الصحية`,
        descriptionEn: `${perf.achievement}% of target, ~${avgDailyPatients} pts/day. Workload exceeds healthy standards`,
        actionAr: 'توزيع الحمل على أطباء آخرين أو تقليل المواعيد',
        actionEn: 'Redistribute load to other doctors or reduce appointments',
        doctorId: docId,
        doctorName: perf.doctorName,
        departmentId: perf.departmentId,
        metric: 'achievement_percent',
        metricValue: perf.achievement,
        threshold: config.burnoutAchievement,
        confidence: Math.min(85, 50 + Math.abs(perf.achievement - 100) / 2),
        createdAt: now(),
        expiresAt: expiresIn(72),
      });
    }
  }

  return results;
}

// ── Rule 7: CAPACITY_WARNING ──
// Trigger: utilization consistently > 85% (approaching ceiling)
function ruleCapacityWarning(
  weeklyStats: DeptWeeklyStats[],
  config: RuleConfig,
): OPDRecommendation[] {
  const results: OPDRecommendation[] = [];

  const byDept = new Map<string, DeptWeeklyStats[]>();
  for (const s of weeklyStats) {
    if (!byDept.has(s.departmentId)) byDept.set(s.departmentId, []);
    byDept.get(s.departmentId)!.push(s);
  }

  for (const [deptId, weeks] of byDept) {
    const sorted = weeks.sort((a, b) => b.weekStart.localeCompare(a.weekStart));
    const recent = sorted.slice(0, 4);
    if (recent.length < 2) continue;

    const highWeeks = recent.filter((w) => w.avgUtilization > config.utilizationCeiling);
    if (highWeeks.length >= 2) {
      const avgUtil = Math.round(recent.reduce((s, w) => s + w.avgUtilization, 0) / recent.length);
      results.push({
        id: uuid(),
        type: 'capacity_warning',
        severity: avgUtil >= 95 ? 'critical' : avgUtil >= 90 ? 'high' : 'medium',
        titleAr: `${recent[0].departmentName} — قريب من السعة القصوى`,
        titleEn: `${recent[0].departmentName} — approaching max capacity`,
        descriptionAr: `${highWeeks.length} من ${recent.length} أسابيع فوق ${config.utilizationCeiling}%. متوسط: ${avgUtil}%`,
        descriptionEn: `${highWeeks.length} of ${recent.length} weeks above ${config.utilizationCeiling}%. Average: ${avgUtil}%`,
        actionAr: 'توسيع ساعات العمل أو إضافة عيادات',
        actionEn: 'Extend operating hours or add clinics',
        departmentId: deptId,
        departmentName: recent[0].departmentName,
        metric: 'sustained_high_utilization',
        metricValue: avgUtil,
        threshold: config.utilizationCeiling,
        confidence: Math.min(90, 55 + highWeeks.length * 10),
        createdAt: now(),
        expiresAt: expiresIn(168),
      });
    }
  }

  return results;
}

// ── Main Entry Point ──

export async function generateRecommendations(
  _db: any,
  tenantId: string,
  config: Partial<RuleConfig> = {},
): Promise<OPDRecommendation[]> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Fetch all data in parallel
  const [weeklyStats, noShowPatterns, doctorPerf, dayDistribution, unmetDemand] = await Promise.all([
    getDeptWeeklyStats(_db, tenantId, 8),
    getNoShowPatterns(_db, tenantId, 3),
    getDoctorMonthlyPerf(_db, tenantId, 3),
    getDayOfWeekDistribution(_db, tenantId, 8),
    getUnmetDemand(_db, tenantId, 1),
  ]);

  // Run all 7 rules
  const recommendations: OPDRecommendation[] = [
    ...ruleAddDoctor(weeklyStats, unmetDemand, cfg),
    ...ruleCloseClinic(weeklyStats, cfg),
    ...ruleScheduleOptimize(dayDistribution, cfg),
    ...ruleNoShowPrevention(noShowPatterns, cfg),
    ...ruleRevenueOpportunity(weeklyStats, noShowPatterns, cfg),
    ...ruleBurnoutRisk(doctorPerf, cfg),
    ...ruleCapacityWarning(weeklyStats, cfg),
  ];

  // Sort by severity
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  recommendations.sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));

  return recommendations;
}
