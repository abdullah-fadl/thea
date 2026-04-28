import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Employee Status History API
 * GET /api/cvision/employees/:id/status/history - Get employee status transition history
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  findById,
  createTenantFilter,
} from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { CVisionEmployee, CVisionEmployeeStatusHistory } from '@/lib/cvision/types';
import { requireCtx, enforce } from '@/lib/cvision/authz/enforce';
import { canReadEmployee } from '@/lib/cvision/authz/policy';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Get employee status history
export const GET = withAuthTenant(
  async (request, { tenantId }, params) => {
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
          { error: 'Employee ID is required', code: 'MISSING_EMPLOYEE_ID' },
          { status: 400 }
        );
      }

      // Get limit from query params (default: 50)
      const { searchParams } = new URL(request.url);
      const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

      // Verify employee exists
      const employeeCollection = await getCVisionCollection<CVisionEmployee>(
        tenantId,
        'employees'
      );
      const employee = await findById(employeeCollection, tenantId, id);

      if (!employee) {
        return NextResponse.json(
          { error: 'Employee not found', code: 'EMPLOYEE_NOT_FOUND' },
          { status: 404 }
        );
      }

      // Enforce read policy
      const readPolicy = canReadEmployee(ctx, employee);
      const enforceResult = await enforce(readPolicy, request, ctx);
      if (enforceResult) {
        return enforceResult; // 403
      }

      // Get status history
      const historyCollection = await getCVisionCollection<CVisionEmployeeStatusHistory>(
        tenantId,
        'employeeStatusHistory'
      );

      const history = await historyCollection
        .find(createTenantFilter(tenantId, { employeeId: id }))
        .sort({ effectiveDate: -1, createdAt: -1 })
        .limit(limit)
        .toArray();

      return NextResponse.json({
        success: true,
        employee: {
          id: employee.id,
          employeeNumber: employee.employeeNo,
          firstName: employee.firstName,
          lastName: employee.lastName,
          currentStatus: employee.status,
        },
        history: history.map(h => ({
          id: h.id,
          fromStatus: h.fromStatus,
          toStatus: h.toStatus,
          reason: h.reason,
          effectiveDate: h.effectiveDate,
          endOfServiceAmount: (h as Record<string, unknown>).endOfServiceAmount ?? null,
          lastWorkingDay: (h as Record<string, unknown>).lastWorkingDay ?? null,
          createdAt: h.createdAt,
          createdBy: h.createdBy,
        })),
        total: history.length,
      });
    } catch (error: any) {
      logger.error('[CVision Employee Status History GET]', error?.message || String(error), error?.stack);
      
      // Check if it's an authz error that wasn't caught
      if (error.message?.includes('FORBIDDEN') || error.message?.includes('UNAUTHORIZED')) {
        return NextResponse.json(
          { error: error.message || 'Access denied', code: 'FORBIDDEN' },
          { status: 403 }
        );
      }
      
      return NextResponse.json(
        { error: 'Internal server error', message: error.message, code: 'INTERNAL_ERROR' },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_READ }
);
