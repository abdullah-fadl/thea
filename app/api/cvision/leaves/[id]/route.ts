import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Leave Request Detail API
 * GET  /api/cvision/leaves/:id - Get leave request details
 * PATCH /api/cvision/leaves/:id - Approve or reject leave request
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── Role helpers ─────────────────────────────────────────────
const ADMIN_ROLES = ['admin', 'hr-admin', 'hr-manager', 'super-admin', 'owner', 'thea-owner'];
function isAdminOrHR(role: string): boolean {
  if (!role) return false;
  return ADMIN_ROLES.includes(role.toLowerCase());
}

// Resolve the current user's employee record
async function resolveCurrentEmployee(db: any, tenantId: string, userId: string) {
  return db.collection('cvision_employees')
    .findOne({ tenantId, userId, deletedAt: null });
}

// Check if user is a manager (NURSING_MANAGER) for the employee's unit
async function isManagerForEmployee(db: any, tenantId: string, managerEmpId: string, employeeId: string): Promise<boolean> {
  // Get the employee to find their unitId — use UUID 'id' field (PostgreSQL PK)
  const employee = await db.collection('cvision_employees').findOne({
    tenantId, deletedAt: null, id: employeeId,
  });

  if (!employee) return false;

  const empUnitId = employee.unitId;
  if (!empUnitId) return false; // No unit assigned — deny (requires admin/HR override)

  // Check if the manager is nursingManagerId of that unit
  const unit = await db.collection('cvision_units').findOne({
    tenantId,
    id: empUnitId,
    isActive: { $ne: false },
  });

  if (!unit) return false; // Unit not found — deny (requires admin/HR override)

  return unit.nursingManagerId === managerEmpId ||
    unit.departmentId === employee.departmentId; // Same department fallback
}

// GET - Get single leave request
export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId }, params) => {
    try {
      const resolvedParams = await params;
      const id = resolvedParams?.id as string;

      if (!id) {
        return NextResponse.json(
          { success: false, error: 'Leave request ID is required' },
          { status: 400 }
        );
      }

      const db = await getCVisionDb(tenantId);
      const collection = db.collection('cvision_leaves');

      // Look up by UUID 'id' field (PostgreSQL PK). Fall back to leaveId for legacy data.
      let leave = await collection.findOne({
        id,
        tenantId,
        deletedAt: null,
      });

      // Legacy fallback: try leaveId field (for any old MongoDB-era data)
      if (!leave) {
        leave = await collection.findOne({
          leaveId: id,
          tenantId,
          deletedAt: null,
        });
      }

      if (!leave) {
        return NextResponse.json(
          { success: false, error: 'Leave request not found' },
          { status: 404 }
        );
      }

      // Enrich with employee name
      const employee = leave.employeeId
        ? await db.collection('cvision_employees').findOne({
            tenantId,
            id: leave.employeeId,
          })
        : null;

      return NextResponse.json({
        success: true,
        data: {
          ...leave,
          id: (leave as Record<string, unknown>).id || (leave as Record<string, unknown>)._id?.toString(),
          employeeName: employee
            ? `${(employee as Record<string, unknown>).firstName || ''} ${(employee as Record<string, unknown>).lastName || ''}`.trim() || (employee as Record<string, unknown>).email
            : null,
        },
      });
    } catch (error: any) {
      logger.error('[CVision Leaves GET/:id]', error?.message || String(error));
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_READ }
);

