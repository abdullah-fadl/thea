import { logger } from '@/lib/monitoring/logger';
// app/api/cvision/leaves/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import { getCVisionDb } from '@/lib/cvision/db';
import {
  calculateAnnualEntitlement,
  calculateLeaveDays,
  validateLeaveRequest,
  SAUDI_LEAVE_ENTITLEMENTS,
} from '@/lib/cvision/leaves';
import { onRequestCreated } from '@/lib/cvision/lifecycle';

// GET /api/cvision/leaves - List leaves
export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId }) => {
    try {
      const { searchParams } = new URL(request.url);

      const employeeId = searchParams.get('employeeId');
      const status = searchParams.get('status');
      const type = searchParams.get('type');
      const year = searchParams.get('year');
      const action = searchParams.get('action');

      const db = await getCVisionDb(tenantId);

      // Get entitlements
      if (action === 'entitlements') {
        return NextResponse.json({
          success: true,
          data: {
            entitlements: SAUDI_LEAVE_ENTITLEMENTS,
            description: {
              ANNUAL: 'Annual Leave',
              MARRIAGE: 'Marriage Leave',
              PATERNITY: 'Paternity Leave',
              BEREAVEMENT: 'Bereavement Leave',
              MATERNITY: 'Maternity Leave',
              HAJJ: 'Hajj Leave',
              SICK_PAID_FULL: 'Sick Leave (Fully Paid)',
              SICK_PAID_75: 'Sick Leave (75% Paid)',
              SICK_UNPAID: 'Sick Leave (Unpaid)',
            },
          },
        });
      }

      // Get leave balance
      if (action === 'balance' && employeeId) {
        const balances = await db.collection('cvision_leave_balances').find({
          tenantId,
          employeeId,
          year: year ? parseInt(year) : new Date().getFullYear(),
        }).limit(5000).toArray();

        const employee = await db.collection('cvision_employees').findOne({
          id: employeeId,
          tenantId,
        });

        if (!employee) {
          return NextResponse.json(
            { success: false, error: 'Employee not found' },
            { status: 404 }
          );
        }

        // Calculate years of service
        const startDate = new Date(employee.hiredAt || employee.createdAt);
        const yearsOfService = (Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365);

        // Annual entitlement
        const annualEntitlement = calculateAnnualEntitlement(yearsOfService);

        return NextResponse.json({
          success: true,
          data: {
            employeeId,
            yearsOfService: Math.round(yearsOfService * 100) / 100,
            annualEntitlement,
            balances,
          },
        });
      }

      // Build query
      const query: any = { tenantId, deletedAt: null };

      if (employeeId) query.employeeId = employeeId;
      if (status) query.status = status;
      if (type) query.leaveType = type;
      if (year) {
        const startOfYear = new Date(parseInt(year), 0, 1);
        const endOfYear = new Date(parseInt(year), 11, 31);
        query.startDate = { $gte: startOfYear, $lte: endOfYear };
      }

      const leaves = await db.collection('cvision_leaves')
        .find(query)
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray();

      // Enrich with employee names
      const employeeIds = [...new Set(leaves.map((l: any) => l.employeeId).filter(Boolean))];
      const employees = employeeIds.length > 0
        ? await db.collection('cvision_employees')
            .find({ tenantId, id: { $in: employeeIds }, deletedAt: null })
            .limit(5000)
            .toArray()
        : [];

      const employeeMap = new Map(employees.map((e: any) => [e.id, e]));

      // Resolve department names
      const deptIds = [...new Set(employees.map((e: any) => e.departmentId).filter(Boolean))];
      const deptDocs = deptIds.length > 0
        ? await db.collection('cvision_departments').find({ tenantId, id: { $in: deptIds } }).project({ id: 1, name: 1 }).toArray()
        : [];
      const deptMap = new Map(deptDocs.map((d: any) => [d.id, d.name]));

      const enrichedLeaves = leaves.map((leave: any) => {
        const employee = employeeMap.get(leave.employeeId);
        return {
          ...leave,
          id: leave._id?.toString() || leave.id,
          employeeName: employee
            ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.email
            : null,
          departmentName: employee ? deptMap.get(employee.departmentId) || null : null,
        };
      });

      return NextResponse.json({
        success: true,
        data: { leaves: enrichedLeaves, total: enrichedLeaves.length },
      });

    } catch (error) {
      logger.error('Leaves API Error:', error);
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_READ }
);

