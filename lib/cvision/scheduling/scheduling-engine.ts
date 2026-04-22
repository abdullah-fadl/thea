/**
 * Smart Scheduling Engine — Saudi Labor Law Compliant
 *
 * Auto-generates weekly schedules, validates against labor regulations,
 * calculates overtime, detects burnout, and supports shift swaps.
 *
 * Works alongside the existing scheduling API at /api/cvision/schedules.
 * Reads from cvision_employees, cvision_shift_templates, cvision_shift_assignments,
 * cvision_employee_shift_preferences. Writes to cvision_shift_assignments.
 */

import { v4 as uuidv4 } from 'uuid';
import { getCVisionDb } from '@/lib/cvision/db';
import { getWorkSchedule, type WorkScheduleSettings } from '@/lib/cvision/admin-settings';
import type { ShiftType } from './types';

// ─── Saudi Labor Law Constants ──────────────────────────────────────────────

export const SAUDI_LABOR_RULES = {
  maxDailyHours: 8,
  maxWeeklyHours: 48,
  ramadanMaxDaily: 6,
  ramadanMaxWeekly: 36,
  minDailyRest: 12,
  maxConsecutiveDays: 6,
  /** @deprecated Use tenant work-schedule settings instead */
  weeklyRestDay: 5 as number,
  overtimeRate: 1.5,
  maxOvertimeDaily: 2,
  maxOvertimeYearly: 720,
  minBreakAfter5Hours: 30,
} as const;

