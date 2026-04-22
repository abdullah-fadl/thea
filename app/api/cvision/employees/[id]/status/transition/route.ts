import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Employee Status Transition API
 * POST /api/cvision/employees/:id/status/transition - Change employee status
 *
 * Enforces state machine transitions, RBAC, idempotency, audit trail, and side-effects.
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  getCVisionDb,
  findById,
  createTenantFilter,
} from '@/lib/cvision/db';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import {
  validateTransition,
  EMPLOYEE_STATUSES as STATUS_MAP,
  isValidEmployeeStatus,
  getAllowedTransitions,
} from '@/lib/cvision/statusMachine';
import { normalizeStatus, assertValidStatus, CANON_STATUSES } from '@/lib/cvision/status';
import {
  getSideEffects,
  calculateEndOfService,
  isOnPayroll,
  type EOSReason,
} from '@/lib/cvision/employees/status-engine';
import type { CVisionEmployee, CVisionEmployeeStatusHistory } from '@/lib/cvision/types';
import { requireCtx, enforce } from '@/lib/cvision/authz/enforce';
import { canWriteEmployee } from '@/lib/cvision/authz/policy';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const transitionSchema = z.object({
  toStatus: z.string().min(1).transform(val => val.toUpperCase()),
  effectiveAt: z.coerce.date().optional(),
  reason: z.string().min(1).max(1000),
  lastWorkingDay: z.coerce.date().optional(),
  endOfServiceAmount: z.number().optional(),
});

const EOS_REASON_MAP: Record<string, EOSReason> = {
  RESIGNED: 'RESIGNATION',
  TERMINATED: 'TERMINATION',
  END_OF_CONTRACT: 'END_OF_CONTRACT',
  RETIRED: 'RETIREMENT',
  DECEASED: 'DEATH',
};

