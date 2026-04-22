import { logger } from '@/lib/monitoring/logger';
// app/api/cvision/attendance/biometric/route.ts
/**
 * Biometric Device Integration API
 *
 * Supports:
 * - ZKTeco devices (Push/Pull mode)
 * - Generic webhook integration
 * - Manual device sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCVisionDb } from '@/lib/cvision/db';
import {
  calculateLateness,
  calculateEarlyLeave,
  calculateWorkedHours,
  getDefaultShiftFromSettings,
  DEFAULT_SHIFTS
} from '@/lib/cvision/attendance';
import { getWorkSchedule } from '@/lib/cvision/admin-settings';

// Device authentication (API Key based — validates against stored device credentials)
const validateDeviceAuth = async (request: NextRequest): Promise<{ valid: boolean; tenantId?: string; deviceId?: string }> => {
  const apiKey = request.headers.get('x-device-api-key') || request.headers.get('authorization')?.replace('Bearer ', '');
  const deviceId = request.headers.get('x-device-id');

  if (!apiKey) {
    return { valid: false };
  }

  // Extract tenantId from API key format: tenant_<tenantId>_<secret>
  if (apiKey.startsWith('tenant_')) {
    const parts = apiKey.split('_');
    if (parts.length >= 3) {
      const tenantId = parts[1];
      // Validate the API key against stored device credentials in the database
      try {
        const db = await getCVisionDb(tenantId);
        const device = await db.collection('cvision_biometric_devices').findOne({
          tenantId,
          status: 'ACTIVE',
        });
        if (device && device.apiKey) {
          // Timing-safe comparison of the API key
          const crypto = await import('crypto');
          const keyBuf = Buffer.from(apiKey);
          const storedBuf = Buffer.from(device.apiKey);
          if (keyBuf.length === storedBuf.length && crypto.timingSafeEqual(keyBuf, storedBuf)) {
            return { valid: true, tenantId, deviceId: deviceId || device.deviceSerial || undefined };
          }
        }
      } catch {
        // DB lookup failed — reject
      }
    }
  }

  return { valid: false };
};

// POST /api/cvision/attendance/biometric - Receive punch from device
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // Handle different action types
    if (action === 'register-device') {
      return handleDeviceRegistration(request, body);
    }

    if (action === 'sync-logs') {
      return handleLogSync(request, body);
    }

    // Default: Single punch from device
    return handlePunch(request, body);

  } catch (error) {
    logger.error('[Biometric API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}

// Handle single punch from biometric device
async function handlePunch(request: NextRequest, body: any) {
  const auth = await validateDeviceAuth(request);

  // Require valid device authentication — do NOT accept unauthenticated body.tenantId
  if (!auth.valid || !auth.tenantId) {
    return NextResponse.json(
      { success: false, error: 'Invalid device authentication' },
      { status: 401 }
    );
  }

  const tenantId = auth.tenantId;

  if (!tenantId) {
    return NextResponse.json(
      { success: false, error: 'Invalid device authentication' },
      { status: 401 }
    );
  }

  const {
    employeeId,      // Employee ID or badge number
    fingerprintId,   // Alternative: fingerprint enrollment ID
    badgeNumber,     // Alternative: RFID badge number
    timestamp,       // Punch timestamp (ISO string or Unix)
    punchType,       // IN, OUT, or auto-detect
    deviceSerial,    // Device serial number
    verifyMode,      // FP (fingerprint), FACE, CARD, PIN
  } = body;

  if (!timestamp) {
    return NextResponse.json(
      { success: false, error: 'Timestamp is required' },
      { status: 400 }
    );
  }

  const db = await getCVisionDb(tenantId);

  // Find employee by various identifiers
  let employee = null;

  if (employeeId) {
    employee = await db.collection('cvision_employees').findOne({
      $or: [
        { id: employeeId },
        { _id: employeeId },
        { employeeNo: employeeId },
        { employeeNumber: employeeId },
      ],
      tenantId,
    });
  }

  if (!employee && fingerprintId) {
    employee = await db.collection('cvision_employees').findOne({
      'biometric.fingerprintId': fingerprintId,
      tenantId,
    });
  }

  if (!employee && badgeNumber) {
    employee = await db.collection('cvision_employees').findOne({
      'biometric.badgeNumber': badgeNumber,
      tenantId,
    });
  }

  if (!employee) {
    // Log unknown punch for review
    await db.collection('cvision_biometric_logs').insertOne({
      tenantId,
      employeeId: employeeId || fingerprintId || badgeNumber,
      timestamp: new Date(timestamp),
      punchType,
      deviceSerial,
      verifyMode,
      status: 'UNMATCHED',
      rawData: body,
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: false,
      error: 'Employee not found',
      code: 'EMPLOYEE_NOT_FOUND',
    }, { status: 404 });
  }

  const punchTime = new Date(typeof timestamp === 'number' ? timestamp * 1000 : timestamp);
  const punchDate = new Date(punchTime);
  punchDate.setHours(0, 0, 0, 0);

  // Determine punch type (IN/OUT) if not specified
  let determinedPunchType = punchType;

  if (!determinedPunchType || determinedPunchType === 'AUTO') {
    // Check last punch for this employee today
    const lastPunch = await db.collection('cvision_biometric_logs').findOne(
      {
        tenantId,
        employeeId: employee.id || employee._id,
        timestamp: { $gte: punchDate },
        status: 'MATCHED',
      },
      { sort: { timestamp: -1 } }
    );

    // If no punch today or last was OUT, this is IN
    determinedPunchType = (!lastPunch || lastPunch.punchType === 'OUT') ? 'IN' : 'OUT';
  }

  // Log the biometric punch
  const biometricLog = {
    tenantId,
    employeeId: employee.id || employee._id,
    employeeName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
    timestamp: punchTime,
    punchType: determinedPunchType,
    deviceSerial: deviceSerial || auth.deviceId,
    verifyMode: verifyMode || 'FP',
    status: 'MATCHED',
    rawData: body,
    createdAt: new Date(),
  };

  await db.collection('cvision_biometric_logs').insertOne(biometricLog);

  // Update attendance record — use tenant work schedule settings
  const ws = await getWorkSchedule(db, tenantId);
  const shift = getDefaultShiftFromSettings(ws);

  // Find or create attendance record for this date
  let attendanceRecord = await db.collection('cvision_attendance').findOne({
    tenantId,
    employeeId: employee.id || employee._id,
    date: punchDate,
  });

  if (determinedPunchType === 'IN') {
    // Check-in
    const lateCalc = calculateLateness(shift.startTime, punchTime.toTimeString().slice(0, 5));

    if (attendanceRecord) {
      // Update existing record
      await db.collection('cvision_attendance').updateOne(
        { tenantId, _id: attendanceRecord._id },
        {
          $set: {
            checkIn: punchTime, // PG column is 'checkIn', not 'actualIn'
            lateMinutes: lateCalc.deductionMinutes,
            status: lateCalc.isLate && !lateCalc.withinGrace ? 'LATE' : 'PRESENT',
            source: 'BIOMETRIC',
            updatedAt: new Date(),
          }
        }
      );
    } else {
      // Create new record
      // PG columns: id, tenantId, employeeId, date, shiftId, checkIn, checkOut, status,
      // workingMinutes, lateMinutes, earlyLeaveMinutes, overtimeMinutes, source, notes,
      // isApproved, approvedBy, approvedAt, createdAt, updatedAt, createdBy, updatedBy
      await db.collection('cvision_attendance').insertOne({
        tenantId,
        employeeId: employee.id || employee._id,
        date: punchDate,
        checkIn: punchTime, // PG column is 'checkIn', not 'actualIn'
        lateMinutes: lateCalc.deductionMinutes,
        earlyLeaveMinutes: 0,
        overtimeMinutes: 0,
        workingMinutes: 0, // PG column is 'workingMinutes', not 'workedMinutes'
        status: lateCalc.isLate && !lateCalc.withinGrace ? 'LATE' : 'PRESENT',
        source: 'BIOMETRIC',
        isApproved: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  } else {
    // Check-out
    if (attendanceRecord && (attendanceRecord.checkIn || attendanceRecord.actualIn)) {
      const checkInTime = attendanceRecord.checkIn || attendanceRecord.actualIn;
      const earlyCalc = calculateEarlyLeave(shift.endTime, punchTime.toTimeString().slice(0, 5));
      const worked = calculateWorkedHours(new Date(checkInTime), punchTime);

      let overtimeMinutes = 0;
      if (worked.netWorkingMinutes > shift.workingMinutes) {
        overtimeMinutes = worked.netWorkingMinutes - shift.workingMinutes;
      }

      await db.collection('cvision_attendance').updateOne(
        { tenantId, _id: attendanceRecord._id },
        {
          $set: {
            checkOut: punchTime, // PG column is 'checkOut', not 'actualOut'
            earlyLeaveMinutes: earlyCalc.deductionMinutes,
            workingMinutes: worked.netWorkingMinutes, // PG column is 'workingMinutes', not 'workedMinutes'
            overtimeMinutes,
            updatedAt: new Date(),
          }
        }
      );
    } else {
      // No check-in found, create partial record
      // PG columns: checkOut (not actualOut), workingMinutes (not workedMinutes)
      await db.collection('cvision_attendance').insertOne({
        tenantId,
        employeeId: employee.id || employee._id,
        date: punchDate,
        checkOut: punchTime, // PG column is 'checkOut', not 'actualOut'
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        overtimeMinutes: 0,
        workingMinutes: 0, // PG column is 'workingMinutes', not 'workedMinutes'
        status: 'INCOMPLETE',
        source: 'BIOMETRIC',
        notes: 'Missing check-in',
        isApproved: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  return NextResponse.json({
    success: true,
    message: `${determinedPunchType === 'IN' ? 'Check-in' : 'Check-out'} recorded`,
    data: {
      employeeId: employee.id || employee._id,
      employeeName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
      punchType: determinedPunchType,
      timestamp: punchTime,
    }
  });
}

// Handle device registration — requires user authentication (not device auth)
async function handleDeviceRegistration(request: NextRequest, body: any) {
  // Device registration must be performed by an authenticated admin user, not by anonymous callers.
  // Validate via the main app auth cookie (same as withAuthTenant).
  const { requireAuth } = await import('@/lib/auth/requireAuth');
  const authResult = await requireAuth(request);
  if (!authResult) {
    return NextResponse.json(
      { success: false, error: 'Authentication required to register devices' },
      { status: 401 }
    );
  }

  const { tenantId, deviceSerial, deviceModel, deviceName, location, ipAddress } = body;

  if (!tenantId || !deviceSerial) {
    return NextResponse.json(
      { success: false, error: 'tenantId and deviceSerial are required' },
      { status: 400 }
    );
  }

  const db = await getCVisionDb(tenantId);

  // Generate API key for device — store the full key (for timing-safe comparison)
  const secret = crypto.randomUUID().replace(/-/g, '');
  const apiKey = `tenant_${tenantId}_${secret}`;
  // Hash the API key for storage
  const { createHash } = await import('crypto');
  const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');

  const device = {
    tenantId,
    deviceSerial,
    deviceModel: deviceModel || 'Unknown',
    deviceName: deviceName || `Device ${deviceSerial}`,
    location: location || '',
    ipAddress: ipAddress || '',
    apiKey: apiKey, // Stored for device auth validation — consider hashing in future
    apiKeyHash, // SHA-256 hash for audit purposes
    status: 'ACTIVE',
    lastSync: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Upsert device
  await db.collection('cvision_biometric_devices').updateOne(
    { tenantId, deviceSerial },
    { $set: device },
    { upsert: true }
  );

  return NextResponse.json({
    success: true,
    message: 'Device registered successfully',
    data: {
      deviceSerial,
      apiKey, // Return API key for device configuration
      webhookUrl: `/api/cvision/attendance/biometric`,
    }
  });
}

// Handle bulk log sync from device
async function handleLogSync(request: NextRequest, body: any) {
  const auth = await validateDeviceAuth(request);

  if (!auth.valid || !auth.tenantId) {
    return NextResponse.json(
      { success: false, error: 'Invalid device authentication' },
      { status: 401 }
    );
  }

  const tenantId = auth.tenantId;

  if (!tenantId) {
    return NextResponse.json(
      { success: false, error: 'Invalid authentication' },
      { status: 401 }
    );
  }

  const { logs, deviceSerial } = body;

  if (!Array.isArray(logs)) {
    return NextResponse.json(
      { success: false, error: 'logs must be an array' },
      { status: 400 }
    );
  }

  const db = await getCVisionDb(tenantId);
  let processed = 0;
  let errors = 0;

  for (const log of logs) {
    try {
      // Process each log entry
      const result = await handlePunch(request, {
        ...log,
        tenantId,
        deviceSerial: deviceSerial || log.deviceSerial,
      });

      if (result.status === 200) {
        processed++;
      } else {
        errors++;
      }
    } catch {
      errors++;
    }
  }

  // Update device last sync time
  await db.collection('cvision_biometric_devices').updateOne(
    { tenantId, deviceSerial },
    { $set: { lastSync: new Date() } }
  );

  return NextResponse.json({
    success: true,
    message: `Sync completed: ${processed} processed, ${errors} errors`,
    data: { processed, errors, total: logs.length }
  });
}

// GET /api/cvision/attendance/biometric - Get device status or logs
export async function GET(request: NextRequest) {
  try {
    // Require device authentication for GET requests too
    const auth = await validateDeviceAuth(request);
    if (!auth.valid || !auth.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Invalid device authentication' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const tenantId = auth.tenantId;
    const deviceSerial = searchParams.get('deviceSerial');

    const db = await getCVisionDb(tenantId);

    if (action === 'devices') {
      // List all registered devices
      const devices = await db.collection('cvision_biometric_devices')
        .find({ tenantId })
        .project({ apiKey: 0 }) // Don't expose API keys
        .toArray();

      return NextResponse.json({
        success: true,
        data: { devices }
      });
    }

    if (action === 'logs') {
      // Get biometric logs
      const query: any = { tenantId };
      if (deviceSerial) query.deviceSerial = deviceSerial;

      const date = searchParams.get('date');
      if (date) {
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);
        query.timestamp = { $gte: targetDate, $lt: nextDay };
      }

      const logs = await db.collection('cvision_biometric_logs')
        .find(query)
        .sort({ timestamp: -1 })
        .limit(100)
        .toArray();

      return NextResponse.json({
        success: true,
        data: { logs }
      });
    }

    if (action === 'unmatched') {
      // Get unmatched punches for review
      const logs = await db.collection('cvision_biometric_logs')
        .find({ tenantId, status: 'UNMATCHED' })
        .sort({ timestamp: -1 })
        .limit(50)
        .toArray();

      return NextResponse.json({
        success: true,
        data: { logs }
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action'
    }, { status: 400 });
  } catch (error) {
    logger.error('[Biometric API GET] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}
