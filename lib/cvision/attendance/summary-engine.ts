/**
 * CVision Attendance Summary Engine
 *
 * Handles:
 *  - Monthly attendance summary per employee
 *  - Department-level absenteeism reports
 *  - Saudi weekend handling (Fri/Sat)
 *  - Work-from-home tracking
 */

// ── Types ───────────────────────────────────────────────────────────────

export interface MonthlySummary {
  totalWorkDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  earlyLeaveDays: number;
  totalWorkHours: number;
  totalOvertimeHours: number;
  totalLateMinutes: number;
  attendanceRate: number;
  onLeave: number;
  workFromHome: number;
  incompleteDays: number;
}

export interface DepartmentAbsenteeism {
  department: string;
  departmentId: string;
  totalEmployees: number;
  avgAttendanceRate: number;
  totalAbsentDays: number;
  totalLateDays: number;
  topAbsentees: { employeeId: string; name: string; absentDays: number }[];
}

export interface CalendarDay {
  date: string;
  dayOfWeek: number; // 0=Sunday
  isWeekend: boolean;
  isToday: boolean;
  status?: string;
  actualIn?: string;
  actualOut?: string;
  workedMinutes?: number;
  lateMinutes?: number;
  overtimeMinutes?: number;
  source?: string;
  isOnLeave?: boolean;
  leaveType?: string;
}

// ── Weekend detection (Saudi: Fri=5, Sat=6) ─────────────────────────────

export function isSaudiWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 5 || day === 6; // Friday or Saturday
}

export function getWorkingDaysInMonth(year: number, month: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  let workDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    if (!isSaudiWeekend(date)) workDays++;
  }
  return workDays;
}

// ── Monthly attendance summary per employee ─────────────────────────────

export async function getMonthlyAttendanceSummary(
  db: any,
  tenantId: string,
  employeeId: string,
  month: string, // 'YYYY-MM'
): Promise<MonthlySummary> {
  const [yearStr, monStr] = month.split('-');
  const year = parseInt(yearStr);
  const mon = parseInt(monStr);

  // Get attendance records for the month
  // Records use either string date format or Date objects
  const records = await db
    .collection('cvision_attendance')
    .find({
      tenantId,
      employeeId,
      $or: [
        { date: { $regex: `^${month}` } }, // String format
        {
          date: {
            $gte: new Date(year, mon - 1, 1),
            $lte: new Date(year, mon, 0),
          },
        }, // Date format
      ],
    })
    .toArray();

  // Get approved leaves in this month
  const leaves = await db
    .collection('cvision_leaves')
    .find({
      tenantId,
      employeeId,
      status: 'APPROVED',
      startDate: { $lte: new Date(year, mon, 0) },
      endDate: { $gte: new Date(year, mon - 1, 1) },
    })
    .toArray();

  const totalWorkDays = getWorkingDaysInMonth(year, mon);

  // Count leave days within this month
  let onLeave = 0;
  for (const leave of leaves) {
    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);
    const monthStart = new Date(year, mon - 1, 1);
    const monthEnd = new Date(year, mon, 0);

    const effectiveStart =
      start > monthStart ? start : monthStart;
    const effectiveEnd = end < monthEnd ? end : monthEnd;

    // Count working days in leave range
    const d = new Date(effectiveStart);
    while (d <= effectiveEnd) {
      if (!isSaudiWeekend(d)) onLeave++;
      d.setDate(d.getDate() + 1);
    }
  }

  const presentDays = records.filter(
    (r: any) => r.status === 'PRESENT' || r.status === 'LATE',
  ).length;
  const lateDays = records.filter(
    (r: any) => r.status === 'LATE',
  ).length;
  const earlyLeaveDays = records.filter(
    (r: any) => (r.earlyLeaveMinutes || 0) > 0,
  ).length;
  const incompleteDays = records.filter(
    (r: any) => r.status === 'INCOMPLETE',
  ).length;
  const workFromHome = records.filter(
    (r: any) => r.source === 'WFH',
  ).length;

  const totalWorkMinutes = records.reduce(
    (sum: number, r: any) => sum + (r.workedMinutes || r.totalMinutes || 0),
    0,
  );
  const totalOvertimeMinutes = records.reduce(
    (sum: number, r: any) => sum + (r.overtimeMinutes || 0),
    0,
  );
  const totalLateMinutes = records.reduce(
    (sum: number, r: any) => sum + (r.lateMinutes || 0),
    0,
  );

  const absentDays = Math.max(
    0,
    totalWorkDays - presentDays - onLeave - workFromHome - incompleteDays,
  );

  return {
    totalWorkDays,
    presentDays,
    absentDays,
    lateDays,
    earlyLeaveDays,
    totalWorkHours:
      Math.round((totalWorkMinutes / 60) * 10) / 10,
    totalOvertimeHours:
      Math.round((totalOvertimeMinutes / 60) * 10) / 10,
    totalLateMinutes,
    attendanceRate:
      totalWorkDays > 0
        ? Math.round((presentDays / totalWorkDays) * 100)
        : 0,
    onLeave,
    workFromHome,
    incompleteDays,
  };
}

// ── Department-level absenteeism report ─────────────────────────────────

