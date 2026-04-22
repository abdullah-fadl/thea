/**
 * Overtime & Labor Law Alerts Engine
 *
 * Detects Saudi labor law violations, overtime exceedances, rest violations,
 * and Ramadan hour overages. Alerts feed into the scheduling page and main dashboard.
 */

import type { ShiftAssignment, ShiftTemplate } from './scheduling-engine';
import { SAUDI_LABOR_RULES, DEFAULT_REST_DAYS, isRamadanPeriod, calculateOvertime, detectScheduleBurnout } from './scheduling-engine';

// ─── Alert Types ────────────────────────────────────────────────────────────

export type AlertSeverity = 'INFO' | 'WARNING' | 'VIOLATION';
export type AlertCategory =
  | 'DAILY_HOURS_EXCEEDED'
  | 'WEEKLY_HOURS_EXCEEDED'
  | 'REST_VIOLATION'
  | 'CONSECUTIVE_DAYS'
  | 'OVERTIME_DAILY'
  | 'OVERTIME_YEARLY'
  | 'RAMADAN_HOURS'
  | 'FRIDAY_WORK'
  | 'REST_DAY_WORK'
  | 'BURNOUT_RISK';

export interface ScheduleAlert {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  employeeId: string;
  employeeName: string;
  title: string;
  description: string;
  dates: string[];
  value?: number;
  limit?: number;
  createdAt: Date;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
}

function minutesBetweenShifts(
  prevEnd: string, prevDate: string, prevOvernight: boolean,
  nextStart: string, nextDate: string,
): number {
  const endDay = prevOvernight ? addDays(prevDate, 1) : prevDate;
  const endMin = parseTime(prevEnd);
  const startMin = parseTime(nextStart);
  const dayDiff = (new Date(nextDate + 'T00:00:00Z').getTime() - new Date(endDay + 'T00:00:00Z').getTime()) / 86400000;
  return dayDiff * 1440 + (startMin - endMin);
}

// ─── Core Alert Generator ───────────────────────────────────────────────────

