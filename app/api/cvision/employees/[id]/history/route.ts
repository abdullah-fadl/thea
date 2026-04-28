import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Employee Status History API
 * GET /api/cvision/employees/[id]/history - Get employee status history
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

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Get employee status history
export const GET = withAuthTenant(
  async (request, { tenantId, role, user }, params) => {
    try {
      const resolvedParams = await params;
      const id = resolvedParams?.id as string;

      if (!id) {
        return NextResponse.json(
          { error: 'Employee ID is required' },
          { status: 400 }
        );
      }

      // Verify employee exists
      const employeeCollection = await getCVisionCollection<CVisionEmployee>(
        tenantId,
        'employees'
      );
      const employee = await findById(employeeCollection, tenantId, id, true);

      if (!employee) {
        return NextResponse.json(
          { error: 'Employee not found' },
          { status: 404 }
        );
      }

      // Department-based access control
      if (role === 'supervisor' && user.department) {
        if (employee.departmentId !== user.department) {
          return NextResponse.json(
            { error: 'Access denied' },
            { status: 403 }
          );
        }
      }

      // Get status history
      const historyCollection = await getCVisionCollection<CVisionEmployeeStatusHistory>(
        tenantId,
        'employeeStatusHistory'
      );

      const history = await historyCollection
        .find(createTenantFilter(tenantId, { employeeId: id }))
        .sort({ effectiveDate: -1, createdAt: -1 })
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
        history,
        total: history.length,
      });
    } catch (error: any) {
      logger.error('[CVision Employee History GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_READ }
);