/** Default rest days when no tenant settings exist */
export const DEFAULT_REST_DAYS = [5, 6]; // Friday, Saturday

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ShiftTemplate {
  id: string;
  tenantId: string;
  templateId: string;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  breakDuration: number;
  workingHours: number;
  color: string;
  isOvernight: boolean;
  department?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type AssignmentStatus = 'SCHEDULED' | 'CONFIRMED' | 'SWAPPED' | 'CANCELLED' | 'COMPLETED';

export interface ShiftAssignment {
  id: string;
  tenantId: string;
  employeeId: string;
  employeeName: string;
  department: string;
  date: string;
  shiftTemplateId: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  status: AssignmentStatus;
  isOvertime: boolean;
  overtimeHours?: number;
  notes?: string;
  assignedBy: string;
  splitGroupId?: string;        // Links segments of a split shift
  splitSegmentIndex?: number;   // 0, 1, etc.
  isSplitShift?: boolean;       // Convenience flag
  createdAt: Date;
  updatedAt: Date;
}

export interface EmployeePreference {
  id: string;
  tenantId: string;
  employeeId: string;
  preferredShifts: string[];
  unavailableDays: number[];
  maxOvertimeHours: number;
  preferNightShift: boolean;
  medicalRestrictions?: string;
  notes?: string;
  updatedAt: Date;
}

export interface ScheduleConflict {
  type: 'DOUBLE_BOOKED' | 'EXCEEDS_HOURS' | 'REST_VIOLATION' | 'PREFERENCE_VIOLATION' | 'OVERTIME_LIMIT' | 'CONSECUTIVE_DAYS' | 'FRIDAY_VIOLATION' | 'REST_DAY_VIOLATION';
  employeeId: string;
  employeeName: string;
  description: string;
  severity: 'WARNING' | 'VIOLATION';
  dates: string[];
}

export interface ScheduleWeek {
  weekStart: string;
  weekEnd: string;
  department?: string;
  assignments: ShiftAssignment[];
  stats: {
    totalShifts: number;
    totalEmployees: number;
    totalHours: number;
    overtimeHours: number;
    unfilledShifts: number;
    conflicts: ScheduleConflict[];
  };
}

export interface BurnoutCheck {
  atRisk: boolean;
  score: number;
  reasons: string[];
  recommendation: string;
}

export interface OvertimeCalculation {
  regularHours: number;
  overtimeHours: number;
  overtimeCost: number;
  violations: string[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function shiftDurationMinutes(start: string, end: string, isOvernight: boolean): number {
  const s = parseTime(start);
  const e = parseTime(end);
  return isOvernight ? (1440 - s + e) : (e - s);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
}

function dayOfWeek(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00Z').getUTCDay();
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

export function isRamadanPeriod(date: Date): boolean {
  const y = date.getFullYear();
  // Approximate Ramadan dates (Hijri shifts ~11 days earlier each Gregorian year)
  const ramadanRanges: Record<number, [string, string]> = {
    2025: ['2025-03-01', '2025-03-30'],
    2026: ['2026-02-18', '2026-03-19'],
    2027: ['2027-02-08', '2027-03-09'],
    2028: ['2028-01-28', '2028-02-26'],
  };
  const range = ramadanRanges[y];
  if (!range) return false;
  const d = date.toISOString().split('T')[0];
  return d >= range[0] && d <= range[1];
}

// ─── Tenant Work-Schedule helper ─────────────────────────────────────────────

export async function getTenantRestDays(tenantId: string): Promise<number[]> {
  const db = await getCVisionDb(tenantId);
  const ws = await getWorkSchedule(db, tenantId);
  return ws.restDays;
}

// ─── Collection helpers ─────────────────────────────────────────────────────

async function templatesCol(tenantId: string) {
  const db = await getCVisionDb(tenantId);
  return db.collection('cvision_shift_templates');
}

async function assignmentsCol(tenantId: string) {
  const db = await getCVisionDb(tenantId);
  return db.collection('cvision_shift_assignments');
}

async function prefsCol(tenantId: string) {
  const db = await getCVisionDb(tenantId);
  return db.collection('cvision_employee_shift_preferences');
}

// ─── Shift Template CRUD ────────────────────────────────────────────────────

export const DEFAULT_TEMPLATES: Omit<ShiftTemplate, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>[] = [
  { templateId: 'TPL-MORN', name: 'Morning', code: 'MORN', startTime: '07:00', endTime: '15:00', breakDuration: 60, workingHours: 7, color: '#FCD34D', isOvernight: false, isActive: true },
  { templateId: 'TPL-AFTN', name: 'Afternoon', code: 'AFTN', startTime: '15:00', endTime: '23:00', breakDuration: 60, workingHours: 7, color: '#60A5FA', isOvernight: false, isActive: true },
  { templateId: 'TPL-NGHT', name: 'Night', code: 'NGHT', startTime: '23:00', endTime: '07:00', breakDuration: 60, workingHours: 7, color: '#818CF8', isOvernight: true, isActive: true },
  { templateId: 'TPL-DAY', name: 'Day Shift', code: 'DAY', startTime: '08:00', endTime: '17:00', breakDuration: 60, workingHours: 8, color: '#34D399', isOvernight: false, isActive: true },
  { templateId: 'TPL-HALF', name: 'Half Day', code: 'HALF', startTime: '08:00', endTime: '12:00', breakDuration: 0, workingHours: 4, color: '#A78BFA', isOvernight: false, isActive: true },
];

/**
 * Hydrate a raw PG row back into a full ShiftTemplate.
 * Extra fields (templateId, code, startTime, etc.) are packed into the
 * `pattern` JSONB column during insert and unpacked here on read.
 */
function hydrateTemplate(row: any): ShiftTemplate {
  const p = (typeof row.pattern === 'string' ? JSON.parse(row.pattern) : row.pattern) || {};
  return {
    ...row,
    templateId: row.templateId || p.templateId || row.id,
    code: row.code || p.code || '',
    startTime: row.startTime || p.startTime || '08:00',
    endTime: row.endTime || p.endTime || '17:00',
    breakDuration: row.breakDuration ?? p.breakDuration ?? 60,
    workingHours: row.workingHours ?? p.workingHours ?? 8,
    color: row.color || p.color || '#60A5FA',
    isOvernight: row.isOvernight ?? p.isOvernight ?? false,
    department: row.department || p.department,
  };
}

/**
 * Pack extra ShiftTemplate fields into the `pattern` JSONB column so they
 * survive the PG shim's stripUnknownColumns step.
 */
function packTemplateForPG(record: Record<string, any>): Record<string, any> {
  const doc = { ...record };
  doc.pattern = {
    templateId: doc.templateId,
    code: doc.code,
    startTime: doc.startTime,
    endTime: doc.endTime,
    breakDuration: doc.breakDuration,
    workingHours: doc.workingHours,
    color: doc.color,
    isOvernight: doc.isOvernight,
    department: doc.department,
  };
  return doc;
}

export async function listTemplates(tenantId: string): Promise<ShiftTemplate[]> {
  const col = await templatesCol(tenantId);
  const rows = await col.find({ tenantId, isActive: { $ne: false } }).sort({ name: 1 }).toArray();
  return rows.map(hydrateTemplate);
}

export async function createTemplate(tenantId: string, data: Partial<ShiftTemplate>): Promise<ShiftTemplate> {
  const col = await templatesCol(tenantId);
  const now = new Date();
  const record: ShiftTemplate = {
    id: uuidv4(),
    tenantId,
    templateId: data.templateId || `TPL-${(data.code || 'X').toUpperCase()}`,
    name: data.name || '',
    code: data.code || '',
    startTime: data.startTime || '08:00',
    endTime: data.endTime || '17:00',
    breakDuration: data.breakDuration ?? 60,
    workingHours: data.workingHours ?? 8,
    color: data.color || '#60A5FA',
    isOvernight: data.isOvernight ?? false,
    department: data.department,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  await col.insertOne(packTemplateForPG(record) as Record<string, unknown>);
  return record;
}

export async function seedDefaultTemplates(tenantId: string): Promise<number> {
  const col = await templatesCol(tenantId);
  const existing = await col.countDocuments({ tenantId });
  if (existing > 0) return 0;
  const now = new Date();
  const docs = DEFAULT_TEMPLATES.map(t => {
    const doc = { ...t, id: uuidv4(), tenantId, createdAt: now, updatedAt: now };
    return packTemplateForPG(doc);
  });
  await col.insertMany(docs as Record<string, unknown>[]);
  return docs.length;
}

// ─── Preference CRUD ────────────────────────────────────────────────────────

export async function getPreference(tenantId: string, employeeId: string): Promise<EmployeePreference | null> {
  const col = await prefsCol(tenantId);
  return col.findOne({ tenantId, employeeId }) as unknown as EmployeePreference | null;
}

export async function savePreference(tenantId: string, employeeId: string, data: Partial<EmployeePreference>): Promise<EmployeePreference> {
  const col = await prefsCol(tenantId);
  const now = new Date();
  const $set: Record<string, unknown> = { ...data, tenantId, employeeId, updatedAt: now };
  delete $set.id;
  await col.updateOne(
    { tenantId, employeeId } as Record<string, unknown>,
    { $set, $setOnInsert: { id: uuidv4() } },
    { upsert: true },
  );
  return col.findOne({ tenantId, employeeId }) as unknown as EmployeePreference;
}

// ─── Schedule Validation ────────────────────────────────────────────────────

export function validateSchedule(assignments: ShiftAssignment[], templates: ShiftTemplate[], restDays: number[] = DEFAULT_REST_DAYS): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const tplMap = new Map(templates.map(t => [t.templateId || t.id, t]));
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
    const ramadan = sorted.length > 0 ? isRamadanPeriod(new Date(sorted[0].date)) : false;
    const maxWeekly = ramadan ? SAUDI_LABOR_RULES.ramadanMaxWeekly : SAUDI_LABOR_RULES.maxWeeklyHours;

    // 1. Double booking (split-shift aware)
    const dateEntries = new Map<string, ShiftAssignment[]>();
    for (const a of sorted) {
      const list = dateEntries.get(a.date) || [];
      list.push(a);
      dateEntries.set(a.date, list);
    }
    for (const [date, entries] of dateEntries) {
      if (entries.length <= 1) continue;
      // Group by splitGroupId — entries sharing a splitGroupId count as ONE booking
      const withoutGroup = entries.filter(e => !e.splitGroupId);
      const groups = new Set(entries.filter(e => e.splitGroupId).map(e => e.splitGroupId));
      const bookings = withoutGroup.length + groups.size;
      if (bookings > 1) {
        conflicts.push({
          type: 'DOUBLE_BOOKED', employeeId: empId, employeeName: empName,
          description: `Double-booked on ${date}`,
          severity: 'VIOLATION', dates: [date],
        });
      }
    }

    // 2. Weekly hours
    let totalHours = 0;
    for (const a of sorted) {
      const tpl = tplMap.get(a.shiftTemplateId);
      totalHours += tpl?.workingHours || 8;
    }
    if (totalHours > maxWeekly) {
      conflicts.push({
        type: 'EXCEEDS_HOURS', employeeId: empId, employeeName: empName,
        description: `${totalHours}h exceeds ${maxWeekly}h weekly limit${ramadan ? ' (Ramadan)' : ''}`,
        severity: 'VIOLATION', dates: sorted.map(a => a.date),
      });
    }

    // 3. Rest between shifts (skip between split-shift segments of same group)
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      // Skip rest check between segments of the same split shift
      if (prev.splitGroupId && curr.splitGroupId && prev.splitGroupId === curr.splitGroupId) {
        continue;
      }
      const prevTpl = tplMap.get(prev.shiftTemplateId);
      const restMins = minutesBetweenShifts(
        prev.endTime, prev.date, prevTpl?.isOvernight || false,
        curr.startTime, curr.date,
      );
      if (restMins < SAUDI_LABOR_RULES.minDailyRest * 60 && restMins >= 0) {
        conflicts.push({
          type: 'REST_VIOLATION', employeeId: empId, employeeName: empName,
          description: `Only ${Math.round(restMins / 60)}h rest between ${prev.date} and ${curr.date} (min ${SAUDI_LABOR_RULES.minDailyRest}h)`,
          severity: 'VIOLATION', dates: [prev.date, curr.date],
        });
      }
    }

    // 4. Consecutive days
    const dates = [...new Set(sorted.map(a => a.date))].sort();
    let consecutive = 1;
    for (let i = 1; i < dates.length; i++) {
      if (addDays(dates[i - 1], 1) === dates[i]) {
        consecutive++;
        if (consecutive > SAUDI_LABOR_RULES.maxConsecutiveDays) {
          conflicts.push({
            type: 'CONSECUTIVE_DAYS', employeeId: empId, employeeName: empName,
            description: `${consecutive} consecutive work days (max ${SAUDI_LABOR_RULES.maxConsecutiveDays})`,
            severity: 'VIOLATION', dates: dates.slice(i - consecutive + 1, i + 1),
          });
        }
      } else {
        consecutive = 1;
      }
    }

    // 5. Rest day check (configurable — no longer hardcoded to Friday)
    // Saudi Labor Law Article 104: minimum one full weekly rest day of 24 hours.
    // Assigning work on a configured rest day is a VIOLATION, not merely a warning.
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    for (const a of sorted) {
      const dow = dayOfWeek(a.date);
      if (restDays.includes(dow)) {
        conflicts.push({
          type: 'REST_DAY_VIOLATION', employeeId: empId, employeeName: empName,
          description: `Assigned on ${dayNames[dow]} (configured rest day) — violates Saudi Labor Law Article 104`,
          severity: 'VIOLATION', dates: [a.date],
        });
      }
    }

    // 6. Split-shift validation: gap between segments and total daily hours
    // Saudi Labor Law: max 8 h/day (extendable to 10 h with ministry approval).
    // Each gap between consecutive segments of the same split shift must be at least 1 hour.
    const MAX_SPLIT_DAILY_HOURS = 10; // absolute ceiling (ministry-approved maximum)
    const MIN_SPLIT_GAP_MINUTES = 60; // 1 hour minimum gap between segments

    const splitGroups = new Map<string, ShiftAssignment[]>();
    for (const a of sorted) {
      if (!a.splitGroupId) continue;
      const list = splitGroups.get(a.splitGroupId) || [];
      list.push(a);
      splitGroups.set(a.splitGroupId, list);
    }

    for (const [splitGroupId, segments] of splitGroups) {
      // Sort segments by start time within the same day
      const segs = [...segments].sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));

      // Check minimum gap between consecutive segments
      for (let i = 1; i < segs.length; i++) {
        const prev = segs[i - 1];
        const curr = segs[i];
        const gapMinutes = parseTime(curr.startTime) - parseTime(prev.endTime);
        if (gapMinutes < MIN_SPLIT_GAP_MINUTES) {
          conflicts.push({
            type: 'REST_VIOLATION', employeeId: empId, employeeName: empName,
            description: `Split shift gap of ${gapMinutes} min on ${curr.date} is below the 1-hour minimum (split group ${splitGroupId})`,
            severity: 'VIOLATION', dates: [curr.date],
          });
        }
      }

      // Check total working hours across all segments on the same date
      const dates = new Set(segs.map(s => s.date));
      for (const date of dates) {
        const daySegs = segs.filter(s => s.date === date);
        const totalMins = daySegs.reduce((sum, s) => {
          const tpl = tplMap.get(s.shiftTemplateId);
          return sum + shiftDurationMinutes(s.startTime, s.endTime, tpl?.isOvernight || false);
        }, 0);
        const totalHoursDay = totalMins / 60;
        if (totalHoursDay > MAX_SPLIT_DAILY_HOURS) {
          conflicts.push({
            type: 'EXCEEDS_HOURS', employeeId: empId, employeeName: empName,
            description: `Split shift total of ${totalHoursDay.toFixed(1)}h on ${date} exceeds ${MAX_SPLIT_DAILY_HOURS}h daily maximum`,
            severity: 'VIOLATION', dates: [date],
          });
        }
      }
    }
  }

  return conflicts;
}