// POST /api/cvision/leaves - Create leave request
export const POST = withAuthTenant(
  async (request: NextRequest, { tenantId }) => {
    try {
      const body = await request.json();
      const { action } = body;

      const db = await getCVisionDb(tenantId);

      // Calculate leave days
      if (action === 'calculate-days') {
        const { startDate, endDate, excludeFridays = true } = body;

        if (!startDate || !endDate) {
          return NextResponse.json(
            { success: false, error: 'Start date and end date are required' },
            { status: 400 }
          );
        }

        const calculation = calculateLeaveDays(
          new Date(startDate),
          new Date(endDate),
          excludeFridays
        );

        return NextResponse.json({
          success: true,
          data: calculation,
        });
      }

      // Validate request
      if (action === 'validate') {
        const { employeeId, type, startDate, endDate, requestedDays } = body;

        const employee = await db.collection('cvision_employees').findOne({
          id: employeeId,
          tenantId,
        });

        if (!employee) {
          return NextResponse.json(
            { success: false, error: 'Employee not found' },
            { status: 404 }
          );
        }

        // Get balance for the leave's start year
        const balance = await db.collection('cvision_leave_balances').findOne({
          tenantId,
          employeeId,
          year: new Date(startDate).getFullYear(),
          leaveType: type,
        });

        const availableBalance = balance
          ? balance.entitled + balance.carriedOver - balance.used - balance.pending
          : 0;

        // Get existing leaves
        const existingLeaves = await db.collection('cvision_leaves').find({
          tenantId,
          employeeId,
          status: { $in: ['PENDING', 'APPROVED'] },
          deletedAt: null,
        }).limit(5000).toArray();

        const validation = validateLeaveRequest(
          type,
          new Date(startDate),
          new Date(endDate),
          availableBalance,
          requestedDays,
          new Date(employee.hiredAt || employee.createdAt),
          existingLeaves.map((l: any) => ({ startDate: l.startDate, endDate: l.endDate }))
        );

        return NextResponse.json({
          success: true,
          data: {
            validation,
            availableBalance,
          },
        });
      }

      // Create new leave request
      const {
        employeeId,
        type,
        startDate,
        endDate,
        reason,
        attachmentUrl,
      } = body;

      if (!employeeId || !type || !startDate || !endDate) {
        return NextResponse.json(
          { success: false, error: 'All required fields must be filled' },
          { status: 400 }
        );
      }

      // Calculate number of days
      const daysCalc = calculateLeaveDays(new Date(startDate), new Date(endDate), true);

      // Validate leave balance before creating request
      const shouldCheckBalance = type !== 'UNPAID';
      if (shouldCheckBalance) {
        const leaveYear = new Date(startDate).getFullYear();
        const balance = await db.collection('cvision_leave_balances').findOne({
          tenantId,
          employeeId,
          year: leaveYear,
          leaveType: type,
        });

        if (balance) {
          const requestedDays = daysCalc.workingDays;
          const totalEntitled = balance.entitled + (balance.carriedOver || 0);
          if (balance.used + balance.pending + requestedDays > totalEntitled) {
            return NextResponse.json(
              { success: false, error: 'Insufficient leave balance' },
              { status: 400 }
            );
          }
        }
      }

      // CRITICAL: Check for overlapping leave requests before creating
      const overlappingLeaves = await db.collection('cvision_leaves').find({
        tenantId,
        employeeId,
        status: { $in: ['PENDING', 'APPROVED'] },
        deletedAt: null,
        startDate: { $lte: new Date(endDate) },
        endDate: { $gte: new Date(startDate) },
      }).limit(1).toArray();

      if (overlappingLeaves.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Leave request overlaps with an existing pending or approved leave',
            overlapping: {
              id: overlappingLeaves[0].id || overlappingLeaves[0]._id?.toString(),
              startDate: overlappingLeaves[0].startDate,
              endDate: overlappingLeaves[0].endDate,
              status: overlappingLeaves[0].status,
            },
          },
          { status: 400 }
        );
      }

      // Blackout period enforcement
      const blackouts = await db.collection('cvision_leave_blackouts').find({
        tenantId,
        isActive: true,
        deletedAt: null,
        startDate: { $lte: new Date(endDate) },
        endDate: { $gte: new Date(startDate) },
      }).toArray();

      if (blackouts.length > 0) {
        const employee = await db.collection('cvision_employees').findOne({
          tenantId,
          $or: [{ id: employeeId }, { employeeId }],
        });

        for (const blackout of blackouts) {
          // Check if employee's role is exempt
          if (employee?.role && blackout.exemptRoles?.length > 0 && blackout.exemptRoles.includes(employee.role)) {
            continue;
          }

          // Check if blackout applies to this leave type
          if (blackout.leaveTypes?.length > 0 && !blackout.leaveTypes.includes(type)) {
            continue;
          }

          // Check scope
          let applies = false;
          if (blackout.scope === 'ALL') {
            applies = true;
          } else if (blackout.scope === 'DEPARTMENT' && employee?.departmentId) {
            applies = blackout.scopeIds?.includes(employee.departmentId) ?? false;
          } else if (blackout.scope === 'UNIT' && employee?.unitId) {
            applies = blackout.scopeIds?.includes(employee.unitId) ?? false;
          }

          if (applies) {
            return NextResponse.json({
              ok: false,
              error: 'Leave request blocked by blackout period',
              blackout: {
                name: blackout.name,
                nameAr: blackout.nameAr,
                startDate: blackout.startDate,
                endDate: blackout.endDate,
              },
            }, { status: 409 });
          }
        }
      }

      // PG columns: id, tenantId, employeeId, leaveType (NOT 'type'), startDate, endDate,
      // days (NOT 'totalDays'), reason, status, approvedBy, approvedAt, rejectionReason,
      // attachments (Json, NOT 'attachmentUrl'), createdAt, updatedAt, createdBy, updatedBy, deletedAt
      // NOT in PG (stripped): type → leaveType, totalDays → days, attachmentUrl, requestedAt, isPaid, deductFromBalance
      const leave = {
        tenantId,
        employeeId,
        leaveType: type, // PG column is 'leaveType', not 'type'
        status: 'PENDING',
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        days: daysCalc.workingDays, // PG column is 'days', not 'totalDays'
        reason,
        attachments: attachmentUrl ? [attachmentUrl] : null, // PG column is 'attachments' (Json), not 'attachmentUrl'
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      const result = await db.collection('cvision_leaves').insertOne(leave);

      // Update pending balance — deduct for all leave types except UNPAID
      const shouldDeduct = type !== 'UNPAID';
      if (shouldDeduct) {
        const leaveYear = new Date(startDate).getFullYear();
        await db.collection('cvision_leave_balances').updateOne(
          {
            tenantId,
            employeeId,
            year: leaveYear,
            leaveType: type,
          },
          {
            $inc: { pending: daysCalc.workingDays },
            $setOnInsert: {
              entitled: SAUDI_LEAVE_ENTITLEMENTS[type as keyof typeof SAUDI_LEAVE_ENTITLEMENTS] || 0,
              used: 0,
              carriedOver: 0,
              createdAt: new Date(),
            },
            $set: { updatedAt: new Date() },
          },
          { upsert: true }
        );
      }

      // Lifecycle: start workflow, dispatch event
      onRequestCreated(db, tenantId, 'leave', result.insertedId.toString(), { ...leave, employeeId }, employeeId)
        .catch(err => logger.error('[Lifecycle] leave onRequestCreated failed:', err));

      return NextResponse.json({
        success: true,
        data: {
          id: result.insertedId,
          ...leave,
        },
        message: 'Leave request created successfully',
      });

    } catch (error) {
      logger.error('Leaves API Error:', error);
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_WRITE }
);