export function generateAlerts(
  assignments: ShiftAssignment[],
  templates: ShiftTemplate[],
  yearlyOvertimeByEmployee?: Map<string, number>,
  restDays: number[] = DEFAULT_REST_DAYS,
): ScheduleAlert[] {
  const alerts: ScheduleAlert[] = [];
  const now = new Date();
  const tplMap = new Map(templates.map(t => [t.templateId || t.id, t]));
  let alertIdx = 0;

  const byEmployee = new Map<string, ShiftAssignment[]>();
  for (const a of assignments) {
    if (a.status === 'CANCELLED') continue;
    const list = byEmployee.get(a.employeeId) || [];
    list.push(a);
    byEmployee.set(a.employeeId, list);
  }

  for (const [empId, empAssigns] of byEmployee) {
    const sorted = [...empAssigns].sort((a, b) => a.date.localeCompare(b.date));
    const empName = sorted[0]?.employeeName || empId;

    // ── 1. Daily hours exceeded (>8h or >6h Ramadan) ──
    const byDate = new Map<string, number>();
    for (const a of sorted) {
      const tpl = tplMap.get(a.shiftTemplateId);
      const hours = (tpl?.workingHours || 8) + (a.overtimeHours || 0);
      byDate.set(a.date, (byDate.get(a.date) || 0) + hours);
    }
    for (const [date, hours] of byDate) {
      const ramadan = isRamadanPeriod(new Date(date));
      const maxDaily = ramadan ? SAUDI_LABOR_RULES.ramadanMaxDaily : SAUDI_LABOR_RULES.maxDailyHours;
      if (hours > maxDaily) {
        alerts.push({
          id: `alert-${++alertIdx}`,
          category: ramadan ? 'RAMADAN_HOURS' : 'DAILY_HOURS_EXCEEDED',
          severity: 'VIOLATION',
          employeeId: empId,
          employeeName: empName,
          title: ramadan ? 'Ramadan Hours Exceeded' : 'Daily Hours Exceeded',
          description: `${hours}h on ${date} exceeds ${maxDaily}h daily limit${ramadan ? ' (Ramadan)' : ''}`,
          dates: [date],
          value: hours,
          limit: maxDaily,
          createdAt: now,
        });
      }
    }

    // ── 2. Weekly hours exceeded ──
    const totalHours = [...byDate.values()].reduce((s, h) => s + h, 0);
    const anyRamadan = sorted.some(a => isRamadanPeriod(new Date(a.date)));
    const maxWeekly = anyRamadan ? SAUDI_LABOR_RULES.ramadanMaxWeekly : SAUDI_LABOR_RULES.maxWeeklyHours;
    if (totalHours > maxWeekly) {
      alerts.push({
        id: `alert-${++alertIdx}`,
        category: anyRamadan ? 'RAMADAN_HOURS' : 'WEEKLY_HOURS_EXCEEDED',
        severity: 'VIOLATION',
        employeeId: empId,
        employeeName: empName,
        title: 'Weekly Hours Exceeded',
        description: `${totalHours}h this week exceeds ${maxWeekly}h limit${anyRamadan ? ' (Ramadan)' : ''}`,
        dates: sorted.map(a => a.date),
        value: totalHours,
        limit: maxWeekly,
        createdAt: now,
      });
    }

    // ── 3. Rest violation (<12h between shifts, skip split-shift segments) ──
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      // Skip rest check between segments of the same split shift
      if (prev.splitGroupId && curr.splitGroupId && prev.splitGroupId === curr.splitGroupId) continue;
      const prevTpl = tplMap.get(prev.shiftTemplateId);
      const restMins = minutesBetweenShifts(
        prev.endTime, prev.date, prevTpl?.isOvernight || false,
        curr.startTime, curr.date,
      );
      if (restMins >= 0 && restMins < SAUDI_LABOR_RULES.minDailyRest * 60) {
        alerts.push({
          id: `alert-${++alertIdx}`,
          category: 'REST_VIOLATION',
          severity: 'VIOLATION',
          employeeId: empId,
          employeeName: empName,
          title: 'Insufficient Rest',
          description: `Only ${Math.round(restMins / 60)}h rest between ${prev.date} and ${curr.date} (min ${SAUDI_LABOR_RULES.minDailyRest}h)`,
          dates: [prev.date, curr.date],
          value: Math.round(restMins / 60),
          limit: SAUDI_LABOR_RULES.minDailyRest,
          createdAt: now,
        });
      }
    }

    // ── 4. Consecutive days without off (>6) ──
    const dates = [...new Set(sorted.map(a => a.date))].sort();
    let consec = 1;
    for (let i = 1; i < dates.length; i++) {
      if (addDays(dates[i - 1], 1) === dates[i]) {
        consec++;
        if (consec > SAUDI_LABOR_RULES.maxConsecutiveDays) {
          alerts.push({
            id: `alert-${++alertIdx}`,
            category: 'CONSECUTIVE_DAYS',
            severity: 'VIOLATION',
            employeeId: empId,
            employeeName: empName,
            title: 'Max Consecutive Days',
            description: `${consec} consecutive work days (max ${SAUDI_LABOR_RULES.maxConsecutiveDays})`,
            dates: dates.slice(i - consec + 1, i + 1),
            value: consec,
            limit: SAUDI_LABOR_RULES.maxConsecutiveDays,
            createdAt: now,
          });
          break;
        }
      } else {
        consec = 1;
      }
    }

    // ── 5. Overtime >2h/day ──
    for (const a of sorted) {
      if (a.overtimeHours && a.overtimeHours > SAUDI_LABOR_RULES.maxOvertimeDaily) {
        alerts.push({
          id: `alert-${++alertIdx}`,
          category: 'OVERTIME_DAILY',
          severity: 'WARNING',
          employeeId: empId,
          employeeName: empName,
          title: 'Daily Overtime Exceeded',
          description: `${a.overtimeHours}h overtime on ${a.date} exceeds ${SAUDI_LABOR_RULES.maxOvertimeDaily}h daily limit`,
          dates: [a.date],
          value: a.overtimeHours,
          limit: SAUDI_LABOR_RULES.maxOvertimeDaily,
          createdAt: now,
        });
      }
    }

    // ── 6. Yearly overtime approaching limit ──
    if (yearlyOvertimeByEmployee) {
      const yearlyOt = yearlyOvertimeByEmployee.get(empId) || 0;
      if (yearlyOt > SAUDI_LABOR_RULES.maxOvertimeYearly * 0.9) {
        alerts.push({
          id: `alert-${++alertIdx}`,
          category: 'OVERTIME_YEARLY',
          severity: yearlyOt >= SAUDI_LABOR_RULES.maxOvertimeYearly ? 'VIOLATION' : 'WARNING',
          employeeId: empId,
          employeeName: empName,
          title: 'Approaching Yearly Overtime Limit',
          description: `${yearlyOt}h / ${SAUDI_LABOR_RULES.maxOvertimeYearly}h yearly overtime limit`,
          dates: [],
          value: yearlyOt,
          limit: SAUDI_LABOR_RULES.maxOvertimeYearly,
          createdAt: now,
        });
      }
    }

    // ── 7. Rest day work (configurable) ──
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    for (const a of sorted) {
      const dow = new Date(a.date + 'T00:00:00Z').getUTCDay();
      if (restDays.includes(dow)) {
        alerts.push({
          id: `alert-${++alertIdx}`,
          category: 'REST_DAY_WORK',
          severity: 'WARNING',
          employeeId: empId,
          employeeName: empName,
          title: `${dayNames[dow]} Work Assigned`,
          description: `Shift on ${dayNames[dow]} ${a.date} (configured rest day)`,
          dates: [a.date],
          createdAt: now,
        });
      }
    }

    // ── 8. Burnout risk ──
    const burnout = detectScheduleBurnout(sorted, templates);
    if (burnout.atRisk) {
      alerts.push({
        id: `alert-${++alertIdx}`,
        category: 'BURNOUT_RISK',
        severity: burnout.score >= 75 ? 'VIOLATION' : 'WARNING',
        employeeId: empId,
        employeeName: empName,
        title: 'Burnout Risk Detected',
        description: `Score ${burnout.score}/100 — ${burnout.recommendation}`,
        dates: sorted.map(a => a.date),
        value: burnout.score,
        createdAt: now,
      });
    }
  }

  return alerts.sort((a, b) => {
    const sevOrder = { VIOLATION: 0, WARNING: 1, INFO: 2 };
    return (sevOrder[a.severity] ?? 2) - (sevOrder[b.severity] ?? 2);
  });
}

