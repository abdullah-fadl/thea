import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Self-Service Leave API
 * GET  /api/cvision/self-service/leave - View own leave requests & balance
 * POST /api/cvision/self-service/leave - Submit leave request
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import { calculateLeaveDays, validateLeaveRequest, SAUDI_LEAVE_ENTITLEMENTS, calculateAnnualEntitlement } from '@/lib/cvision/leaves';
import { logCVisionAudit, createCVisionAuditContext } from '@/lib/cvision/audit';

export const dynamic = 'force-dynamic';

async function resolveEmployee(db: any, tenantId: string, userId: string) {
  let emp = await db.collection('cvision_employees').findOne({ tenantId, id: userId, deletedAt: null });
  if (!emp) emp = await db.collection('cvision_employees').findOne({ tenantId, userId, deletedAt: null });
  if (!emp) {
    try {
      const userDoc = await db.collection('cvision_tenant_users').findOne({ tenantId, userId });
      if (userDoc?.email) {
        emp = await db.collection('cvision_employees').findOne({ tenantId, email: userDoc.email, deletedAt: null });
      }
    } catch { /* non-critical */ }
  }
  return emp;
}

// GET - View own leave requests and balance
export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId, userId }) => {
    try {
      const { searchParams } = new URL(request.url);
      const action = searchParams.get('action') || 'list';
      const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

      const db = await getCVisionDb(tenantId);
      const employee = await resolveEmployee(db, tenantId, userId);

      if (!employee) {
        return NextResponse.json({ success: false, error: 'Employee record not found' }, { status: 404 });
      }

      const empId = (employee as any).id;

      if (action === 'balance') {
        const balances = await db.collection('cvision_leave_balances')
          .find({ tenantId, employeeId: empId, year })
          .toArray();

        const hireDate = new Date((employee as any).hiredAt || (employee as any).createdAt);
        const yearsOfService = (Date.now() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365);

        return NextResponse.json({
          success: true,
          data: {
            year,
            annualEntitlement: calculateAnnualEntitlement(yearsOfService),
            balances: balances.map((b: any) => ({
              leaveType: b.leaveType,
              entitled: b.entitled || 0,
              used: b.used || 0,
              pending: b.pending || 0,
              available: (b.entitled || 0) - (b.used || 0) - (b.pending || 0),
            })),
            entitlements: SAUDI_LEAVE_ENTITLEMENTS,
          },
        });
      }

      // Default: list my leave requests
      const status = searchParams.get('status');
      const filter: any = { tenantId, employeeId: empId };
      if (status) filter.status = status;

      const leaves = await db.collection('cvision_leaves')
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray();

      return NextResponse.json({ success: true, data: leaves });
    } catch (error: any) {
      logger.error('[CVision Self-Service Leave GET]', error?.message || String(error));
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.SELF_SERVICE }
);

// POST - Submit leave request
export const POST = withAuthTenant(
  async (request: NextRequest, { tenantId, userId, role, user }) => {
    try {
      const body = await request.json();
      const { leaveType, startDate, endDate, reason, attachmentUrl } = body;

      if (!leaveType || !startDate || !endDate) {
        return NextResponse.json(
          { success: false, error: 'leaveType, startDate, and endDate are required' },
          { status: 400 }
        );
      }

      const db = await getCVisionDb(tenantId);
      const employee = await resolveEmployee(db, tenantId, userId);

      if (!employee) {
        return NextResponse.json({ success: false, error: 'Employee record not found' }, { status: 404 });
      }

      const empId = (employee as any).id;
      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysResult = calculateLeaveDays(start, end);
      const days = daysResult.workingDays;

      if (days <= 0) {
        return NextResponse.json({ success: false, error: 'Invalid date range' }, { status: 400 });
      }

      // Validate leave request
      const year = start.getFullYear();
      const hireDate = new Date((employee as any).hiredAt || (employee as any).createdAt);
      const yearsOfService = (Date.now() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365);

      const balance = await db.collection('cvision_leave_balances').findOne({
        tenantId, employeeId: empId, year, leaveType,
      });

      const existingLeaves = await db.collection('cvision_leaves')
        .find({
          tenantId, employeeId: empId,
          status: { $in: ['PENDING', 'APPROVED'] },
          $or: [
            { startDate: { $lte: endDate }, endDate: { $gte: startDate } },
          ],
        })
        .toArray();

      if (existingLeaves.length > 0) {
        return NextResponse.json(
          { success: false, error: 'Overlapping leave request exists for this period' },
          { status: 400 }
        );
      }

      // Check balance
      if (balance) {
        const available = (balance as any).entitled - (balance as any).used - (balance as any).pending;
        if (days > available) {
          return NextResponse.json(
            { success: false, error: `Insufficient leave balance. Available: ${available} days, Requested: ${days} days` },
            { status: 400 }
          );
        }
      }

      const leaveId = uuidv4();
      const leaveRecord = {
        id: leaveId,
        tenantId,
        employeeId: empId,
        leaveType,
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
        days,
        totalDays: days,
        reason: reason || '',
        attachmentUrl: attachmentUrl || null,
        status: 'PENDING',
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      await db.collection('cvision_leaves').insertOne(leaveRecord);

      // Update pending balance
      if (balance) {
        await db.collection('cvision_leave_balances').updateOne(
          { tenantId, employeeId: empId, year, leaveType },
          { $inc: { pending: days }, $set: { updatedAt: new Date() } }
        );
      }

      const auditCtx = createCVisionAuditContext({ userId, role, tenantId, user }, request);
      await logCVisionAudit(auditCtx, 'leave_request_create', 'leave', {
        resourceId: leaveId,
        metadata: { employeeId: empId, leaveType, days, startDate, endDate },
      });

      return NextResponse.json({
        success: true,
        data: leaveRecord,
        message: 'Leave request submitted successfully',
      }, { status: 201 });
    } catch (error: any) {
      logger.error('[CVision Self-Service Leave POST]', error?.message || String(error));
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.SELF_SERVICE }
);
