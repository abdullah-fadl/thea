import { z } from 'zod';
import { logger } from '@/lib/monitoring/logger';
// app/api/cvision/attendance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import { getCVisionDb } from '@/lib/cvision/db';
import {
  calculateLateness,
  calculateEarlyLeave,
  calculateWorkedHours,
  calculateOvertime,
  calculateAttendanceDeduction,
  summarizeMonthlyAttendance,
  checkWorkHoursViolation,
  getDefaultShiftFromSettings,
  DEFAULT_SHIFTS,
  SAUDI_WORK_RULES,
} from '@/lib/cvision/attendance';
import { getWorkSchedule } from '@/lib/cvision/admin-settings';
import {
  processBiometricLogs,
  recordGPSAttendance,
  createGeofence,
  updateGeofence,
  listGeofences,
  deleteGeofence,
} from '@/lib/cvision/attendance/biometric-engine';
import {
  requestCorrection,
  approveCorrection,
  rejectCorrection,
  listCorrections,
} from '@/lib/cvision/attendance/correction-engine';
import {
  getMonthlyAttendanceSummary,
  getDepartmentAbsenteeism,
  getAttendanceCalendar,
} from '@/lib/cvision/attendance/summary-engine';

const attendancePostSchema = z.object({
  action: z.enum([
    'gps-punch',
    'request-correction',
    'approve-correction',
    'reject-correction',
    'process-biometric',
    'manage-geofence',
    'calculate-late',
    'calculate-deductions',
    'calculate-overtime',
    'check-violations',
  ]).optional(), // optional because default action is record check-in/check-out
}).passthrough();

