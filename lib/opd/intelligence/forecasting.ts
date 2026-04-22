/**
 * OPD Intelligence — Demand Forecasting Engine
 * Uses weighted moving average (WMA) with seasonal adjustment
 * and staffing gap analysis.
 *
 * Forecast horizon: 1–4 weeks ahead, per department, per day-of-week.
 */

import {
  getDeptWeeklyStats,
  getDayOfWeekDistribution,
  getDeptNames,
  type DeptWeeklyStats,
  type DayDistribution,
} from './dataQueries';

// ── Types ──

export interface DailyForecast {
  departmentId: string;
  departmentName: string;
  date: string; // YYYY-MM-DD
  dayOfWeek: number;
  dayName: string;
  predictedPatients: number;
  lowerBound: number;
  upperBound: number;
  confidence: number; // 0-100
  method: 'wma' | 'seasonal' | 'fallback';
}

export interface WeeklyForecast {
  departmentId: string;
  departmentName: string;
  weekStart: string;
  predictedPatients: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  trendPercent: number;
}

export interface StaffingGap {
  departmentId: string;
  departmentName: string;
  date: string;
  dayName: string;
  predictedPatients: number;
  currentCapacity: number; // based on doctorCount * avgPatientsPerDoc
  gap: number; // positive = need more staff
  recommendation: string;
  recommendationAr: string;
}

export interface ForecastResult {
  dailyForecasts: DailyForecast[];
  weeklyForecasts: WeeklyForecast[];
  staffingGaps: StaffingGap[];
  generatedAt: string;
}

// ── Constants ──

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PATIENTS_PER_DOCTOR_DAY = 20; // default capacity assumption

// ── Weighted Moving Average ──
// More recent weeks get higher weights: [0.1, 0.15, 0.25, 0.5] for 4 weeks

function weightedMovingAverage(values: number[], weights?: number[]): number {
  if (values.length === 0) return 0;
  const w = weights || generateWeights(values.length);
  const wSum = w.reduce((a, b) => a + b, 0);
  let total = 0;
  for (let i = 0; i < values.length; i++) {
    total += values[i] * (w[i] || 0);
  }
  return Math.round(total / wSum);
}

function generateWeights(n: number): number[] {
  // Exponentially increasing weights, most recent = highest
  const weights: number[] = [];
  for (let i = 0; i < n; i++) {
    weights.push(Math.pow(1.5, i));
  }
  return weights;
}

// ── Seasonal Adjustment ──
// Adjusts WMA forecast by day-of-week factor

function getSeasonalFactor(
  dayDistribution: DayDistribution[],
  departmentId: string,
  dayOfWeek: number,
): number {
  const deptDays = dayDistribution.filter((d) => d.departmentId === departmentId);
  if (deptDays.length === 0) return 1;

  const totalAvg = deptDays.reduce((s, d) => s + d.avgPatients, 0) / deptDays.length;
  if (totalAvg === 0) return 1;

  const dayData = deptDays.find((d) => d.dayOfWeek === dayOfWeek);
  return dayData ? dayData.avgPatients / totalAvg : 1;
}

// ── Confidence Calculation ──

function calculateConfidence(values: number[], predicted: number): number {
  if (values.length < 2) return 30;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;

  // Lower CV = higher confidence
  // CV < 0.1 → 90%, CV > 0.5 → 40%
  const base = Math.max(40, Math.min(90, Math.round(90 - cv * 100)));
  // Bonus for more data points
  const dataBonus = Math.min(10, values.length);
  return Math.min(95, base + dataBonus);
}

// ── Trend Detection ──

function detectTrend(values: number[]): { direction: 'increasing' | 'decreasing' | 'stable'; percent: number } {
  if (values.length < 2) return { direction: 'stable', percent: 0 };

  // Compare first half vs second half average
  const mid = Math.floor(values.length / 2);
  const firstHalf = values.slice(0, mid);
  const secondHalf = values.slice(mid);

  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  if (avgFirst === 0) return { direction: 'stable', percent: 0 };
  const change = Math.round(((avgSecond - avgFirst) / avgFirst) * 100);

  if (change > 5) return { direction: 'increasing', percent: change };
  if (change < -5) return { direction: 'decreasing', percent: Math.abs(change) };
  return { direction: 'stable', percent: Math.abs(change) };
}

// ── Main Forecasting Function ──