// ─── Check single assignment ────────────────────────────────────────────────

export function checkShiftAssignment(
  existingAssignments: ShiftAssignment[],
  newDate: string,
  newStart: string,
  newEnd: string,
  templates: ShiftTemplate[],
  restDays: number[] = DEFAULT_REST_DAYS,
  options?: { isSplitShift?: boolean; splitGroupId?: string },
): { allowed: boolean; violations: string[] } {
  const violations: string[] = [];
  const active = existingAssignments.filter(a => a.status !== 'CANCELLED');

  // Double booking (split-shift aware)
  const sameDateAssignments = active.filter(a => a.date === newDate);
  if (sameDateAssignments.length > 0) {
    if (options?.isSplitShift && options?.splitGroupId) {
      // For split shifts, only flag if there's an entry with a different or no splitGroupId
      const nonGroupEntries = sameDateAssignments.filter(a => !a.splitGroupId || a.splitGroupId !== options.splitGroupId);
      if (nonGroupEntries.length > 0) {
        violations.push('Employee already has a different shift on this date');
      }
    } else {
      // Check if all existing entries on that date belong to a split shift
      const allAreSplitSegments = sameDateAssignments.every(a => a.isSplitShift || a.splitGroupId);
      if (!allAreSplitSegments) {
        violations.push('Employee already has a shift on this date');
      }
    }
  }

  // Rest check against previous day (skip if split-shift segments of same group)
  const prevDay = active.filter(a => a.date === addDays(newDate, -1));
  for (const prev of prevDay) {
    if (options?.splitGroupId && prev.splitGroupId === options.splitGroupId) continue;
    const tpl = templates.find(t => t.templateId === prev.shiftTemplateId || t.id === prev.shiftTemplateId);
    const rest = minutesBetweenShifts(prev.endTime, prev.date, tpl?.isOvernight || false, newStart, newDate);
    if (rest >= 0 && rest < SAUDI_LABOR_RULES.minDailyRest * 60) {
      violations.push(`Less than ${SAUDI_LABOR_RULES.minDailyRest}h rest from previous shift`);
    }
  }

  // Consecutive days
  const dates = new Set(active.map(a => a.date));
  dates.add(newDate);
  const sorted = [...dates].sort();
  let consecutive = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (addDays(sorted[i - 1], 1) === sorted[i]) consecutive++;
    else consecutive = 1;
  }
  if (consecutive > SAUDI_LABOR_RULES.maxConsecutiveDays) {
    violations.push(`Would exceed ${SAUDI_LABOR_RULES.maxConsecutiveDays} consecutive work days`);
  }

  // Rest day check (configurable) — Saudi Labor Law Article 104: VIOLATION, not a warning
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dow = dayOfWeek(newDate);
  if (restDays.includes(dow)) {
    violations.push(`${dayNames[dow]} is a configured rest day — violates Saudi Labor Law Article 104 (weekly rest requirement)`);
  }

  // Split-shift: validate gap and total daily hours when adding a new segment
  if (options?.isSplitShift && options?.splitGroupId) {
    const MAX_SPLIT_DAILY_HOURS = 10;   // Saudi law max (ministry-approved)
    const MIN_SPLIT_GAP_MINUTES = 60;   // 1-hour minimum gap between segments

    const sameDaySameGroup = active.filter(
      a => a.date === newDate && a.splitGroupId === options.splitGroupId,
    );

    // Check gap between new segment and every existing segment of the same group
    for (const seg of sameDaySameGroup) {
      const newStartMin = parseTime(newStart);
      const segEndMin = parseTime(seg.endTime);
      const segStartMin = parseTime(seg.startTime);
      const newEndMin = parseTime(newEnd);

      // Gap after existing segment ends before new one starts
      if (segEndMin <= newStartMin) {
        const gap = newStartMin - segEndMin;
        if (gap < MIN_SPLIT_GAP_MINUTES) {
          violations.push(`Split shift gap of ${gap} min is below the 1-hour minimum between segments`);
        }
      }
      // Gap after new segment ends before existing one starts
      if (newEndMin <= segStartMin) {
        const gap = segStartMin - newEndMin;
        if (gap < MIN_SPLIT_GAP_MINUTES) {
          violations.push(`Split shift gap of ${gap} min is below the 1-hour minimum between segments`);
        }
      }
    }

    // Check total hours: existing segments + new segment
    const newDurMins = parseTime(newEnd) - parseTime(newStart);
    const existingMins = sameDaySameGroup.reduce((sum, seg) => {
      return sum + (parseTime(seg.endTime) - parseTime(seg.startTime));
    }, 0);
    const totalHoursDay = (existingMins + newDurMins) / 60;
    if (totalHoursDay > MAX_SPLIT_DAILY_HOURS) {
      violations.push(`Split shift total of ${totalHoursDay.toFixed(1)}h would exceed the ${MAX_SPLIT_DAILY_HOURS}h daily maximum`);
    }
  }

  return { allowed: violations.length === 0, violations };
}