export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      const ctxResult = await requireCtx(request);
      if (ctxResult instanceof NextResponse) return ctxResult;
      const ctx = ctxResult;

      const resolvedParams = await params;
      const id = resolvedParams?.id as string;

      if (!id) {
        return NextResponse.json(
          { error: 'Employee ID is required', code: 'MISSING_EMPLOYEE_ID' },
          { status: 400 },
        );
      }

      const body = await request.json();
      let data;
      try {
        data = transitionSchema.parse(body);
      } catch (error: unknown) {
        const err = error as Record<string, unknown>;
        if (err.name === 'ZodError') {
          return NextResponse.json(
            { error: 'Validation error', details: err.errors, code: 'VALIDATION_ERROR' },
            { status: 400 },
          );
        }
        throw error;
      }

      const collection = await getCVisionCollection<CVisionEmployee>(tenantId, 'employees');
      const employee = await findById(collection, tenantId, id);
      if (!employee) {
        return NextResponse.json({ error: 'Employee not found', code: 'EMPLOYEE_NOT_FOUND' }, { status: 404 });
      }

      // Enforce write policy
      const writePolicy = canWriteEmployee(ctx, employee);
      const writeEnforceResult = await enforce(writePolicy, request, ctx);
      if (writeEnforceResult) {
        let errorMessage = 'Access denied';
        const errorCode = writePolicy.reason || 'FORBIDDEN';
        switch (writePolicy.reason) {
          case 'FORBIDDEN_SCOPE': errorMessage = 'You do not have access to employees in this department'; break;
          case 'EMPLOYEE_STATUS_BLOCKED': errorMessage = `Cannot change status for ${employee.status} employee`; break;
          case 'TERMINATED_ACCESS_BLOCKED': errorMessage = 'Terminated employees cannot access this resource'; break;
          case 'RESIGNED_READONLY': errorMessage = 'Resigned employees have read-only access'; break;
          case 'DEPARTMENT_MISMATCH': errorMessage = 'You do not have access to employees in this department'; break;
          default: break;
        }
        return NextResponse.json({ error: errorMessage, code: errorCode }, { status: 403 });
      }

      const currentStatusCanonical = normalizeStatus(employee.status);

      let requestedStatusCanonical: string;
      try {
        requestedStatusCanonical = assertValidStatus(data.toStatus);
      } catch {
        return NextResponse.json(
          { error: 'Invalid requested status', message: `Status must be one of: ${CANON_STATUSES.join(', ')}`, code: 'INVALID_STATUS' },
          { status: 400 },
        );
      }

      if (!isValidEmployeeStatus(currentStatusCanonical)) {
        return NextResponse.json(
          { error: 'Invalid current status', message: `Current status '${currentStatusCanonical}' is not recognized`, code: 'INVALID_CURRENT_STATUS' },
          { status: 400 },
        );
      }

      const currentStatus = currentStatusCanonical;
      const requestedStatus = requestedStatusCanonical;
      const now = new Date();
      const effectiveDate = data.effectiveAt || now;

      // Validate transition
      const validation = validateTransition(currentStatus, requestedStatus, effectiveDate);
      if (!validation.allowed) {
        return NextResponse.json(
          { error: 'Invalid status transition', message: validation.reason, code: 'INVALID_TRANSITION',
            allowedTransitions: getAllowedTransitions(currentStatus) },
          { status: 400 },
        );
      }

      // Idempotency
      if (currentStatus === requestedStatus) {
        const historyCollection = await getCVisionCollection<CVisionEmployeeStatusHistory>(tenantId, 'employeeStatusHistory');
        const recentHistory = await historyCollection
          .find(createTenantFilter(tenantId, { employeeId: id }))
          .sort({ createdAt: -1 })
          .limit(1)
          .toArray();

        return NextResponse.json({
          success: true, employee, statusHistory: recentHistory[0] || null,
          idempotent: true, noOp: true, message: 'Status already at requested state',
        });
      }

      // Duplicate check
      const historyCollection = await getCVisionCollection<CVisionEmployeeStatusHistory>(tenantId, 'employeeStatusHistory');
      const oneDayAgo = new Date(effectiveDate.getTime() - 86400000);
      const existingTransition = await historyCollection.findOne({
        ...createTenantFilter(tenantId, { employeeId: id, fromStatus: currentStatus, toStatus: requestedStatus }),
        createdAt: { $gte: oneDayAgo },
      } as Record<string, unknown>);

      if (existingTransition) {
        const updated = await findById(collection, tenantId, id);
        return NextResponse.json({
          success: true, employee: updated, statusHistory: existingTransition,
          idempotent: true, noOp: true, message: 'Status transition already applied',
        });
      }

      // Prepare update data with side-effects.
      // Only include fields that are actual PG columns on cvision_employees.
      // Non-PG fields (departedAt, lastWorkingDay, suspendedAt, leaveStartedAt,
      // noticePeriodStartedAt, excludeFromPayroll) are stored in metadata JSONB.
      const updateData: any = {
        status: requestedStatusCanonical,
        statusEffectiveAt: effectiveDate,
        statusReason: data.reason,
        updatedAt: now,
        updatedBy: userId,
      };

      // Extra status fields stored in metadata (not PG columns)
      const metaUpdates: Record<string, any> = {};

      const isDeparted = ['RESIGNED', 'TERMINATED', 'END_OF_CONTRACT', 'RETIRED', 'DECEASED'].includes(requestedStatus);
      const isSuspended = ['SUSPENDED', 'SUSPENDED_WITHOUT_PAY'].includes(requestedStatus);
      const isLeave = ['ON_ANNUAL_LEAVE', 'ON_SICK_LEAVE', 'ON_MATERNITY_LEAVE', 'ON_UNPAID_LEAVE'].includes(requestedStatus);
      const isActiveReturn = requestedStatus === 'ACTIVE';

      if (isDeparted) {
        updateData.isActive = false;
        metaUpdates.departedAt = effectiveDate;
        if (data.lastWorkingDay) metaUpdates.lastWorkingDay = data.lastWorkingDay;
        if (requestedStatus === 'TERMINATED') updateData.terminatedAt = effectiveDate;
        if (requestedStatus === 'RESIGNED') updateData.resignedAt = effectiveDate;
      } else if (isSuspended) {
        updateData.isActive = false;
        metaUpdates.suspendedAt = effectiveDate;
      } else if (isLeave) {
        updateData.isActive = true;
        metaUpdates.leaveStartedAt = effectiveDate;
      } else if (isActiveReturn) {
        updateData.isActive = true;
        if (currentStatus === 'PROBATION') updateData.activatedAt = effectiveDate;
        metaUpdates.suspendedAt = null;
        metaUpdates.leaveStartedAt = null;
      } else if (requestedStatus === 'NOTICE_PERIOD') {
        updateData.isActive = true;
        metaUpdates.noticePeriodStartedAt = effectiveDate;
        if (data.lastWorkingDay) metaUpdates.lastWorkingDay = data.lastWorkingDay;
      } else {
        updateData.isActive = true;
      }

      // Payroll flag (stored in metadata)
      metaUpdates.excludeFromPayroll = !isOnPayroll(requestedStatus);

      // Merge metadata updates into existing metadata JSONB column
      const existingMeta = (employee as Record<string, unknown>).metadata as Record<string, unknown> || {};
      updateData.metadata = { ...existingMeta, ...metaUpdates };

      await collection.updateOne(createTenantFilter(tenantId, { id }), { $set: updateData });

      // End of Service calculation for departed statuses
      let endOfServiceAmount: number | null = null;
      let endOfServiceBreakdown: any | null = null;
      const eosReason = EOS_REASON_MAP[requestedStatus];
      if (eosReason) {
        const empRec = employee as Record<string, unknown>;
        const sections = empRec.sections as Record<string, any> | undefined;
        const financialData = sections?.FINANCIAL?.dataJson as Record<string, number> || {};
        const monthlySalary = financialData.basicSalary || financialData.monthlySalary || 0;
        const housingAllowance = financialData.housingAllowance || 0;
        const hiredAt = employee.hiredAt ? new Date(employee.hiredAt as string | number) : null;
        const yearsOfService = hiredAt ? (effectiveDate.getTime() - hiredAt.getTime()) / (1000 * 60 * 60 * 24 * 365) : 0;

        if (monthlySalary > 0 && yearsOfService > 0) {
          const eosResult = calculateEndOfService({ monthlySalary, housingAllowance, yearsOfService, reason: eosReason });
          endOfServiceAmount = eosResult.totalAmount;
          endOfServiceBreakdown = eosResult;
        }

        // Use caller-provided endOfServiceAmount as fallback when internal calculation
        // yields null (e.g. no salary data on the employee record yet)
        if ((endOfServiceAmount === null || endOfServiceAmount === 0) && data.endOfServiceAmount != null) {
          endOfServiceAmount = data.endOfServiceAmount;
        }
      }

      // Create status history entry
      const historyEntry: CVisionEmployeeStatusHistory = {
        id: uuidv4(),
        tenantId,
        employeeId: id,
        fromStatus: currentStatusCanonical,
        toStatus: requestedStatusCanonical,
        reason: data.reason,
        effectiveDate,
        lastWorkingDay: data.lastWorkingDay || null,
        endOfServiceAmount,
        notes: data.reason,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      };
      await historyCollection.insertOne(historyEntry as CVisionEmployeeStatusHistory);

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'employee_status_transition',
        'employee',
        {
          resourceId: id,
          changes: { before: { status: currentStatus }, after: { status: requestedStatus } },
          metadata: { reason: data.reason, effectiveDate, fromStatus: currentStatus, toStatus: requestedStatus, endOfServiceAmount },
        },
      );

      // Execute side effects (best-effort)
      const sideEffects = getSideEffects({
        currentStatus, newStatus: requestedStatus, employeeId: id,
        isSaudi: ((employee as Record<string, unknown>).nationality as string)?.toLowerCase() === 'saudi' || (employee as Record<string, unknown>).nationality === 'SA',
      });

      const executedEffects: string[] = [];
      const db = await getCVisionDb(tenantId);

      for (const effect of sideEffects) {
        try {
          switch (effect.type) {
            case 'WEBHOOK': {
              const webhooksColl = db.collection('cvision_webhooks');
              const subs = await webhooksColl.find({ tenantId, events: 'employee.status_changed', isActive: true }).limit(100).toArray();
              for (const sub of subs) {
                try {
                  const payload = {
                    event: 'employee.status_changed', employeeId: id,
                    previousStatus: currentStatus, newStatus: requestedStatus,
                    reason: data.reason, effectiveDate: effectiveDate.toISOString(),
                    timestamp: now.toISOString(),
                  };
                  fetch((sub as Record<string, unknown>).url as string, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                  }).catch(() => {});
                } catch {}
              }
              executedEffects.push('Webhook events dispatched');
              break;
            }
            case 'ATTENDANCE_LEAVE': {
              const attendanceColl = db.collection('cvision_attendance');
              // PG columns: id, tenantId, employeeId, date, status, source, notes,
              // lateMinutes, earlyLeaveMinutes, overtimeMinutes, isApproved, ...
              await attendanceColl.insertOne({
                id: uuidv4(), tenantId, employeeId: id,
                date: effectiveDate.toISOString().split('T')[0],
                status: 'ON_LEAVE',
                source: 'SYSTEM',
                notes: `Auto-marked: ${requestedStatus}`,
                lateMinutes: 0, earlyLeaveMinutes: 0, overtimeMinutes: 0,
                isApproved: true, createdAt: now, updatedAt: now,
              });
              executedEffects.push('Attendance marked as on leave');
              break;
            }
            case 'ALERT_HR': {
              const notifColl = db.collection('cvision_notifications');
              await notifColl.insertOne({
                id: uuidv4(), tenantId,
                type: 'STATUS_CHANGE',
                title: `Employee Status Changed: ${employee.firstName} ${employee.lastName}`,
                message: `${employee.firstName} ${employee.lastName} status changed from ${currentStatus} to ${requestedStatus}. Reason: ${data.reason}`,
                severity: isDeparted ? 'high' : isSuspended ? 'high' : 'medium',
                targetRoles: ['hr-admin', 'thea-owner', 'owner', 'admin'],
                employeeId: id, isRead: false,
                createdAt: now,
              });
              executedEffects.push('HR notification created');
              break;
            }
            default:
              executedEffects.push(effect.description);
              break;
          }
        } catch (err) {
          logger.warn(`[Status Transition] Side effect ${effect.type} failed:`, err);
        }
      }

      const updated = await findById(collection, tenantId, id);

      return NextResponse.json({
        success: true,
        employee: updated,
        statusHistory: historyEntry,
        idempotent: false,
        sideEffects: executedEffects,
        endOfService: endOfServiceBreakdown,
      });
    } catch (error: unknown) {
      const err = error as Record<string, unknown>;
      const errMsg = err.message as string | undefined;
      logger.error('[CVision Employee Status Transition POST]', errMsg || String(error), err?.stack);

      if (errMsg?.includes('FORBIDDEN') || errMsg?.includes('UNAUTHORIZED')) {
        return NextResponse.json({ error: errMsg || 'Access denied', code: 'FORBIDDEN' }, { status: 403 });
      }

      return NextResponse.json(
        { error: 'Internal server error', message: errMsg, code: 'INTERNAL_ERROR' },
        { status: 500 },
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_STATUS },
);