// PATCH - Approve or reject leave request
export const PATCH = withAuthTenant(
  async (request: NextRequest, { tenantId, userId, role, user }, params) => {
    try {
      const resolvedParams = await params;
      const id = resolvedParams?.id as string;

      if (!id) {
        return NextResponse.json(
          { success: false, error: 'Leave request ID is required' },
          { status: 400 }
        );
      }

      const body = await request.json();
      const { action, reviewNotes } = body;

      const validActions = ['approve', 'reject', 'employee-confirm', 'employee-reject', 'manager-approve', 'manager-reject'];
      if (!action || !validActions.includes(action)) {
        return NextResponse.json(
          { success: false, error: `Action must be one of: ${validActions.join(', ')}` },
          { status: 400 }
        );
      }

      const db = await getCVisionDb(tenantId);
      const collection = db.collection('cvision_leaves');

      // Find leave request by UUID id (PostgreSQL PK), fallback to leaveId for legacy
      let leave = await collection.findOne({
        id,
        tenantId,
        deletedAt: null,
      });

      if (!leave) {
        leave = await collection.findOne({
          leaveId: id,
          tenantId,
          deletedAt: null,
        });
      }

      if (!leave) {
        return NextResponse.json(
          { success: false, error: 'Leave request not found' },
          { status: 404 }
        );
      }

      const now = new Date();
      const previousStatus = leave.status;

      // Resolve current user's employee record
      const currentEmployee = await resolveCurrentEmployee(db, tenantId, userId);
      const currentEmpId = currentEmployee?.id || currentEmployee?._id?.toString();

      // Audit context
      const auditCtx = createCVisionAuditContext(
        { userId, role, tenantId, user },
        request
      );

      // ─── Employee Confirmation Flow ──────────────────────────
      if (action === 'employee-confirm') {
        if (leave.status !== 'PENDING_EMPLOYEE' && leave.status !== 'PENDING') {
          return NextResponse.json(
            { success: false, error: `Cannot confirm — current status is "${leave.status}"` },
            { status: 400 }
          );
        }

        // Verify user is the employee concerned (or admin/HR)
        if (!isAdminOrHR(role)) {
          if (!currentEmpId || currentEmpId !== leave.employeeId) {
            return NextResponse.json(
              { success: false, error: 'Only the employee can confirm their own leave request' },
              { status: 403 }
            );
          }
        }

        // PostgreSQL enum only supports: PENDING, APPROVED, REJECTED, CANCELLED
        // Employee confirm keeps status as PENDING (awaiting manager)
        await collection.updateOne(
          { id, tenantId },
          {
            $set: {
              status: 'PENDING',
              updatedAt: now,
              updatedBy: userId,
            },
          }
        );

        // Audit log
        await logCVisionAudit(auditCtx, 'leave_employee_confirm', 'leave', {
          resourceId: id,
          changes: {
            before: { status: previousStatus },
            after: { status: 'PENDING' },
          },
          metadata: { employeeId: leave.employeeId },
        });

        return NextResponse.json({ success: true, message: 'Leave confirmed by employee — awaiting manager approval' });
      }

      if (action === 'employee-reject') {
        if (leave.status !== 'PENDING_EMPLOYEE' && leave.status !== 'PENDING') {
          return NextResponse.json(
            { success: false, error: `Cannot reject — current status is "${leave.status}"` },
            { status: 400 }
          );
        }

        // Verify user is the employee concerned (or admin/HR)
        if (!isAdminOrHR(role)) {
          if (!currentEmpId || currentEmpId !== leave.employeeId) {
            return NextResponse.json(
              { success: false, error: 'Only the employee can decline their own leave request' },
              { status: 403 }
            );
          }
        }

        // PostgreSQL enum: CANCELLED for employee rejection
        await collection.updateOne(
          { id, tenantId },
          {
            $set: {
              status: 'CANCELLED',
              rejectionReason: body.reason || 'Employee declined',
              updatedAt: now,
              updatedBy: userId,
            },
          }
        );

        // Reverse pending balance — guard against going below zero.
        // The filter `pending: { $gte: empRejDays }` ensures the decrement only
        // applies when the stored value is large enough; a no-match is safe here
        // because a balance stuck at 0 is still correct.
        const empRejDays = Number(leave.days || leave.totalDays || 0);
        if (empRejDays > 0) {
          const balRecord = await db.collection('cvision_leave_balances').findOne({
            tenantId, employeeId: leave.employeeId, year: new Date(leave.startDate).getFullYear(), leaveType: leave.leaveType || leave.type,
          });
          if (balRecord) {
            const safeDec = Math.min(empRejDays, Math.max(0, Number(balRecord.pending || 0)));
            if (safeDec > 0) {
              await db.collection('cvision_leave_balances').updateOne(
                { tenantId, employeeId: leave.employeeId, year: new Date(leave.startDate).getFullYear(), leaveType: leave.leaveType || leave.type },
                { $inc: { pending: -safeDec }, $set: { updatedAt: now } }
              );
            }
          }
        }

        // Audit log
        await logCVisionAudit(auditCtx, 'leave_employee_reject', 'leave', {
          resourceId: id,
          changes: {
            before: { status: previousStatus },
            after: { status: 'CANCELLED' },
          },
          metadata: { employeeId: leave.employeeId, reason: body.reason || '' },
        });

        return NextResponse.json({ success: true, message: 'Leave declined by employee' });
      }

      // ─── Manager Approval Flow ──────────────────────────────
      if (action === 'manager-approve' || action === 'approve') {
        const allowedStatuses = ['PENDING_MANAGER', 'PENDING'];
        if (!allowedStatuses.includes(leave.status)) {
          return NextResponse.json(
            { success: false, error: `Cannot approve — current status is "${leave.status}"` },
            { status: 400 }
          );
        }

        // Verify user is a manager or admin/HR
        if (!isAdminOrHR(role)) {
          if (!currentEmployee) {
            return NextResponse.json(
              { success: false, error: 'User employee record not found' },
              { status: 403 }
            );
          }

          const nursingRole = currentEmployee.nursingRole || null;

          // Must be NURSING_MANAGER or HEAD_NURSE to approve
          if (nursingRole !== 'NURSING_MANAGER' && nursingRole !== 'HEAD_NURSE') {
            return NextResponse.json(
              { success: false, error: 'Only managers can approve leave requests' },
              { status: 403 }
            );
          }

          // Verify manager has access to the employee's unit
          const hasAccess = await isManagerForEmployee(db, tenantId, currentEmpId, leave.employeeId);
          if (!hasAccess) {
            return NextResponse.json(
              { success: false, error: 'You do not have authority to approve this employee\'s leave' },
              { status: 403 }
            );
          }
        }

        // Check that the employee has sufficient leave balance before approving
        const approveDays = Number(leave.days || leave.totalDays || 0);
        if (approveDays > 0) {
          const balanceRecord = await db.collection('cvision_leave_balances').findOne({
            tenantId,
            employeeId: leave.employeeId,
            year: new Date(leave.startDate).getFullYear(),
            leaveType: leave.leaveType || leave.type,
          });

          if (!balanceRecord) {
            return NextResponse.json(
              { success: false, error: 'Leave balance record not found — cannot approve without an existing balance' },
              { status: 400 }
            );
          }

          const available = Number(balanceRecord.entitled || 0) + Number(balanceRecord.carriedOver || 0) - Number(balanceRecord.used || 0);
          if (approveDays > available) {
            return NextResponse.json(
              {
                success: false,
                error: `Insufficient leave balance. Requested: ${approveDays} day(s), available: ${available} day(s)`,
              },
              { status: 400 }
            );
          }
        }

        // PostgreSQL columns: status, approvedBy, approvedAt, updatedAt, updatedBy
        await collection.updateOne(
          { id, tenantId },
          {
            $set: {
              status: 'APPROVED',
              approvedBy: userId,
              approvedAt: now,
              updatedAt: now,
              updatedBy: userId,
            },
          }
        );

        // Update balance: move from pending to used.
        // Atomic guard: only apply if entitled - used >= approveDays (prevents race condition).
        if (approveDays > 0) {
          const balFilter: any = {
            tenantId,
            employeeId: leave.employeeId,
            year: new Date(leave.startDate).getFullYear(),
            leaveType: leave.leaveType || leave.type,
          };
          const balResult = await db.collection('cvision_leave_balances').updateOne(
            { ...balFilter, $expr: { $gte: [{ $subtract: [{ $add: ['$entitled', { $ifNull: ['$carriedOver', 0] }] }, '$used'] }, approveDays] } },
            { $inc: { used: approveDays, pending: -approveDays }, $set: { updatedAt: now } }
          );
          if (balResult.matchedCount === 0) {
            // Rollback approval status
            await collection.updateOne({ id, tenantId }, { $set: { status: previousStatus, updatedAt: now } });
            return NextResponse.json(
              { success: false, error: 'Leave balance changed concurrently — please retry' },
              { status: 409 }
            );
          }
        }

        // Audit log
        await logCVisionAudit(auditCtx, 'leave_manager_approve', 'leave', {
          resourceId: id,
          changes: {
            before: { status: previousStatus },
            after: { status: 'APPROVED' },
          },
          metadata: { employeeId: leave.employeeId, approvedBy: userId },
        });

        return NextResponse.json({ success: true, message: 'Leave request approved' });
      }

      if (action === 'manager-reject' || action === 'reject') {
        const allowedStatuses = ['PENDING_MANAGER', 'PENDING'];
        if (!allowedStatuses.includes(leave.status)) {
          return NextResponse.json(
            { success: false, error: `Cannot reject — current status is "${leave.status}"` },
            { status: 400 }
          );
        }

        // Verify user is a manager or admin/HR
        if (!isAdminOrHR(role)) {
          if (!currentEmployee) {
            return NextResponse.json(
              { success: false, error: 'User employee record not found' },
              { status: 403 }
            );
          }

          const nursingRole = currentEmployee.nursingRole || null;

          if (nursingRole !== 'NURSING_MANAGER' && nursingRole !== 'HEAD_NURSE') {
            return NextResponse.json(
              { success: false, error: 'Only managers can reject leave requests' },
              { status: 403 }
            );
          }

          const hasAccess = await isManagerForEmployee(db, tenantId, currentEmpId, leave.employeeId);
          if (!hasAccess) {
            return NextResponse.json(
              { success: false, error: 'You do not have authority to reject this employee\'s leave' },
              { status: 403 }
            );
          }
        }

        const rejectionReason = body.reviewNotes || body.reason || '';

        // PostgreSQL columns: status, rejectionReason, updatedAt, updatedBy
        await collection.updateOne(
          { id, tenantId },
          {
            $set: {
              status: 'REJECTED',
              rejectionReason,
              updatedAt: now,
              updatedBy: userId,
            },
          }
        );

        // Reverse pending balance — guard against going below zero.
        const rejectDays = Number(leave.days || leave.totalDays || 0);
        if (rejectDays > 0) {
          const rejBalRecord = await db.collection('cvision_leave_balances').findOne({
            tenantId, employeeId: leave.employeeId, year: new Date(leave.startDate).getFullYear(), leaveType: leave.leaveType || leave.type,
          });
          if (rejBalRecord) {
            const safeRejDec = Math.min(rejectDays, Math.max(0, Number(rejBalRecord.pending || 0)));
            if (safeRejDec > 0) {
              await db.collection('cvision_leave_balances').updateOne(
                { tenantId, employeeId: leave.employeeId, year: new Date(leave.startDate).getFullYear(), leaveType: leave.leaveType || leave.type },
                { $inc: { pending: -safeRejDec }, $set: { updatedAt: now } }
              );
            }
          }
        }

        // Audit log
        await logCVisionAudit(auditCtx, 'leave_manager_reject', 'leave', {
          resourceId: id,
          changes: {
            before: { status: previousStatus },
            after: { status: 'REJECTED' },
          },
          metadata: { employeeId: leave.employeeId, rejectedBy: userId, reason: rejectionReason },
        });

        return NextResponse.json({ success: true, message: 'Leave request rejected' });
      }

      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
    } catch (error: any) {
      logger.error('[CVision Leaves PATCH/:id]', error?.message || String(error));
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_WRITE }
);