// ─── Auto-generate schedule ─────────────────────────────────────────────────

export async function autoGenerateSchedule(params: {
  tenantId: string;
  department: string;
  weekStart: string;
  shiftRequirements: { shiftTemplateId: string; minEmployees: number; days: number[] }[];
  userId: string;
  restDays?: number[];
}): Promise<{
  schedule: ShiftAssignment[];
  conflicts: ScheduleConflict[];
  unfilled: { date: string; shift: string; needed: number }[];
}> {
  const { tenantId, department, weekStart, shiftRequirements, userId, restDays: restDaysParam } = params;
  const db = await getCVisionDb(tenantId);
  const tenantRestDays = restDaysParam ?? (await getWorkSchedule(db, tenantId)).restDays;

  const employees = await db.collection('cvision_employees')
    .find({ tenantId, departmentId: department, status: { $in: ['ACTIVE', 'active'] }, deletedAt: null })
    .project({ id: 1, fullName: 1, firstName: 1, lastName: 1, departmentId: 1 })
    .toArray();

  if (employees.length === 0) return { schedule: [], conflicts: [], unfilled: [] };

  const templates = await listTemplates(tenantId);
  const tplMap = new Map(templates.map(t => [t.templateId || t.id, t]));

  // Load preferences
  const prefCol = await prefsCol(tenantId);
  const allPrefs = await prefCol.find({ tenantId, employeeId: { $in: employees.map((e: Record<string, unknown>) => e.id) } }).toArray() as unknown as EmployeePreference[];
  const prefMap = new Map(allPrefs.map(p => [p.employeeId, p]));

  const schedule: ShiftAssignment[] = [];
  const unfilled: { date: string; shift: string; needed: number }[] = [];
  const now = new Date();

  // Track assignments per employee for fairness and constraints
  const empTracker = new Map<string, { dates: Set<string>; hours: number; lastEndTime?: string; lastDate?: string; lastOvernight?: boolean }>();
  for (const emp of employees) {
    empTracker.set(emp.id, { dates: new Set(), hours: 0 });
  }

  // Generate 7 days starting from weekStart
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const dateStr = addDays(weekStart, dayOffset);
    const dow = dayOfWeek(dateStr);

    // Skip configured rest days
    if (tenantRestDays.includes(dow)) continue;

    for (const req of shiftRequirements) {
      if (!req.days.includes(dow)) continue;
      const tpl = tplMap.get(req.shiftTemplateId);
      if (!tpl) continue;

      // Sort employees by: preference match → fewest hours → round-robin
      const candidates = [...employees].sort((a, b) => {
        const prefA = prefMap.get(a.id);
        const prefB = prefMap.get(b.id);
        const trackA = empTracker.get(a.id)!;
        const trackB = empTracker.get(b.id)!;

        // Skip unavailable
        const unavailA = prefA?.unavailableDays?.includes(dow) ? 1 : 0;
        const unavailB = prefB?.unavailableDays?.includes(dow) ? 1 : 0;
        if (unavailA !== unavailB) return unavailA - unavailB;

        // Prefer employees who prefer this shift
        const prefMatchA = prefA?.preferredShifts?.includes(req.shiftTemplateId) ? -1 : 0;
        const prefMatchB = prefB?.preferredShifts?.includes(req.shiftTemplateId) ? -1 : 0;
        if (prefMatchA !== prefMatchB) return prefMatchA - prefMatchB;

        // Fewest hours first
        return trackA.hours - trackB.hours;
      });

      let assigned = 0;
      for (const emp of candidates) {
        if (assigned >= req.minEmployees) break;
        const track = empTracker.get(emp.id)!;

        // Already assigned this day
        if (track.dates.has(dateStr)) continue;

        // Check rest
        if (track.lastDate && track.lastEndTime) {
          const rest = minutesBetweenShifts(
            track.lastEndTime, track.lastDate, track.lastOvernight || false,
            tpl.startTime, dateStr,
          );
          if (rest >= 0 && rest < SAUDI_LABOR_RULES.minDailyRest * 60) continue;
        }

        // Check weekly hours
        const ramadan = isRamadanPeriod(new Date(dateStr));
        const maxW = ramadan ? SAUDI_LABOR_RULES.ramadanMaxWeekly : SAUDI_LABOR_RULES.maxWeeklyHours;
        if (track.hours + tpl.workingHours > maxW) continue;

        // Check consecutive
        const allDates = [...track.dates, dateStr].sort();
        let consec = 1;
        for (let i = 1; i < allDates.length; i++) {
          if (addDays(allDates[i - 1], 1) === allDates[i]) consec++;
          else consec = 1;
        }
        if (consec > SAUDI_LABOR_RULES.maxConsecutiveDays) continue;

        // Check preference: medical restrictions for night shifts
        const pref = prefMap.get(emp.id);
        if (tpl.isOvernight && pref?.medicalRestrictions && /no.*night/i.test(pref.medicalRestrictions)) continue;

        // Assign
        const empName = emp.fullName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Unknown';
        const assignment: ShiftAssignment = {
          id: uuidv4(),
          tenantId,
          employeeId: emp.id,
          employeeName: empName,
          department,
          date: dateStr,
          shiftTemplateId: req.shiftTemplateId,
          shiftName: tpl.name,
          startTime: tpl.startTime,
          endTime: tpl.endTime,
          status: 'SCHEDULED',
          isOvertime: false,
          assignedBy: userId,
          createdAt: now,
          updatedAt: now,
        };
        schedule.push(assignment);

        track.dates.add(dateStr);
        track.hours += tpl.workingHours;
        track.lastEndTime = tpl.endTime;
        track.lastDate = dateStr;
        track.lastOvernight = tpl.isOvernight;
        assigned++;
      }

      if (assigned < req.minEmployees) {
        unfilled.push({ date: dateStr, shift: tpl.name, needed: req.minEmployees - assigned });
      }
    }
  }

  // Validate
  const conflicts = validateSchedule(schedule, templates, tenantRestDays);

  // Persist
  if (schedule.length > 0) {
    const col = await assignmentsCol(tenantId);
    await col.insertMany(schedule as unknown as Record<string, unknown>[]);
  }

  return { schedule, conflicts, unfilled };
}

