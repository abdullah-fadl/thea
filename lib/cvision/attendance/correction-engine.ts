import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Attendance Correction Engine
 *
 * Handles:
 *  - Correction request submission
 *  - Manager approval / rejection workflow
 *  - Applying approved corrections to attendance records
 *  - Notification generation
 */

import { v4 as uuidv4 } from 'uuid';

// ── Types ───────────────────────────────────────────────────────────────

export interface AttendanceCorrection {
  _id?: string;
  id: string;
  tenantId: string;
  correctionId: string;
  employeeId: string;
  employeeName?: string;
  date: string;
  type: 'MISSED_PUNCH' | 'WRONG_TIME' | 'SYSTEM_ERROR' | 'WORK_FROM_HOME';
  originalCheckIn?: string;
  originalCheckOut?: string;
  correctedCheckIn?: string;
  correctedCheckOut?: string;
  reason: string;
  evidence?: string;
  requestedBy: string;
  requestedAt: Date;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
}

export const CORRECTION_TYPES = [
  { value: 'MISSED_PUNCH', label: 'Missed Punch' },
  { value: 'WRONG_TIME', label: 'Wrong Time Recorded' },
  { value: 'SYSTEM_ERROR', label: 'System Error' },
  { value: 'WORK_FROM_HOME', label: 'Work From Home' },
] as const;

// ── Request a correction ────────────────────────────────────────────────

export async function requestCorrection(
  db: any,
  tenantId: string,
  data: {
    employeeId: string;
    employeeName?: string;
    date: string;
    type: string;
    originalCheckIn?: string;
    originalCheckOut?: string;
    correctedCheckIn?: string;
    correctedCheckOut?: string;
    reason?: string;
    evidence?: string;
    requestedBy: string;
  },
): Promise<{ correctionId: string; id: string }> {
  const now = new Date();
  const correctionId = `COR-${Date.now()}`;
  const id = uuidv4();

  // Build original/corrected value strings for PG schema
  // PG columns: id, tenantId, attendanceId, employeeId, correctionType,
  //             originalValue, correctedValue, reason, status,
  //             approvedBy, approvedAt, createdAt, updatedAt, createdBy, updatedBy
  const originalValue = data.type === 'checkOut' || data.type === 'WRONG_TIME'
    ? (data.originalCheckOut || data.originalCheckIn || null)
    : (data.originalCheckIn || data.originalCheckOut || null);
  const correctedValue = data.type === 'checkOut' || data.type === 'WRONG_TIME'
    ? (data.correctedCheckOut || data.correctedCheckIn || '')
    : (data.correctedCheckIn || data.correctedCheckOut || '');

  // Find existing attendance record to get attendanceId
  let attendanceId: string | null = null;
  try {
    const attendanceRecord = await db.collection('cvision_attendance').findOne({
      tenantId,
      employeeId: data.employeeId,
    });
    if (attendanceRecord) {
      attendanceId = attendanceRecord.id || attendanceRecord._id?.toString() || null;
    }
  } catch {
    // If no attendance record found, use a placeholder
  }

  await db.collection('cvision_attendance_corrections').insertOne({
    id,
    tenantId,
    attendanceId: attendanceId || id, // PG requires attendanceId; use self-ref as fallback
    employeeId: data.employeeId,
    correctionType: data.type || 'WRONG_TIME', // PG column is 'correctionType', not 'type'
    originalValue: originalValue,
    correctedValue: correctedValue || 'N/A',
    reason: data.reason || 'Attendance correction',
    status: 'PENDING',
    createdBy: data.requestedBy,
    createdAt: now,
    updatedAt: now,
  });

  // Notify manager
  await db.collection('cvision_notifications').insertOne({
    id: uuidv4(),
    tenantId,
    type: 'ATTENDANCE_CORRECTION',
    title: 'Attendance Correction Request',
    message: `${data.employeeName || data.employeeId} requested attendance correction for ${data.date}`,
    targetRole: 'MANAGER',
    relatedId: id,
    isRead: false,
    createdAt: now,
  });

  return { correctionId, id };
}

// ── Approve a correction ────────────────────────────────────────────────

