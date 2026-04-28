import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Employee Status Change API
 * POST /api/cvision/employees/[id]/status - Change employee status
 * 
 * Idempotent: Same transition request returns same result without creating duplicate audits.
 * Validates transitions and timestamps using status machine.
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
import { changeEmployeeStatusSchema } from '@/lib/cvision/validation';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import {
  validateTransition,
  isIdempotentTransition,
  EMPLOYEE_STATUSES,
  isValidEmployeeStatus,
  type EmployeeStatusType,
} from '@/lib/cvision/statusMachine';
import type { CVisionEmployee, CVisionEmployeeStatusHistory, EmployeeStatus } from '@/lib/cvision/types';
import { requireCtx, enforce } from '@/lib/cvision/authz/enforce';
import { canWriteEmployee } from '@/lib/cvision/authz/policy';
import { normalizeStatus } from '@/lib/cvision/employees/normalizeStatus';
import { onEmployeeDeparted } from '@/lib/cvision/lifecycle';
import { emit } from '@/lib/events';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// POST - Change employee status
export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      // Build authz context
      const ctxResult = await requireCtx(request);
      if (ctxResult instanceof NextResponse) {
        return ctxResult; // 401 or 403
      }
      const ctx = ctxResult;

      const resolvedParams = await params;
      const id = resolvedParams?.id as string;

      if (!id) {
        return NextResponse.json(
          { error: 'Employee ID is required' },
          { status: 400 }
        );
      }

      const body = await request.json();
      const data = changeEmployeeStatusSchema.parse(body);

      const collection = await getCVisionCollection<CVisionEmployee>(
        tenantId,
        'employees'
      );

      const employee = await findById(collection, tenantId, id);
      if (!employee) {
        return NextResponse.json(
          { error: 'Employee not found' },
          { status: 404 }
        );
      }

      // Enforce write policy (status change requires write permission)
      const writePolicy = canWriteEmployee(ctx, employee);
      const enforceResult = await enforce(writePolicy, request, ctx);
      if (enforceResult) {
        return enforceResult; // 403
      }

      // Normalize to canonical statuses (uppercase)
      const currentStatusCanonical = normalizeStatus(employee.status);
      const requestedStatusCanonical = normalizeStatus(data.status);
      
      // Convert to status machine types (lowercase for status machine)
      const currentStatusRaw = currentStatusCanonical.toLowerCase();
      const requestedStatusRaw = requestedStatusCanonical.toLowerCase();
      
      // Validate that statuses are supported by status machine
      if (!isValidEmployeeStatus(currentStatusRaw)) {
        return NextResponse.json(
          {
            error: 'Invalid current status',
            message: `Current status '${currentStatusRaw}' is not supported. Supported: ${Object.values(EMPLOYEE_STATUSES).join(', ')}`,
          },
          { status: 400 }
        );
      }
      
      if (!isValidEmployeeStatus(requestedStatusRaw)) {
        return NextResponse.json(
          {
            error: 'Invalid requested status',
            message: `Status must be one of: ${Object.values(EMPLOYEE_STATUSES).join(', ')}`,
          },
          { status: 400 }
        );
      }
      
      const currentStatus = currentStatusRaw;
      const requestedStatus = requestedStatusRaw;
      const now = new Date();
      const effectiveDate = data.effectiveDate || now;

      // Validate transition using status machine
      const validation = validateTransition(currentStatus, requestedStatus, effectiveDate);
      if (!validation.allowed) {
        return NextResponse.json(
          {
            error: 'Invalid status transition',
            message: validation.reason,
          },
          { status: 400 }
        );
      }

      // Check idempotency: if same transition already applied, return existing state
      const historyCollection = await getCVisionCollection<CVisionEmployeeStatusHistory>(
        tenantId,
        'employeeStatusHistory'
      );

      // Check if this exact transition already exists (idempotency check)
      const isIdempotent = isIdempotentTransition(
        currentStatus,
        requestedStatus,
        employee.statusChangedAt ? new Date(employee.statusChangedAt) : undefined,
        effectiveDate
      );

      if (isIdempotent) {
        // Find existing history entry for this transition (if any)
        // Use canonical uppercase for PG enum columns
        const existingHistory = await historyCollection
          .find(createTenantFilter(tenantId, {
            employeeId: id,
            fromStatus: currentStatusCanonical,
            toStatus: requestedStatusCanonical,
          }))
          .sort({ createdAt: -1 })
          .limit(1)
          .toArray();

        // Return existing state without creating duplicate audit/history
        return NextResponse.json({
          success: true,
          employee,
          statusHistory: existingHistory[0] || null,
          idempotent: true,
          message: 'Status already at requested state',
        });
      }

      // Check if transition already exists in history (prevent duplicates)
      // Look for recent transitions with same from/to status within 1 day window
      const oneDayAgo = new Date(effectiveDate.getTime() - 24 * 60 * 60 * 1000);
      const existingTransition = await historyCollection.findOne({
        ...createTenantFilter(tenantId, {
          employeeId: id,
          fromStatus: currentStatusCanonical,
          toStatus: requestedStatusCanonical,
        }),
        createdAt: { $gte: oneDayAgo },
      } as Record<string, unknown>);

      if (existingTransition) {
        // Transition already exists - return existing state (idempotent)
        const updated = await findById(collection, tenantId, id);
        return NextResponse.json({
          success: true,
          employee: updated,
          statusHistory: existingTransition,
          idempotent: true,
          message: 'Status transition already applied',
        });
      }

      // Update employee status (store canonical uppercase)
      const updateData: any = {
        status: requestedStatusCanonical, // Store canonical uppercase: "ACTIVE", "PROBATION", etc.
        statusChangedAt: effectiveDate,
        statusEffectiveAt: effectiveDate, // Used by Manpower Dashboard to track when status became effective
        statusReason: data.reason,
        isActive: requestedStatusCanonical !== 'TERMINATED' && requestedStatusCanonical !== 'RESIGNED',
        updatedAt: now,
        updatedBy: userId,
      };

      // Set terminatedAt or resignedAt for RESIGNED/TERMINATED statuses
      if (requestedStatus === EMPLOYEE_STATUSES.TERMINATED) {
        updateData.terminatedAt = effectiveDate;
      } else if (requestedStatus === EMPLOYEE_STATUSES.RESIGNED) {
        updateData.resignedAt = effectiveDate;
      }

      await collection.updateOne(
        createTenantFilter(tenantId, { id }),
        { $set: updateData }
      );

      // Create status history entry (only if not idempotent)
      // Note: historyCollection already defined above

      const historyEntry: CVisionEmployeeStatusHistory = {
        id: uuidv4(),
        tenantId,
        employeeId: id,
        fromStatus: currentStatusCanonical,  // PG enum requires uppercase
        toStatus: requestedStatusCanonical,    // PG enum requires uppercase
        reason: data.reason,
        effectiveDate,
        notes: data.notes,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      };

      await historyCollection.insertOne(historyEntry);

      // Audit log (only if not idempotent)
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'employee_status_change',
        'employee',
        {
          resourceId: id,
          changes: {
            before: { status: currentStatus },
            after: { status: requestedStatus },
          },
          metadata: { reason: data.reason, effectiveDate },
        }
      );

      // Lifecycle: offboarding, cancel pending requests, notifications
      if (['RESIGNED', 'TERMINATED'].includes(requestedStatusCanonical)) {
        const lifecycleDb = await getCVisionDb(tenantId);
        onEmployeeDeparted(lifecycleDb, tenantId, id, requestedStatusCanonical, userId, data.reason)
          .catch(err => logger.error('[Lifecycle] onEmployeeDeparted failed:', err));

        // Emit employee.terminated@v1 — best-effort, never breaks the response.
        try {
          await emit({
            eventName: 'employee.terminated',
            version: 1,
            tenantId,
            aggregate: 'employee',
            aggregateId: id,
            payload: {
              employeeId: id,
              tenantId,
              fromStatus: currentStatusCanonical,
              toStatus: requestedStatusCanonical as 'RESIGNED' | 'TERMINATED',
              effectiveAt: effectiveDate.toISOString(),
            },
          });
        } catch (e) {
          logger.error('events.emit_failed', { category: 'cvision', eventName: 'employee.terminated', error: e });
        }
      }

      const updated = await findById(collection, tenantId, id);

      return NextResponse.json({
        success: true,
        employee: updated,
        statusHistory: historyEntry,
        idempotent: false,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      logger.error('[CVision Employee Status POST]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_STATUS }
);