// ─── Overtime Calculation ───────────────────────────────────────────────────

export function calculateOvertime(
  assignments: ShiftAssignment[],
  templates: ShiftTemplate[],
  hourlyRate = 25,
): OvertimeCalculation {
  const tplMap = new Map(templates.map(t => [t.templateId || t.id, t]));
  let totalHours = 0;
  for (const a of assignments) {
    if (a.status === 'CANCELLED') continue;
    const tpl = tplMap.get(a.shiftTemplateId);
    totalHours += tpl?.workingHours || 8;
    totalHours += a.overtimeHours || 0;
  }
  const ramadan = assignments.length > 0 ? isRamadanPeriod(new Date(assignments[0].date)) : false;
  const maxWeekly = ramadan ? SAUDI_LABOR_RULES.ramadanMaxWeekly : SAUDI_LABOR_RULES.maxWeeklyHours;
  const regularHours = Math.min(totalHours, maxWeekly);
  const overtimeHours = Math.max(0, totalHours - maxWeekly);
  const overtimeCost = overtimeHours * hourlyRate * SAUDI_LABOR_RULES.overtimeRate;

  const violations: string[] = [];
  if (overtimeHours > SAUDI_LABOR_RULES.maxOvertimeDaily * 7) {
    violations.push(`Overtime exceeds ${SAUDI_LABOR_RULES.maxOvertimeDaily}h/day average`);
  }

  return { regularHours, overtimeHours, overtimeCost, violations };
}

