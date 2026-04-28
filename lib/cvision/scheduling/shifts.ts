/**
 * CVision Smart Scheduling - Default Shifts & Helper Functions
 *
 * Predefined shifts, time calculations, conflict detection, and display utilities.
 */

import { Shift, ShiftType } from './types';

// ─── Default Shifts ─────────────────────────────────────────────

export const DEFAULT_SHIFTS: Omit<Shift, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Day Shift',
    nameEn: 'Day Shift',
    code: 'DAY',
    startTime: '07:00',
    endTime: '15:00',
    durationHours: 8,
    color: '#22C55E',
    icon: 'sun',
    isOvernight: false,
    allowance: 0,
    isActive: true,
  },
  {
    name: 'Evening Shift',
    nameEn: 'Evening Shift',
    code: 'EVENING',
    startTime: '15:00',
    endTime: '23:00',
    durationHours: 8,
    color: '#F59E0B',
    icon: 'sunset',
    isOvernight: false,
    allowance: 200,
    isActive: true,
  },
  {
    name: 'Night Shift',
    nameEn: 'Night Shift',
    code: 'NIGHT',
    startTime: '23:00',
    endTime: '07:00',
    durationHours: 8,
    color: '#6366F1',
    icon: 'moon',
    isOvernight: true,
    allowance: 500,
    isActive: true,
  },
  {
    name: 'Day Off',
    nameEn: 'Day Off',
    code: 'OFF',
    startTime: '00:00',
    endTime: '23:59',
    durationHours: 0,
    color: '#94A3B8',
    icon: 'home',
    isOvernight: false,
    allowance: 0,
    isActive: true,
  },
  {
    name: 'Leave',
    nameEn: 'Leave',
    code: 'LEAVE',
    startTime: '00:00',
    endTime: '23:59',
    durationHours: 0,
    color: '#EC4899',
    icon: 'palmtree',
    isOvernight: false,
    allowance: 0,
    isActive: true,
  },
  {
    name: 'Overtime',
    nameEn: 'Overtime',
    code: 'OVERTIME',
    startTime: '00:00',
    endTime: '00:00',
    durationHours: 0,
    color: '#EF4444',
    icon: 'clock',
    isOvernight: false,
    allowance: 0,
    isActive: true,
  },
];

// ─── Shift Lookup ───────────────────────────────────────────────

export function getShiftByCode(shifts: Shift[], code: ShiftType): Shift | undefined {
  return shifts.find(s => s.code === code);
}

// ─── Time Calculations ──────────────────────────────────────────

export function calculateHours(startTime: string, endTime: string, isOvernight: boolean): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  let startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;

  if (isOvernight && endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }

  return (endMinutes - startMinutes) / 60;
}

export function calculateOvertimePay(
  baseSalary: number,
  hours: number,
  isWeekend: boolean = false,
  isHoliday: boolean = false
): number {
  const hourlyRate = baseSalary / (30 * 8);

  let multiplier = 1.5;          // 150% normal
  if (isWeekend) multiplier = 1.75;  // 175% weekend
  if (isHoliday) multiplier = 2.0;   // 200% holiday

  return Math.round(hourlyRate * hours * multiplier);
}

// ─── Formatting ─────────────────────────────────────────────────

export function formatTime12h(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// ─── Conflict Detection ─────────────────────────────────────────

export function hasShiftConflict(
  shift1: { startTime: string; endTime: string; isOvernight: boolean },
  shift2: { startTime: string; endTime: string; isOvernight: boolean }
): boolean {
  const toMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  let s1Start = toMinutes(shift1.startTime);
  let s1End = toMinutes(shift1.endTime);
  let s2Start = toMinutes(shift2.startTime);
  let s2End = toMinutes(shift2.endTime);

  if (shift1.isOvernight) s1End += 24 * 60;
  if (shift2.isOvernight) s2End += 24 * 60;

  return s1Start < s2End && s2Start < s1End;
}

// ─── Display Helpers ────────────────────────────────────────────

export function getShiftColor(shiftType: ShiftType): string {
  const colors: Record<ShiftType, string> = {
    DAY: '#22C55E',
    EVENING: '#F59E0B',
    NIGHT: '#6366F1',
    OFF: '#94A3B8',
    LEAVE: '#EC4899',
    OVERTIME: '#EF4444',
    SPLIT: '#A855F7',
  };
  return colors[shiftType] || '#94A3B8';
}

export function getShiftIcon(shiftType: ShiftType): string {
  const icons: Record<ShiftType, string> = {
    DAY: 'sun',
    EVENING: 'sunset',
    NIGHT: 'moon',
    OFF: 'home',
    LEAVE: 'palmtree',
    OVERTIME: 'clock',
    SPLIT: 'arrow-left-right',
  };
  return icons[shiftType] || 'calendar';
}

export function getShiftName(shiftType: ShiftType): string {
  const names: Record<ShiftType, string> = {
    DAY: 'Day',
    EVENING: 'Evening',
    NIGHT: 'Night',
    OFF: 'Off',
    LEAVE: 'Leave',
    OVERTIME: 'Overtime',
    SPLIT: 'Split',
  };
  return names[shiftType] || shiftType;
}