export async function approveCorrection(
  db: any,
  tenantId: string,
  correctionId: string,
  approvedBy: string,
): Promise<{ success: boolean; error?: string }> {
  // Look up by `id` (UUID). The `correctionId` field (COR-xxx) is not a PG column.
  const correction = await db
    .collection('cvision_attendance_corrections')
    .findOne({
      tenantId,
      id: correctionId,
    });

  if (!correction) {
    return { success: false, error: 'Correction not found' };
  }

  if (correction.status !== 'PENDING') {
    return {
      success: false,
      error: `Correction is already ${correction.status.toLowerCase()}`,
    };
  }

  const now = new Date();

  // Update correction status
  await db.collection('cvision_attendance_corrections').updateOne(
    { tenantId, id: correctionId },
    {
      $set: {
        status: 'APPROVED',
        approvedBy,
        approvedAt: now,
        updatedAt: now,
      },
    },
  );

  // ── Apply correction to attendance record ──
  // PG correction record has: correctionType, originalValue, correctedValue, attendanceId
  // Try to find the linked attendance record and apply the corrected value

  try {
    const attendanceId = correction.attendanceId;
    if (attendanceId) {
      const existingRecord = await db
        .collection('cvision_attendance')
        .findOne({ tenantId, id: attendanceId });

      if (existingRecord) {
        const corrType = correction.correctionType || '';
        const correctedVal = correction.correctedValue || '';
        const updateFields: any = {
          updatedAt: now,
          source: 'CORRECTION',
        };

        // Apply the corrected value to the appropriate attendance field
        if (corrType === 'checkOut' || corrType === 'WRONG_TIME' || corrType === 'check_out') {
          if (correctedVal) {
            // Try to build a full datetime from correctedValue (may be HH:mm or ISO)
            const dateStr = existingRecord.date instanceof Date
              ? existingRecord.date.toISOString().split('T')[0]
              : String(existingRecord.date).split('T')[0];
            const fullDate = correctedVal.includes('T')
              ? new Date(correctedVal)
              : new Date(`${dateStr}T${correctedVal}:00`);
            if (!isNaN(fullDate.getTime())) {
              updateFields.checkOut = fullDate;
            }
          }
        } else if (corrType === 'checkIn' || corrType === 'check_in' || corrType === 'MISSED_PUNCH') {
          if (correctedVal) {
            const dateStr = existingRecord.date instanceof Date
              ? existingRecord.date.toISOString().split('T')[0]
              : String(existingRecord.date).split('T')[0];
            const fullDate = correctedVal.includes('T')
              ? new Date(correctedVal)
              : new Date(`${dateStr}T${correctedVal}:00`);
            if (!isNaN(fullDate.getTime())) {
              updateFields.checkIn = fullDate;
            }
          }
        }

        await db.collection('cvision_attendance').updateOne(
          { tenantId, id: attendanceId },
          { $set: updateFields },
        );
      }
    }
  } catch (applyErr) {
    // Non-fatal: correction approval itself succeeded even if attendance update fails
    logger.warn('[CorrectionEngine] Failed to apply correction to attendance record:', applyErr);
  }

  // Notify employee
  await db.collection('cvision_notifications').insertOne({
    id: uuidv4(),
    tenantId,
    type: 'CORRECTION_APPROVED',
    title: 'Correction Approved',
    message: `Your attendance correction has been approved`,
    targetEmployeeId: correction.employeeId,
    isRead: false,
    createdAt: now,
  });

  return { success: true };
}

// ── Reject a correction ─────────────────────────────────────────────────

export async function rejectCorrection(
  db: any,
  tenantId: string,
  correctionId: string,
  rejectedBy: string,
  rejectionReason: string,
): Promise<{ success: boolean; error?: string }> {
  // Look up by `id` (UUID). The `correctionId` field (COR-xxx) is not a PG column.
  const correction = await db
    .collection('cvision_attendance_corrections')
    .findOne({
      tenantId,
      id: correctionId,
    });

  if (!correction) {
    return { success: false, error: 'Correction not found' };
  }

  if (correction.status !== 'PENDING') {
    return {
      success: false,
      error: `Correction is already ${correction.status.toLowerCase()}`,
    };
  }

  const now = new Date();

  await db.collection('cvision_attendance_corrections').updateOne(
    { tenantId, id: correctionId },
    {
      $set: {
        status: 'REJECTED',
        approvedBy: rejectedBy,
        approvedAt: now,
        updatedAt: now,
      },
    },
  );

  // Notify employee
  await db.collection('cvision_notifications').insertOne({
    id: uuidv4(),
    tenantId,
    type: 'CORRECTION_REJECTED',
    title: 'Correction Rejected',
    message: `Your attendance correction was rejected: ${rejectionReason}`,
    targetEmployeeId: correction.employeeId,
    isRead: false,
    createdAt: now,
  });

  return { success: true };
}

// ── List corrections ────────────────────────────────────────────────────

export async function listCorrections(
  db: any,
  tenantId: string,
  filters: {
    status?: string;
    employeeId?: string;
    month?: string; // YYYY-MM
    limit?: number;
  } = {},
): Promise<AttendanceCorrection[]> {
  const query: any = { tenantId };
  if (filters.status) query.status = filters.status;
  if (filters.employeeId) query.employeeId = filters.employeeId;
  // Note: PG schema has no 'date' column — month filter skipped for now

  return db
    .collection('cvision_attendance_corrections')
    .find(query)
    .sort({ createdAt: -1 })
    .limit(filters.limit || 100)
    .toArray();
}