// ─── Burnout Detection ──────────────────────────────────────────────────────

export function detectScheduleBurnout(
  assignments: ShiftAssignment[],
  templates: ShiftTemplate[],
): BurnoutCheck {
  const active = assignments.filter(a => a.status !== 'CANCELLED');
  if (active.length === 0) return { atRisk: false, score: 0, reasons: [], recommendation: 'No data' };

  let score = 0;
  const reasons: string[] = [];
  const tplMap = new Map(templates.map(t => [t.templateId || t.id, t]));

  // 1. Total hours
  let totalHours = 0;
  for (const a of active) {
    const tpl = tplMap.get(a.shiftTemplateId);
    totalHours += (tpl?.workingHours || 8) + (a.overtimeHours || 0);
  }
  if (totalHours > 50) { score += 20; reasons.push(`High weekly hours: ${totalHours}h`); }
  else if (totalHours > 44) { score += 10; reasons.push(`Elevated weekly hours: ${totalHours}h`); }

  // 2. Night shifts
  const nightCount = active.filter(a => {
    const tpl = tplMap.get(a.shiftTemplateId);
    return tpl?.isOvernight;
  }).length;
  if (nightCount >= 4) { score += 25; reasons.push(`${nightCount} night shifts this week`); }
  else if (nightCount >= 2) { score += 10; reasons.push(`${nightCount} night shifts`); }

  // 3. Consecutive days
  const dates = [...new Set(active.map(a => a.date))].sort();
  let maxConsec = 1, consec = 1;
  for (let i = 1; i < dates.length; i++) {
    if (addDays(dates[i - 1], 1) === dates[i]) { consec++; maxConsec = Math.max(maxConsec, consec); }
    else consec = 1;
  }
  if (maxConsec >= 6) { score += 25; reasons.push(`${maxConsec} consecutive work days`); }
  else if (maxConsec >= 5) { score += 15; reasons.push(`${maxConsec} consecutive work days`); }

  // 4. Overtime
  const otHours = active.reduce((s, a) => s + (a.overtimeHours || 0), 0);
  if (otHours > 6) { score += 20; reasons.push(`${otHours}h overtime this week`); }
  else if (otHours > 2) { score += 10; reasons.push(`${otHours}h overtime`); }

  // 5. Short rest between shifts (skip between split-shift segments of same group)
  const sorted = [...active].sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    // Skip rest check between segments of the same split shift
    if (prev.splitGroupId && curr.splitGroupId && prev.splitGroupId === curr.splitGroupId) continue;
    const prevTpl = tplMap.get(prev.shiftTemplateId);
    const rest = minutesBetweenShifts(prev.endTime, prev.date, prevTpl?.isOvernight || false, curr.startTime, curr.date);
    if (rest >= 0 && rest < SAUDI_LABOR_RULES.minDailyRest * 60) {
      score += 15;
      reasons.push(`Short rest between ${prev.date} and ${curr.date}`);
      break;
    }
  }

  score = Math.min(100, score);
  const atRisk = score >= 50;

  let recommendation = 'Schedule looks balanced.';
  if (score >= 75) recommendation = 'High burnout risk — reduce hours and ensure rest days immediately.';
  else if (score >= 50) recommendation = 'Moderate risk — consider reducing overtime or adding a rest day next week.';
  else if (score >= 25) recommendation = 'Slightly elevated — monitor hours next week.';

  return { atRisk, score, reasons, recommendation };
}