// GET /api/cvision/attendance - Attendance records & reports
export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId }) => {
    try {
    const { searchParams } = new URL(request.url);

    const employeeId = searchParams.get('employeeId');
    const date = searchParams.get('date');
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const status = searchParams.get('status');
    const action = searchParams.get('action');

    const db = await getCVisionDb(tenantId);

    // Get shift settings
    if (action === 'shifts') {
      return NextResponse.json({
        success: true,
        data: {
          shifts: DEFAULT_SHIFTS,
          rules: SAUDI_WORK_RULES,
        },
      });
    }

    // ── Monthly attendance summary (enhanced) ──
    if (action === 'monthly-summary' && employeeId && month && year) {
      const monthStr = `${year}-${month.padStart(2, '0')}`;
      const summary = await getMonthlyAttendanceSummary(db, tenantId, employeeId, monthStr);

      // Also fetch raw records for detail view
      const startOfMonth = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endOfMonth = new Date(parseInt(year), parseInt(month), 0);
      const records = await db.collection('cvision_attendance').find({
        tenantId,
        employeeId,
        date: { $gte: startOfMonth, $lte: endOfMonth },
      }).toArray();

      // Normalise checkIn/checkOut → actualIn/actualOut for frontend
      const normalisedRecords = records.map((r: any) => ({
        ...r,
        actualIn: r.actualIn ?? (r.checkIn ? new Date(r.checkIn).toISOString() : undefined),
        actualOut: r.actualOut ?? (r.checkOut ? new Date(r.checkOut).toISOString() : undefined),
      }));

      return NextResponse.json({
        success: true,
        data: { summary, records: normalisedRecords },
      });
    }

    // ── Department absenteeism report ──
    if (action === 'dept-absenteeism') {
      const monthStr = month && year
        ? `${year}-${month.padStart(2, '0')}`
        : new Date().toISOString().slice(0, 7);
      const report = await getDepartmentAbsenteeism(db, tenantId, monthStr);
      return NextResponse.json({ success: true, data: report });
    }

    // ── Attendance calendar (color-coded month view) ──
    if (action === 'calendar' && employeeId) {
      const monthStr = month && year
        ? `${year}-${month.padStart(2, '0')}`
        : new Date().toISOString().slice(0, 7);
      const calendar = await getAttendanceCalendar(db, tenantId, employeeId, monthStr);
      return NextResponse.json({ success: true, data: calendar });
    }

    // ── List corrections ──
    if (action === 'corrections') {
      const correctionStatus = searchParams.get('correctionStatus') || undefined;
      const corrMonth = month && year ? `${year}-${month.padStart(2, '0')}` : undefined;
      const corrections = await listCorrections(db, tenantId, {
        status: correctionStatus,
        employeeId: employeeId || undefined,
        month: corrMonth,
      });

      // Enrich with employee names
      const empIds = [...new Set(corrections.map((c: any) => c.employeeId).filter(Boolean))];
      const employees = empIds.length > 0
        ? await db.collection('cvision_employees').find({ tenantId, id: { $in: empIds }, deletedAt: null }).toArray()
        : [];
      const empMap = new Map(employees.map((e: any) => [e.id, e]));

      const enriched = corrections.map((c: any) => {
        const emp = empMap.get(c.employeeId);
        return {
          ...c,
          id: c._id?.toString() || c.id,
          employeeName: c.employeeName || (emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : null),
        };
      });

      return NextResponse.json({ success: true, data: enriched });
    }

    // ── List geofences ──
    if (action === 'geofences') {
      const geofences = await listGeofences(db, tenantId);
      return NextResponse.json({ success: true, data: geofences });
    }

    // ── List biometric devices ──
    if (action === 'devices') {
      const devices = await db.collection('cvision_biometric_devices')
        .find({ tenantId })
        .sort({ createdAt: -1 })
        .toArray();
      // Strip API keys
      const safeDevices = devices.map((d: any) => ({
        ...d,
        id: d._id?.toString() || d.id,
        apiKey: undefined,
      }));
      return NextResponse.json({ success: true, data: safeDevices });
    }

    // ── Default: list attendance records ──
    const query: any = { tenantId };

    if (employeeId) query.employeeId = employeeId;
    if (status) query.status = status;

    if (date) {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      // Support both Date objects and string dates
      query.$or = [
        { date: { $gte: targetDate, $lt: nextDay } },
        { date: date }, // string "YYYY-MM-DD"
      ];
    } else if (month && year) {
      const m = month.padStart(2, '0');
      const monthStr = `${year}-${m}`;
      const startOfMonth = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endOfMonth = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
      query.date = { $gte: startOfMonth, $lte: endOfMonth };
    }

    const attendance = await db.collection('cvision_attendance')
      .find(query)
      .sort({ date: -1 })
      .limit(500)
      .toArray();

    // Deduplicate: if same employee has multiple records for same date, keep the latest one
    const deduped = new Map<string, any>();
    for (const rec of attendance) {
      // Normalize date to YYYY-MM-DD string for dedup key
      let dateKey = '';
      if (rec.date instanceof Date || (typeof rec.date === 'string' && rec.date.includes('T'))) {
        const d = new Date(rec.date);
        dateKey = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
      } else if (typeof rec.date === 'string') {
        dateKey = rec.date.split('T')[0];
      }
      const key = `${rec.employeeId}::${dateKey}`;
      const existing = deduped.get(key);
      if (!existing || (rec.updatedAt && (!existing.updatedAt || new Date(rec.updatedAt) > new Date(existing.updatedAt)))) {
        deduped.set(key, rec);
      }
    }
    const dedupedAttendance = Array.from(deduped.values());

    // Fetch employee names for enrichment
    const employeeIds = [...new Set(dedupedAttendance.map((a: any) => a.employeeId).filter(Boolean))];
    const employees = employeeIds.length > 0
      ? await db.collection('cvision_employees')
          .find({ tenantId, id: { $in: employeeIds }, deletedAt: null })
          .toArray()
      : [];

    const employeeMap = new Map(employees.map((e: any) => [e.id, e]));

    // Resolve department names
    const deptIds = [...new Set(employees.map((e: any) => e.departmentId).filter(Boolean))];
    const deptDocs = deptIds.length > 0
      ? await db.collection('cvision_departments').find({ tenantId, id: { $in: deptIds } }).project({ id: 1, name: 1 }).toArray()
      : [];
    const deptMap = new Map(deptDocs.map((d: any) => [d.id, d.name]));

    // Enrich attendance records with employee names and department names.
    // Also normalise field names: DB stores checkIn/checkOut but the
    // frontend (and summary engine) expect actualIn/actualOut.
    const enrichedAttendance = dedupedAttendance.map((record: any) => {
      const employee = employeeMap.get(record.employeeId);
      // Derive actualIn / actualOut from checkIn / checkOut when missing
      const actualIn = record.actualIn
        ?? (record.checkIn ? new Date(record.checkIn).toISOString() : undefined);
      const actualOut = record.actualOut
        ?? (record.checkOut ? new Date(record.checkOut).toISOString() : undefined);
      return {
        ...record,
        id: record._id?.toString() || record.id,
        actualIn,
        actualOut,
        employeeName: employee
          ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.email
          : null,
        departmentName: employee ? deptMap.get(employee.departmentId) || null : null,
      };
    });

    return NextResponse.json({
      success: true,
      data: { attendance: enrichedAttendance, total: enrichedAttendance.length },
    });

  } catch (error) {
    logger.error('Attendance API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_READ }
);

// POST /api/cvision/attendance - Record attendance & actions
export const POST = withAuthTenant(
  async (request: NextRequest, { tenantId, userId }) => {
    try {
    const body = await request.json();
    const parsed = attendancePostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { action } = body;

    const db = await getCVisionDb(tenantId);

    // ══════════════════════════════════════════════════════════════
    // NEW ACTIONS
    // ══════════════════════════════════════════════════════════════

    // ── GPS-based check-in / check-out ──
    if (action === 'gps-punch') {
      const { employeeId, type, lat, lng, accuracy } = body;
      if (!employeeId || !type || lat == null || lng == null) {
        return NextResponse.json(
          { success: false, error: 'employeeId, type, lat, lng are required' },
          { status: 400 },
        );
      }
      const result = await recordGPSAttendance(db, tenantId, {
        employeeId,
        type,
        lat,
        lng,
        accuracy: accuracy || 0,
      });
      return NextResponse.json({
        success: result.success,
        data: result,
        ...(result.success ? {} : { error: result.message }),
      }, { status: result.success ? 200 : 400 });
    }

    // ── Request attendance correction ──
    if (action === 'request-correction') {
      const { employeeId, employeeName, date, type, originalCheckIn, originalCheckOut, correctedCheckIn, correctedCheckOut, reason, evidence } = body;
      if (!employeeId || !date || !type) {
        return NextResponse.json(
          { success: false, error: 'employeeId, date, and type are required' },
          { status: 400 },
        );
      }
      const result = await requestCorrection(db, tenantId, {
        employeeId,
        employeeName,
        date,
        type,
        originalCheckIn,
        originalCheckOut,
        correctedCheckIn,
        correctedCheckOut,
        reason,
        evidence,
        requestedBy: userId,
      });
      return NextResponse.json({ success: true, data: result });
    }

    // ── Approve correction ──
    if (action === 'approve-correction') {
      const { correctionId } = body;
      if (!correctionId) {
        return NextResponse.json(
          { success: false, error: 'correctionId is required' },
          { status: 400 },
        );
      }
      const result = await approveCorrection(db, tenantId, correctionId, userId);
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    // ── Reject correction ──
    if (action === 'reject-correction') {
      const { correctionId, rejectionReason } = body;
      if (!correctionId || !rejectionReason) {
        return NextResponse.json(
          { success: false, error: 'correctionId and rejectionReason are required' },
          { status: 400 },
        );
      }
      const result = await rejectCorrection(db, tenantId, correctionId, userId, rejectionReason);
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    // ── Process raw biometric data into attendance ──
    if (action === 'process-biometric') {
      const { date } = body;
      if (!date) {
        return NextResponse.json(
          { success: false, error: 'date is required (YYYY-MM-DD)' },
          { status: 400 },
        );
      }
      const result = await processBiometricLogs(db, tenantId, date);
      return NextResponse.json({ success: true, data: result });
    }

    // ── Manage geofences ──
    if (action === 'manage-geofence') {
      const { operation, geofenceId, name, centerLat, centerLng, radiusMeters, address, status: geoStatus } = body;

      if (operation === 'create') {
        if (!name || centerLat == null || centerLng == null) {
          return NextResponse.json(
            { success: false, error: 'name, centerLat, centerLng are required' },
            { status: 400 },
          );
        }
        const geofence = await createGeofence(db, tenantId, {
          name,
          centerLat,
          centerLng,
          radiusMeters: radiusMeters || 200,
          address,
        });
        return NextResponse.json({ success: true, data: geofence });
      }

      if (operation === 'update') {
        if (!geofenceId) {
          return NextResponse.json(
            { success: false, error: 'geofenceId is required' },
            { status: 400 },
          );
        }
        const updated = await updateGeofence(db, tenantId, geofenceId, {
          ...(name && { name }),
          ...(centerLat != null && { centerLat }),
          ...(centerLng != null && { centerLng }),
          ...(radiusMeters != null && { radiusMeters }),
          ...(address && { address }),
          ...(geoStatus && { status: geoStatus }),
        });
        return NextResponse.json({ success: updated });
      }

      if (operation === 'delete') {
        if (!geofenceId) {
          return NextResponse.json(
            { success: false, error: 'geofenceId is required' },
            { status: 400 },
          );
        }
        const deleted = await deleteGeofence(db, tenantId, geofenceId);
        return NextResponse.json({ success: deleted });
      }

      return NextResponse.json(
        { success: false, error: 'Invalid operation. Use: create, update, delete' },
        { status: 400 },
      );
    }

    // ══════════════════════════════════════════════════════════════
    // EXISTING ACTIONS
    // ══════════════════════════════════════════════════════════════

    // Calculate lateness
    if (action === 'calculate-late') {
      const { scheduledIn, actualIn, graceMinutes } = body;

      if (!scheduledIn || !actualIn) {
        return NextResponse.json(
          { success: false, error: 'Scheduled time and actual check-in time are required' },
          { status: 400 }
        );
      }

      const calculation = calculateLateness(scheduledIn, actualIn, graceMinutes);

      return NextResponse.json({
        success: true,
        data: calculation,
      });
    }

    // Calculate deductions
    if (action === 'calculate-deductions') {
      const {
        lateMinutes = 0,
        earlyLeaveMinutes = 0,
        absentDays = 0,
        basicSalary,
        housingAllowance = 0,
      } = body;

      if (!basicSalary) {
        return NextResponse.json(
          { success: false, error: 'Basic salary is required' },
          { status: 400 }
        );
      }

      const deductions = calculateAttendanceDeduction(
        lateMinutes,
        earlyLeaveMinutes,
        absentDays,
        basicSalary,
        housingAllowance
      );

      return NextResponse.json({
        success: true,
        data: deductions,
      });
    }

    // Calculate overtime
    if (action === 'calculate-overtime') {
      const { workedMinutes, scheduledMinutes, hourlyRate, isFriday = false } = body;

      if (!workedMinutes || !scheduledMinutes || !hourlyRate) {
        return NextResponse.json(
          { success: false, error: 'All fields are required' },
          { status: 400 }
        );
      }

      const overtime = calculateOvertime(workedMinutes, scheduledMinutes, hourlyRate, isFriday);

      return NextResponse.json({
        success: true,
        data: overtime,
      });
    }

    // Check work hours violations
    if (action === 'check-violations') {
      const { dailyWorkedMinutes, weeklyWorkedMinutes, yearlyOvertimeMinutes, isRamadan = false } = body;

      const violations = checkWorkHoursViolation(
        dailyWorkedMinutes || 0,
        weeklyWorkedMinutes || 0,
        yearlyOvertimeMinutes || 0,
        isRamadan
      );

      return NextResponse.json({
        success: true,
        data: violations,
      });
    }

    // ══════════════════════════════════════════════════════════════
    // DEFAULT: Record check-in/check-out
    // ══════════════════════════════════════════════════════════════

    const {
      employeeId,
      date,
      actualIn,
      actualOut,
      scheduledIn,
      scheduledOut,
      workingHours: bodyWorkingHours,
      source = 'MANUAL',
      notes,
    } = body;

    if (!employeeId || !date) {
      return NextResponse.json(
        { success: false, error: 'Employee ID and date are required' },
        { status: 400 }
      );
    }

    // Verify employee exists (search by id or _id)
    const employee = await db.collection('cvision_employees').findOne({
      $or: [{ id: employeeId }, { _id: employeeId }],
      tenantId,
    });

    if (!employee) {
      logger.info('[Attendance API] Employee not found:', { employeeId, tenantId });
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      );
    }

    const recordDate = new Date(date);
    recordDate.setHours(0, 0, 0, 0);

    // ── Helper: extract HH:MM from datetime string or time string ──
    function extractTime(input: string): string {
      if (!input) return '';
      // If it's a full datetime like "2025-02-24T11:00:00" or ISO string
      if (input.includes('T')) {
        const d = new Date(input);
        if (!isNaN(d.getTime())) {
          return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        }
      }
      // If already HH:MM or HH:MM:SS, return first 5 chars
      if (/^\d{2}:\d{2}/.test(input)) {
        return input.substring(0, 5);
      }
      return input;
    }

    // Calculate lateness, early leave, worked hours
    let lateMinutes = 0;
    let earlyLeaveMinutes = 0;
    let workedMinutes = 0;
    let overtimeMinutes = 0;
    let recordStatus = 'PRESENT';

    const ws = await getWorkSchedule(db, tenantId);
    const shift = getDefaultShiftFromSettings(ws);
    const effectiveWorkingHours = bodyWorkingHours || (shift.workingMinutes / 60); // 8 by default
    const effectiveScheduledIn = scheduledIn || shift.startTime;
    // Calculate scheduledOut based on working hours if not explicitly provided
    const effectiveScheduledOut = scheduledOut || (() => {
      const inTime = extractTime(actualIn || effectiveScheduledIn);
      if (!inTime) return shift.endTime;
      const [h, m] = inTime.split(':').map(Number);
      const totalMin = h * 60 + m + effectiveWorkingHours * 60;
      const outH = Math.floor(totalMin / 60) % 24;
      const outM = totalMin % 60;
      return `${outH.toString().padStart(2, '0')}:${outM.toString().padStart(2, '0')}`;
    })();
    const effectiveWorkingMinutes = effectiveWorkingHours * 60;

    // Extract clean HH:MM times for calculation
    const actualInTime = actualIn ? extractTime(actualIn) : '';
    const actualOutTime = actualOut ? extractTime(actualOut) : '';

    if (actualInTime) {
      const lateCalc = calculateLateness(effectiveScheduledIn, actualInTime);
      lateMinutes = lateCalc.deductionMinutes;
      if (lateCalc.isLate && !lateCalc.withinGrace) {
        recordStatus = 'LATE';
      }
    }

    if (actualOutTime) {
      const earlyCalc = calculateEarlyLeave(effectiveScheduledOut, actualOutTime);
      earlyLeaveMinutes = earlyCalc.earlyMinutes;
      if (earlyCalc.isEarlyLeave) {
        // If both late AND early leave, mark as EARLY_LEAVE (more severe)
        if (recordStatus !== 'LATE') {
          recordStatus = 'EARLY_LEAVE';
        }
      }
    }

    if (actualIn && actualOut) {
      const worked = calculateWorkedHours(new Date(actualIn), new Date(actualOut), 0);
      // Worked minutes = actual time between check-in and check-out (break is part of the shift, not deducted)
      workedMinutes = worked.totalMinutes;

      // Calculate overtime
      if (workedMinutes > effectiveWorkingMinutes) {
        overtimeMinutes = workedMinutes - effectiveWorkingMinutes;
      }
    }

    // If no check-in at all → absent
    if (!actualIn && !actualOut) {
      recordStatus = 'ABSENT';
    }

    // If checked in but never checked out → incomplete
    if (actualIn && !actualOut) {
      recordStatus = 'INCOMPLETE';
    }

    // PG columns: id, tenantId, employeeId, date, shiftId, checkIn (NOT 'actualIn'),
    // checkOut (NOT 'actualOut'), status, workingMinutes, lateMinutes, earlyLeaveMinutes,
    // overtimeMinutes, source, notes, isApproved, approvedBy, approvedAt,
    // createdAt, updatedAt, createdBy, updatedBy
    // NOT in PG (stripped): scheduledIn, scheduledOut, workingHours, actualIn → checkIn,
    // actualOut → checkOut, workedMinutes → workingMinutes
    const attendanceRecord = {
      tenantId,
      employeeId,
      date: recordDate,
      status: recordStatus,
      checkIn: actualIn ? new Date(actualIn) : null, // PG column is 'checkIn', not 'actualIn'
      checkOut: actualOut ? new Date(actualOut) : null, // PG column is 'checkOut', not 'actualOut'
      workingMinutes: workedMinutes || effectiveWorkingMinutes, // PG column is 'workingMinutes'
      lateMinutes,
      earlyLeaveMinutes,
      overtimeMinutes,
      source,
      notes,
      isApproved: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Check for existing record
    const existingRecord = await db.collection('cvision_attendance').findOne({
      tenantId,
      employeeId,
      date: recordDate,
    });

    let result;
    if (existingRecord) {
      // Update existing record
      result = await db.collection('cvision_attendance').updateOne(
        { tenantId, _id: existingRecord._id },
        {
          $set: {
            ...attendanceRecord,
            updatedAt: new Date(),
          }
        }
      );

      return NextResponse.json({
        success: true,
        data: { id: existingRecord._id, ...attendanceRecord },
        message: 'Attendance record updated',
      });
    } else {
      // Create new record
      result = await db.collection('cvision_attendance').insertOne(attendanceRecord);

      return NextResponse.json({
        success: true,
        data: { id: result.insertedId, ...attendanceRecord },
        message: 'Attendance recorded successfully',
      });
    }

  } catch (error) {
    logger.error('Attendance API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_WRITE }
);
