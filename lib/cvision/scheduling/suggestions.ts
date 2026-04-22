/**
 * CVision Smart Scheduling - Schedule Analysis & Suggestions
 *
 * Pure client-side utility. Analyzes schedule data and returns
 * alerts for shortages, consecutive nights, and missing rest days.
 */

import type { ScheduleSuggestion, ShiftType } from './types';

// ─── Input shape (matches page's EmployeeSchedule) ──────────────

interface ScheduleInput {
  employee: { id: string; name: string; fullName?: string; firstName?: string; lastName?: string };
  days: { date: string; shiftType: ShiftType }[];
}

interface Requirements {
  minStaffPerShift: Partial<Record<ShiftType, number>>;
  maxConsecutiveNights: number;
  maxConsecutiveDaysWithoutRest: number;
}

const DEFAULT_REQUIREMENTS: Requirements = {
  minStaffPerShift: { DAY: 2, NIGHT: 0, EVENING: 0 },
  maxConsecutiveNights: 3,            // WARNING at 4+, CRITICAL at 6+
  maxConsecutiveDaysWithoutRest: 6,   // WARNING at 7+, CRITICAL at 10+
};

// ─── Main Analysis ──────────────────────────────────────────────

export function analyzeSchedule(
  schedule: ScheduleInput[],
  requirements?: Partial<Requirements>,
): ScheduleSuggestion[] {
  const reqs: Requirements = {
    ...DEFAULT_REQUIREMENTS,
    ...requirements,
    minStaffPerShift: {
      ...DEFAULT_REQUIREMENTS.minStaffPerShift,
      ...requirements?.minStaffPerShift,
    },
  };

  const suggestions: ScheduleSuggestion[] = [];

  suggestions.push(...detectShiftShortages(schedule, reqs.minStaffPerShift));
  suggestions.push(...detectConsecutiveNights(schedule));
  suggestions.push(...detectNoRestDays(schedule, reqs.maxConsecutiveDaysWithoutRest));

  return suggestions;
}

// ─── Check 1: Shift Shortages ───────────────────────────────────

function detectShiftShortages(
  schedule: ScheduleInput[],
  minStaff: Partial<Record<ShiftType, number>>,
): ScheduleSuggestion[] {
  const suggestions: ScheduleSuggestion[] = [];

  // Build map: dateStr → shiftType → employee names[]
  const dateShiftMap = new Map<string, Map<ShiftType, string[]>>();

  for (const emp of schedule) {
    for (const day of emp.days) {
      const dateKey = new Date(day.date).toDateString();
      if (!dateShiftMap.has(dateKey)) {
        dateShiftMap.set(dateKey, new Map());
      }
      const shiftMap = dateShiftMap.get(dateKey)!;
      if (!shiftMap.has(day.shiftType)) {
        shiftMap.set(day.shiftType, []);
      }
      shiftMap.get(day.shiftType)!.push(emp.employee.fullName || [emp.employee.firstName, emp.employee.lastName].filter(Boolean).join(' ') || 'Employee');
    }
  }

  const workingShifts: ShiftType[] = ['DAY', 'EVENING', 'NIGHT'];

  for (const [dateKey, shiftMap] of dateShiftMap) {
    const date = new Date(dateKey);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Fri & Sat

    if (isWeekend) continue; // Skip weekends

    for (const shift of workingShifts) {
      const required = minStaff[shift] || 0;
      if (required <= 0) continue;

      const assigned = shiftMap.get(shift)?.length || 0;
      if (assigned >= required) continue;

      const deficit = required - assigned;
      const dateLabel = date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });

      suggestions.push({
        type: 'SHORTAGE',
        severity: assigned === 0 ? 'CRITICAL' : 'WARNING',
        message: `${shift} shift on ${dateLabel}: ${assigned}/${required} staff (need ${deficit} more)`,
        date,
        shiftType: shift,
        suggestedAction: {
          type: 'ADD_EMPLOYEE',
          toShift: shift,
        },
      });
    }
  }

  return suggestions;
}