// ─── Shift Swap ─────────────────────────────────────────────────────────────

export async function swapShifts(
  tenantId: string,
  assignmentId1: string,
  assignmentId2: string,
  templates: ShiftTemplate[],
): Promise<{ success: boolean; conflicts: ScheduleConflict[] }> {
  const col = await assignmentsCol(tenantId);
  const a1 = await col.findOne({ tenantId, id: assignmentId1 }) as unknown as ShiftAssignment | null;
  const a2 = await col.findOne({ tenantId, id: assignmentId2 }) as unknown as ShiftAssignment | null;
  if (!a1 || !a2) return { success: false, conflicts: [{ type: 'DOUBLE_BOOKED', employeeId: '', employeeName: '', description: 'Assignment not found', severity: 'VIOLATION', dates: [] }] };

  // Simulate swap
  const simulated: ShiftAssignment[] = [
    { ...a1, employeeId: a2.employeeId, employeeName: a2.employeeName },
    { ...a2, employeeId: a1.employeeId, employeeName: a1.employeeName },
  ];
  const conflicts = validateSchedule(simulated, templates);

  if (conflicts.some(c => c.severity === 'VIOLATION')) {
    return { success: false, conflicts };
  }

  // Execute swap
  const now = new Date();
  await col.updateOne({ tenantId, id: assignmentId1 } as Record<string, unknown>, {
    $set: { employeeId: a2.employeeId, employeeName: a2.employeeName, status: 'SWAPPED' as const, updatedAt: now },
  });
  await col.updateOne({ tenantId, id: assignmentId2 } as Record<string, unknown>, {
    $set: { employeeId: a1.employeeId, employeeName: a1.employeeName, status: 'SWAPPED' as const, updatedAt: now },
  });

  return { success: true, conflicts };
}

