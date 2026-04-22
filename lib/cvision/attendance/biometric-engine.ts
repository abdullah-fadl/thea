/**
 * CVision Biometric Engine
 *
 * Handles:
 *  - Processing raw biometric logs into attendance records
 *  - GPS-based attendance with geofencing
 *  - Break time tracking
 *  - Device management utilities
 */

import { v4 as uuidv4 } from 'uuid';

// ── Types ───────────────────────────────────────────────────────────────

export interface BiometricDevice {
  _id?: string;
  tenantId: string;
  deviceId: string;
  name: string;
  type: 'FINGERPRINT' | 'FACE_RECOGNITION' | 'RFID' | 'QR_CODE' | 'GPS';
  location: string;
  ipAddress?: string;
  serialNumber?: string;
  status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';
  lastSync: Date;
  employeeCount: number;
}

export interface BiometricLog {
  _id?: string;
  tenantId: string;
  deviceId: string;
  employeeId: string;
  timestamp: Date;
  type: 'CHECK_IN' | 'CHECK_OUT' | 'BREAK_START' | 'BREAK_END';
  method: 'FINGERPRINT' | 'FACE' | 'RFID' | 'QR' | 'GPS' | 'MANUAL';
  verified: boolean;
  gpsCoordinates?: { lat: number; lng: number };
  photoCapture?: string;
  rawData?: string;
}