export async function generateForecasts(
  _db: any,
  tenantId: string,
  weeksAhead: number = 2,
): Promise<ForecastResult> {
  // Fetch historical data
  const [weeklyStats, dayDistribution, deptNames] = await Promise.all([
    getDeptWeeklyStats(_db, tenantId, 8),
    getDayOfWeekDistribution(_db, tenantId, 8),
    getDeptNames(_db, tenantId),
  ]);

  const dailyForecasts: DailyForecast[] = [];
  const weeklyForecasts: WeeklyForecast[] = [];
  const staffingGaps: StaffingGap[] = [];

  // Group weekly stats by department
  const byDept = new Map<string, DeptWeeklyStats[]>();
  for (const s of weeklyStats) {
    if (!byDept.has(s.departmentId)) byDept.set(s.departmentId, []);
    byDept.get(s.departmentId)!.push(s);
  }

  // For each department, generate forecasts
  for (const [deptId, deptWeeks] of byDept) {
    const sorted = deptWeeks.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
    const weeklyTotals = sorted.map((w) => w.totalPatients);
    const deptName = deptNames.get(deptId) || deptId;

    // Detect trend
    const trend = detectTrend(weeklyTotals);

    // Get last known doctor count
    const lastWeek = sorted[sorted.length - 1];
    const lastDoctorCount = lastWeek?.doctorCount || 1;

    // Generate weekly forecasts
    for (let w = 1; w <= weeksAhead; w++) {
      const wmaValue = weightedMovingAverage(weeklyTotals);
      // Apply trend adjustment
      const trendMultiplier = trend.direction === 'increasing'
        ? 1 + (trend.percent / 100) * 0.3 * w
        : trend.direction === 'decreasing'
          ? 1 - (trend.percent / 100) * 0.3 * w
          : 1;
      const predicted = Math.round(wmaValue * trendMultiplier);

      const weekStartDate = new Date();
      weekStartDate.setDate(weekStartDate.getDate() + (w - 1) * 7 + (7 - weekStartDate.getDay()));
      const weekStartStr = weekStartDate.toISOString().split('T')[0];

      weeklyForecasts.push({
        departmentId: deptId,
        departmentName: deptName,
        weekStart: weekStartStr,
        predictedPatients: predicted,
        trend: trend.direction,
        trendPercent: trend.percent,
      });

      // Generate daily forecasts for each day of the week
      for (let dow = 0; dow < 7; dow++) {
        if (dow === 5) continue; // Skip Friday (weekend in Saudi Arabia)

        const seasonalFactor = getSeasonalFactor(dayDistribution, deptId, dow);
        const dailyPredicted = Math.round((predicted / 6) * seasonalFactor); // 6 working days
        const confidence = calculateConfidence(weeklyTotals, dailyPredicted);

        // Calculate bounds (±15% for high confidence, ±30% for low)
        const spreadFactor = confidence > 70 ? 0.15 : confidence > 50 ? 0.25 : 0.35;
        const lowerBound = Math.max(0, Math.round(dailyPredicted * (1 - spreadFactor)));
        const upperBound = Math.round(dailyPredicted * (1 + spreadFactor));

        const forecastDate = new Date(weekStartDate);
        forecastDate.setDate(forecastDate.getDate() + dow);
        const dateStr = forecastDate.toISOString().split('T')[0];

        dailyForecasts.push({
          departmentId: deptId,
          departmentName: deptName,
          date: dateStr,
          dayOfWeek: dow,
          dayName: DAY_NAMES[dow],
          predictedPatients: dailyPredicted,
          lowerBound,
          upperBound,
          confidence,
          method: dayDistribution.some((d) => d.departmentId === deptId) ? 'seasonal' : 'wma',
        });

        // Staffing gap analysis
        const capacity = lastDoctorCount * PATIENTS_PER_DOCTOR_DAY;
        const gap = dailyPredicted - capacity;

        if (gap > 0) {
          const extraDoctors = Math.ceil(gap / PATIENTS_PER_DOCTOR_DAY);
          staffingGaps.push({
            departmentId: deptId,
            departmentName: deptName,
            date: dateStr,
            dayName: DAY_NAMES[dow],
            predictedPatients: dailyPredicted,
            currentCapacity: capacity,
            gap,
            recommendation: `Need ${extraDoctors} additional doctor(s) — predicted ${dailyPredicted} pts vs capacity ${capacity}`,
            recommendationAr: `يحتاج ${extraDoctors} طبيب إضافي — متوقع ${dailyPredicted} مريض مقابل سعة ${capacity}`,
          });
        }
      }
    }
  }

  // Sort daily by date
  dailyForecasts.sort((a, b) => a.date.localeCompare(b.date) || a.departmentId.localeCompare(b.departmentId));
  staffingGaps.sort((a, b) => b.gap - a.gap);

  return {
    dailyForecasts,
    weeklyForecasts,
    staffingGaps: staffingGaps.slice(0, 20), // top 20 gaps
    generatedAt: new Date().toISOString(),
  };
}