export async function getDepartmentAbsenteeism(
  db: any,
  tenantId: string,
  month: string, // 'YYYY-MM'
): Promise<DepartmentAbsenteeism[]> {
  const departments = await db
    .collection('cvision_departments')
    .find({ tenantId, isArchived: { $ne: true } })
    .toArray();

  const results: DepartmentAbsenteeism[] = [];

  for (const dept of departments) {
    const employees = await db
      .collection('cvision_employees')
      .find({
        tenantId,
        $or: [
          { departmentId: dept.id },
          { department: dept.name },
        ],
        status: { $in: ['ACTIVE', 'PROBATION'] },
        isArchived: { $ne: true },
      })
      .toArray();

    if (employees.length === 0) continue;

    let totalAttendance = 0;
    let totalAbsent = 0;
    let totalLate = 0;
    const absentees: {
      employeeId: string;
      name: string;
      absentDays: number;
    }[] = [];

    for (const emp of employees) {
      try {
        const summary = await getMonthlyAttendanceSummary(
          db,
          tenantId,
          emp.id || emp.employeeId,
          month,
        );
        totalAttendance += summary.attendanceRate;
        totalAbsent += summary.absentDays;
        totalLate += summary.lateDays;
        absentees.push({
          employeeId: emp.id || emp.employeeId,
          name:
            `${emp.firstName || ''} ${emp.lastName || ''}`.trim() ||
            emp.email ||
            emp.id,
          absentDays: summary.absentDays,
        });
      } catch {
        // Skip employees with errors
      }
    }

    results.push({
      department: dept.name,
      departmentId: dept.id,
      totalEmployees: employees.length,
      avgAttendanceRate:
        employees.length > 0
          ? Math.round(totalAttendance / employees.length)
          : 0,
      totalAbsentDays: totalAbsent,
      totalLateDays: totalLate,
      topAbsentees: absentees
        .sort((a, b) => b.absentDays - a.absentDays)
        .slice(0, 5),
    });
  }

  return results.sort(
    (a, b) => a.avgAttendanceRate - b.avgAttendanceRate,
  ); // Worst attendance first
}

// ── Calendar view data ──────────────────────────────────────────────────

export async function getAttendanceCalendar(
  db: any,
  tenantId: string,
  employeeId: string,
  month: string, // 'YYYY-MM'
): Promise<CalendarDay[]> {
  const [yearStr, monStr] = month.split('-');
  const year = parseInt(yearStr);
  const mon = parseInt(monStr);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const today = new Date().toISOString().split('T')[0];

  // Get attendance records
  const records = await db
    .collection('cvision_attendance')
    .find({
      tenantId,
      employeeId,
      $or: [
        { date: { $regex: `^${month}` } },
        {
          date: {
            $gte: new Date(year, mon - 1, 1),
            $lte: new Date(year, mon, 0),
          },
        },
      ],
    })
    .toArray();

  // Get approved leaves
  const leaves = await db
    .collection('cvision_leaves')
    .find({
      tenantId,
      employeeId,
      status: 'APPROVED',
      startDate: { $lte: new Date(year, mon, 0) },
      endDate: { $gte: new Date(year, mon - 1, 1) },
    })
    .toArray();

  // Build a map of date → record
  const recordMap = new Map<string, any>();
  for (const r of records) {
    const dateStr =
      typeof r.date === 'string'
        ? r.date.slice(0, 10)
        : new Date(r.date).toISOString().split('T')[0];
    recordMap.set(dateStr, r);
  }

  // Build a map of date → leave
  const leaveMap = new Map<string, any>();
  for (const l of leaves) {
    const start = new Date(l.startDate);
    const end = new Date(l.endDate);
    const d = new Date(start);
    while (d <= end) {
      const key = d.toISOString().split('T')[0];
      leaveMap.set(key, l);
      d.setDate(d.getDate() + 1);
    }
  }

  const calendar: CalendarDay[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, mon - 1, d);
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();
    const isWeekend = isSaudiWeekend(date);
    const isToday = dateStr === today;

    const record = recordMap.get(dateStr);
    const leave = leaveMap.get(dateStr);

    const day: CalendarDay = {
      date: dateStr,
      dayOfWeek,
      isWeekend,
      isToday,
    };

    if (record) {
      day.status = record.status;
      // Support both field names: DB stores checkIn/checkOut,
      // biometric engine also writes actualIn/actualOut as HH:MM strings.
      day.actualIn = record.actualIn
        ?? (record.checkIn ? new Date(record.checkIn).toTimeString().slice(0, 5) : undefined);
      day.actualOut = record.actualOut
        ?? (record.checkOut ? new Date(record.checkOut).toTimeString().slice(0, 5) : undefined);
      day.workedMinutes =
        record.workedMinutes || record.totalMinutes || 0;
      day.lateMinutes = record.lateMinutes || 0;
      day.overtimeMinutes = record.overtimeMinutes || 0;
      day.source = record.source;
    } else if (leave) {
      day.isOnLeave = true;
      day.leaveType = leave.leaveType || leave.type || 'LEAVE';
      day.status = 'ON_LEAVE';
    } else if (isWeekend) {
      day.status = 'WEEKEND';
    } else if (date < new Date(today) && !isWeekend) {
      day.status = 'ABSENT';
    }

    calendar.push(day);
  }

  return calendar;
}