// ─── Query helpers ──────────────────────────────────────────────────────────

export async function getWeekSchedule(tenantId: string, department: string, weekStart: string): Promise<ScheduleWeek> {
  const weekEnd = addDays(weekStart, 6);
  const col = await assignmentsCol(tenantId);
  const query: Record<string, unknown> = { tenantId, date: { $gte: weekStart, $lte: weekEnd } };
  if (department) query.department = department;

  const assignments = await col.find(query).sort({ date: 1, startTime: 1 }).toArray() as unknown as ShiftAssignment[];
  const templates = await listTemplates(tenantId);
  const conflicts = validateSchedule(assignments, templates);

  let totalHours = 0;
  let overtimeHours = 0;
  const tplMap = new Map(templates.map(t => [t.templateId || t.id, t]));
  for (const a of assignments) {
    if (a.status === 'CANCELLED') continue;
    const tpl = tplMap.get(a.shiftTemplateId);
    totalHours += tpl?.workingHours || 8;
    overtimeHours += a.overtimeHours || 0;
  }

  return {
    weekStart,
    weekEnd,
    department,
    assignments,
    stats: {
      totalShifts: assignments.filter(a => a.status !== 'CANCELLED').length,
      totalEmployees: new Set(assignments.map(a => a.employeeId)).size,
      totalHours,
      overtimeHours,
      unfilledShifts: 0,
      conflicts,
    },
  };
}

export async function getEmployeeSchedule(tenantId: string, employeeId: string, startDate: string, endDate: string): Promise<ShiftAssignment[]> {
  const col = await assignmentsCol(tenantId);
  return col.find({ tenantId, employeeId, date: { $gte: startDate, $lte: endDate }, status: { $ne: 'CANCELLED' } })
    .sort({ date: 1 }).toArray() as unknown as ShiftAssignment[];
}

export async function cancelAssignment(tenantId: string, assignmentId: string): Promise<boolean> {
  const col = await assignmentsCol(tenantId);
  const result = await col.updateOne(
    { tenantId, id: assignmentId } as Record<string, unknown>,
    { $set: { status: 'CANCELLED' as const, updatedAt: new Date() } },
  );
  return result.modifiedCount > 0;
}