export interface Geofence {
  _id?: string;
  id: string;
  tenantId: string;
  name: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  address?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

export interface ProcessResult {
  processed: number;
  errors: string[];
}

export interface GPSPunchResult {
  success: boolean;
  message: string;
  location?: string;
  distance?: number;
}

// ── Haversine distance (meters) ─────────────────────────────────────────

export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Process biometric logs → attendance records ─────────────────────────

export async function processBiometricLogs(
  db: any,
  tenantId: string,
  date: string,
): Promise<ProcessResult> {
  const startOfDay = new Date(date + 'T00:00:00');
  const endOfDay = new Date(date + 'T23:59:59');

  const logs: BiometricLog[] = await db
    .collection('cvision_biometric_logs')
    .find({
      tenantId,
      timestamp: { $gte: startOfDay, $lte: endOfDay },
      verified: true,
    })
    .sort({ employeeId: 1, timestamp: 1 })
    .toArray();

  const errors: string[] = [];
  let processed = 0;

  // Group by employee
  const employeeLogs = new Map<string, BiometricLog[]>();
  for (const log of logs) {
    if (!employeeLogs.has(log.employeeId))
      employeeLogs.set(log.employeeId, []);
    employeeLogs.get(log.employeeId)!.push(log);
  }

  for (const [employeeId, empLogs] of employeeLogs) {
    try {
      const checkIns = empLogs.filter((l) => l.type === 'CHECK_IN');
      const checkOuts = empLogs.filter((l) => l.type === 'CHECK_OUT');

      if (checkIns.length === 0) {
        errors.push(`${employeeId}: No check-in found`);
        continue;
      }

      const firstIn = new Date(checkIns[0].timestamp);
      const lastOut =
        checkOuts.length > 0
          ? new Date(checkOuts[checkOuts.length - 1].timestamp)
          : null;

      // Calculate total minutes
      let totalMinutes = 0;
      if (lastOut) {
        totalMinutes = Math.round(
          (lastOut.getTime() - firstIn.getTime()) / 60000,
        );
      }

      // Subtract breaks
      const breakStarts = empLogs.filter((l) => l.type === 'BREAK_START');
      const breakEnds = empLogs.filter((l) => l.type === 'BREAK_END');
      let breakMinutes = 0;
      for (
        let i = 0;
        i < Math.min(breakStarts.length, breakEnds.length);
        i++
      ) {
        breakMinutes += Math.round(
          (new Date(breakEnds[i].timestamp).getTime() -
            new Date(breakStarts[i].timestamp).getTime()) /
            60000,
        );
      }

      const netMinutes = Math.max(0, totalMinutes - breakMinutes);

      // Get employee schedule — check shift assignment first, then employee override, then default
      const employee = await db
        .collection('cvision_employees')
        .findOne({ tenantId, id: employeeId });

      let scheduledStart = '08:00';
      let scheduledEnd = '17:00';

      // 1. Check if employee has a shift assignment for this date
      const shiftEntry = await db.collection('cvision_schedule_entries').findOne({
        tenantId,
        employeeId,
        date,
        isActive: { $ne: false },
      });
      if (shiftEntry?.shiftId) {
        const shift = await db.collection('cvision_shifts').findOne({
          tenantId,
          id: shiftEntry.shiftId,
        });
        if (shift) {
          scheduledStart = shift.startTime || scheduledStart;
          scheduledEnd = shift.endTime || scheduledEnd;
        }
      } else if (employee?.workSchedule?.startTime) {
        // 2. Fallback to employee-level override
        scheduledStart = employee.workSchedule.startTime;
        scheduledEnd = employee.workSchedule.endTime || scheduledEnd;
      }

      // Late/early calculations
      const scheduledStartTime = new Date(
        date + 'T' + scheduledStart + ':00',
      );
      const scheduledEndTime = new Date(
        date + 'T' + scheduledEnd + ':00',
      );

      // Overnight shift detection: if end time is before start time (e.g., 23:00-07:00),
      // the shift crosses midnight so push scheduledEndTime to the next day
      const isOvernightShift = scheduledEndTime.getTime() <= scheduledStartTime.getTime();
      if (isOvernightShift) {
        scheduledEndTime.setDate(scheduledEndTime.getDate() + 1);
      }

      // For overnight shifts, if lastOut is before the scheduled start it means
      // the punch was recorded after midnight (next calendar day relative to shift start)
      let adjustedLastOut = lastOut;
      if (isOvernightShift && lastOut && lastOut.getTime() < scheduledStartTime.getTime()) {
        adjustedLastOut = new Date(lastOut.getTime());
        adjustedLastOut.setDate(adjustedLastOut.getDate() + 1);
      }

      const lateMinutes = Math.max(
        0,
        Math.round(
          (firstIn.getTime() - scheduledStartTime.getTime()) / 60000,
        ),
      );
      const earlyLeaveMinutes = adjustedLastOut
        ? Math.max(
            0,
            Math.round(
              (scheduledEndTime.getTime() - adjustedLastOut.getTime()) / 60000,
            ),
          )
        : 0;

      // Overtime (after scheduled end + 30 min grace)
      const overtimeMinutes = adjustedLastOut
        ? Math.max(
            0,
            Math.round(
              (adjustedLastOut.getTime() - scheduledEndTime.getTime()) / 60000,
            ) - 30,
          )
        : 0;

      // Determine status
      let status: string;
      if (lateMinutes > 15) {
        status = 'LATE';
      } else if (!lastOut) {
        status = 'INCOMPLETE';
      } else {
        status = 'PRESENT';
      }

      // Upsert attendance record
      await db.collection('cvision_attendance').updateOne(
        { tenantId, employeeId, date },
        {
          $set: {
            tenantId,
            employeeId,
            date,
            checkIn: firstIn,
            checkOut: lastOut,
            actualIn: firstIn.toTimeString().slice(0, 5),
            actualOut: lastOut
              ? lastOut.toTimeString().slice(0, 5)
              : null,
            scheduledIn: scheduledStart,
            scheduledOut: scheduledEnd,
            workedMinutes: netMinutes,
            totalMinutes: netMinutes,
            breakMinutes,
            lateMinutes,
            earlyLeaveMinutes,
            overtimeMinutes,
            status,
            source: 'BIOMETRIC',
            punchCount: empLogs.length,
            updatedAt: new Date(),
          },
        },
        { upsert: true },
      );

      processed++;
    } catch (err: any) {
      errors.push(`${employeeId}: ${err.message}`);
    }
  }

  return { processed, errors };
}

// ── GPS-based attendance ────────────────────────────────────────────────

export async function recordGPSAttendance(
  db: any,
  tenantId: string,
  data: {
    employeeId: string;
    type: 'CHECK_IN' | 'CHECK_OUT';
    lat: number;
    lng: number;
    accuracy: number;
  },
): Promise<GPSPunchResult> {
  // Get active geofences
  const geofences: Geofence[] = await db
    .collection('cvision_geofences')
    .find({ tenantId, status: 'ACTIVE' })
    .toArray();

  let withinGeofence = false;
  let matchedLocation = '';
  let closestDistance = Infinity;

  for (const fence of geofences) {
    const distance = calculateDistance(
      data.lat,
      data.lng,
      fence.centerLat,
      fence.centerLng,
    );
    if (distance < closestDistance) closestDistance = distance;
    if (distance <= fence.radiusMeters) {
      withinGeofence = true;
      matchedLocation = fence.name;
      break;
    }
  }

  if (!withinGeofence && geofences.length > 0) {
    return {
      success: false,
      message: `You are not within any approved work location. Closest is ${Math.round(closestDistance)}m away.`,
      distance: Math.round(closestDistance),
    };
  }

  // If no geofences configured, allow punch from anywhere
  if (geofences.length === 0) {
    matchedLocation = 'Unrestricted';
  }

  const now = new Date();

  await db.collection('cvision_biometric_logs').insertOne({
    _id: uuidv4(),
    tenantId,
    deviceId: 'GPS',
    employeeId: data.employeeId,
    timestamp: now,
    type: data.type,
    method: 'GPS' as const,
    verified: true,
    gpsCoordinates: { lat: data.lat, lng: data.lng },
    location: matchedLocation,
    accuracy: data.accuracy,
    createdAt: now,
  });

  // Also update/create attendance record for today
  const today = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().slice(0, 5); // "HH:MM"

  // Resolve scheduled times from shift assignment
  let gpsScheduledIn = '08:00';
  let gpsScheduledOut = '17:00';
  const shiftEntry = await db.collection('cvision_schedule_entries').findOne({
    tenantId, employeeId: data.employeeId, date: today, isActive: { $ne: false },
  });
  if (shiftEntry?.shiftId) {
    const shift = await db.collection('cvision_shifts').findOne({ tenantId, id: shiftEntry.shiftId });
    if (shift) {
      gpsScheduledIn = shift.startTime || gpsScheduledIn;
      gpsScheduledOut = shift.endTime || gpsScheduledOut;
    }
  }

  if (data.type === 'CHECK_IN') {
    await db.collection('cvision_attendance').updateOne(
      { tenantId, employeeId: data.employeeId, date: today },
      {
        $set: {
          tenantId,
          employeeId: data.employeeId,
          date: today,
          actualIn: timeStr,
          checkIn: now,
          source: 'GPS',
          gpsLocation: matchedLocation,
          updatedAt: now,
        },
        $setOnInsert: {
          scheduledIn: gpsScheduledIn,
          scheduledOut: gpsScheduledOut,
          status: 'PRESENT',
          createdAt: now,
        },
      },
      { upsert: true },
    );
  } else {
    // CHECK_OUT
    const existingRecord = await db
      .collection('cvision_attendance')
      .findOne({ tenantId, employeeId: data.employeeId, date: today });

    const updateFields: any = {
      actualOut: timeStr,
      checkOut: now,
      source: 'GPS',
      gpsLocation: matchedLocation,
      updatedAt: now,
    };

    // Calculate worked minutes if we have check-in
    if (existingRecord?.checkIn) {
      const checkInTime = new Date(existingRecord.checkIn);
      const totalMin = Math.round(
        (now.getTime() - checkInTime.getTime()) / 60000,
      );
      // Use actual recorded break minutes if available, otherwise default to 60
      const breakMin = existingRecord.breakMinutes ?? 60;
      updateFields.workedMinutes = Math.max(0, totalMin - breakMin);
      updateFields.totalMinutes = totalMin;
      updateFields.breakMinutes = breakMin;
    }

    await db.collection('cvision_attendance').updateOne(
      { tenantId, employeeId: data.employeeId, date: today },
      {
        $set: updateFields,
        $setOnInsert: {
          scheduledIn: gpsScheduledIn,
          scheduledOut: gpsScheduledOut,
          status: 'PRESENT',
          createdAt: now,
        },
      },
      { upsert: true },
    );
  }

  return {
    success: true,
    message: `${data.type === 'CHECK_IN' ? 'Checked in' : 'Checked out'} at ${matchedLocation}`,
    location: matchedLocation,
    distance: withinGeofence ? Math.round(closestDistance) : 0,
  };
}

// ── Geofence CRUD ───────────────────────────────────────────────────────

export async function createGeofence(
  db: any,
  tenantId: string,
  data: {
    name: string;
    centerLat: number;
    centerLng: number;
    radiusMeters: number;
    address?: string;
  },
): Promise<Geofence> {
  const now = new Date();
  const geofence: Geofence = {
    id: uuidv4(),
    tenantId,
    name: data.name,
    centerLat: data.centerLat,
    centerLng: data.centerLng,
    radiusMeters: data.radiusMeters || 200,
    address: data.address,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };
  await db.collection('cvision_geofences').insertOne(geofence);
  return geofence;
}

export async function updateGeofence(
  db: any,
  tenantId: string,
  geofenceId: string,
  data: Partial<Pick<Geofence, 'name' | 'centerLat' | 'centerLng' | 'radiusMeters' | 'address' | 'status'>>,
): Promise<boolean> {
  const result = await db.collection('cvision_geofences').updateOne(
    { tenantId, id: geofenceId },
    { $set: { ...data, updatedAt: new Date() } },
  );
  return result.matchedCount > 0;
}

export async function listGeofences(
  db: any,
  tenantId: string,
): Promise<Geofence[]> {
  return db
    .collection('cvision_geofences')
    .find({ tenantId })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function deleteGeofence(
  db: any,
  tenantId: string,
  geofenceId: string,
): Promise<boolean> {
  const result = await db
    .collection('cvision_geofences')
    .deleteOne({ tenantId, id: geofenceId });
  return result.deletedCount > 0;
}