// ─── Department-wide report ─────────────────────────────────────────────────

export function generateOvertimeReport(
  assignments: ShiftAssignment[],
  templates: ShiftTemplate[],
  hourlyRate = 25,
): {
  employees: {
    employeeId: string;
    employeeName: string;
    regularHours: number;
    overtimeHours: number;
    overtimeCost: number;
    violations: string[];
  }[];
  totals: { regularHours: number; overtimeHours: number; overtimeCost: number };
} {
  const byEmployee = new Map<string, ShiftAssignment[]>();
  for (const a of assignments) {
    if (a.status === 'CANCELLED') continue;
    const list = byEmployee.get(a.employeeId) || [];
    list.push(a);
    byEmployee.set(a.employeeId, list);
  }

  const employees: {
    employeeId: string;
    employeeName: string;
    regularHours: number;
    overtimeHours: number;
    overtimeCost: number;
    violations: string[];
  }[] = [];

  let totalReg = 0, totalOt = 0, totalCost = 0;

  for (const [empId, empAssigns] of byEmployee) {
    const calc = calculateOvertime(empAssigns, templates, hourlyRate);
    employees.push({
      employeeId: empId,
      employeeName: empAssigns[0]?.employeeName || empId,
      ...calc,
    });
    totalReg += calc.regularHours;
    totalOt += calc.overtimeHours;
    totalCost += calc.overtimeCost;
  }

  return {
    employees: employees.sort((a, b) => b.overtimeHours - a.overtimeHours),
    totals: { regularHours: totalReg, overtimeHours: totalOt, overtimeCost: totalCost },
  };
}