// ─── Check 2: Consecutive Night Shifts ──────────────────────────

function detectConsecutiveNights(
  schedule: ScheduleInput[],
): ScheduleSuggestion[] {
  const suggestions: ScheduleSuggestion[] = [];

  for (const emp of schedule) {
    const sorted = [...emp.days].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    let streak = 0;
    let streakStart: string | null = null;

    for (const day of sorted) {
      if (day.shiftType === 'NIGHT') {
        if (streak === 0) streakStart = day.date;
        streak++;
      } else {
        if (streak >= 4) {
          pushNightAlert(suggestions, emp, streak, streakStart!);
        }
        streak = 0;
        streakStart = null;
      }
    }

    // Handle streak running to end of period
    if (streak >= 4) {
      pushNightAlert(suggestions, emp, streak, streakStart!);
    }
  }

  return suggestions;
}

function pushNightAlert(
  suggestions: ScheduleSuggestion[],
  emp: ScheduleInput,
  count: number,
  startDateStr: string,
): void {
  const startLabel = new Date(startDateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  suggestions.push({
    type: 'CONFLICT',
    severity: count >= 6 ? 'CRITICAL' : 'WARNING',
    message: `${(emp.employee.fullName || [emp.employee.firstName, emp.employee.lastName].filter(Boolean).join(' ') || 'Employee')} has ${count} consecutive night shifts (from ${startLabel})`,
    date: new Date(startDateStr),
    shiftType: 'NIGHT',
    affectedEmployees: [emp.employee.id],
    suggestedAction: {
      type: 'SWAP_SHIFT',
      employeeId: emp.employee.id,
      fromShift: 'NIGHT',
      toShift: 'DAY',
    },
  });
}

// ─── Check 3: No Rest Days ──────────────────────────────────────

function detectNoRestDays(
  schedule: ScheduleInput[],
  maxWithoutRest: number,
): ScheduleSuggestion[] {
  const suggestions: ScheduleSuggestion[] = [];

  for (const emp of schedule) {
    const sorted = [...emp.days].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    let workDays = 0;
    let streakStart: string | null = null;

    for (const day of sorted) {
      const isRest = day.shiftType === 'OFF' || day.shiftType === 'LEAVE';
      if (!isRest) {
        if (workDays === 0) streakStart = day.date;
        workDays++;
      } else {
        if (workDays > maxWithoutRest) {
          pushRestAlert(suggestions, emp, workDays, streakStart!);
        }
        workDays = 0;
        streakStart = null;
      }
    }

    // Handle streak running to end of period
    if (workDays > maxWithoutRest) {
      pushRestAlert(suggestions, emp, workDays, streakStart!);
    }
  }

  return suggestions;
}

function pushRestAlert(
  suggestions: ScheduleSuggestion[],
  emp: ScheduleInput,
  count: number,
  startDateStr: string,
): void {
  suggestions.push({
    type: 'CONFLICT',
    severity: count >= 10 ? 'CRITICAL' : 'WARNING',
    message: `${(emp.employee.fullName || [emp.employee.firstName, emp.employee.lastName].filter(Boolean).join(' ') || 'Employee')} has worked ${count} consecutive days without rest`,
    date: new Date(startDateStr),
    affectedEmployees: [emp.employee.id],
    suggestedAction: {
      type: 'SWAP_SHIFT',
      employeeId: emp.employee.id,
      fromShift: 'DAY',
      toShift: 'OFF',
    },
  });
}

// ─── Sort by Severity ───────────────────────────────────────────

const SEVERITY_ORDER: Record<ScheduleSuggestion['severity'], number> = {
  CRITICAL: 0,
  WARNING: 1,
  INFO: 2,
};

export function sortSuggestions(
  suggestions: ScheduleSuggestion[],
): ScheduleSuggestion[] {
  return [...suggestions].sort((a, b) => {
    const diff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (diff !== 0) return diff;
    if (a.date && b.date) return a.date.getTime() - b.date.getTime();
    return 0;
  });
}
