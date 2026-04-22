import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Payroll Payslips API
 * GET /api/cvision/payroll/payslips - List payslips
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  paginatedList,
  createTenantFilter,
} from '@/lib/cvision/db';
import { paginationSchema } from '@/lib/cvision/validation';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { CVisionPayslip, CVisionEmployee } from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - List payslips
export const GET = withAuthTenant(
  async (request, { tenantId, userId, role, user }) => {
    try {
      const { searchParams } = new URL(request.url);
      const params = paginationSchema.parse({
        page: searchParams.get('page'),
        limit: searchParams.get('limit'),
        search: searchParams.get('search'),
        sortBy: searchParams.get('sortBy') || 'createdAt',
        sortOrder: searchParams.get('sortOrder') || 'desc',
        includeDeleted: searchParams.get('includeDeleted'),
      });

      const month = searchParams.get('month');
      const year = searchParams.get('year');
      const status = searchParams.get('status');
      const employeeId = searchParams.get('employeeId');
      const departmentId = searchParams.get('departmentId');

      const collection = await getCVisionCollection<CVisionPayslip>(
        tenantId,
        'payslips'
      );

      // If departmentId filter, find employee IDs in that department first
      let departmentEmployeeIds: string[] | null = null;
      if (departmentId) {
        const empColl = await getCVisionCollection<CVisionEmployee>(tenantId, 'employees');
        const deptEmps = await empColl
          .find(createTenantFilter(tenantId, { departmentId }), { projection: { id: 1 } })
          .toArray();
        departmentEmployeeIds = deptEmps.map((e: any) => e.id);
      }

      // Build filter
      const filter: any = {};
      if (month) {
        filter.month = parseInt(month);
      }
      if (year) {
        filter.year = parseInt(year);
      }
      if (status) {
        filter.status = status;
      }
      if (employeeId) {
        filter.employeeId = employeeId;
      }
      if (departmentEmployeeIds) {
        filter.employeeId = { $in: departmentEmployeeIds };
      }

      const result = await paginatedList(collection, tenantId, params, filter);

      // Enrich with employee names
      const employeesCollection = await getCVisionCollection<CVisionEmployee>(
        tenantId,
        'employees'
      );

      const employeeIds = [...new Set(result.data.map((p: CVisionPayslip) => p.employeeId))];
      const employees = await employeesCollection
        .find(createTenantFilter(tenantId, { id: { $in: employeeIds } }))
        .toArray();

      const employeeMap = new Map(
        employees.map((e: any) => [e.id, {
          name: `${e.firstName || ''} ${e.lastName || ''}`.trim(),
          employeeNo: e.employeeNo || '',
          departmentId: e.departmentId || null,
        }])
      );

      // Enrich with department names
      const deptIds = [...new Set(employees.map((e: any) => e.departmentId).filter(Boolean))];
      let departmentMap = new Map<string, string>();
      if (deptIds.length > 0) {
        const deptCollection = await getCVisionCollection(tenantId, 'departments');
        const depts = await deptCollection
          .find(createTenantFilter(tenantId, { id: { $in: deptIds } }))
          .toArray();
        departmentMap = new Map(depts.map((d: any) => [d.id, d.name]));
      }

      const enrichedData = result.data.map((payslip: CVisionPayslip) => {
        const empInfo = employeeMap.get(payslip.employeeId);
        return {
          ...payslip,
          employeeName: empInfo?.name || 'Unknown',
          employeeNo: empInfo?.employeeNo || '',
          departmentId: empInfo?.departmentId || null,
          departmentName: empInfo?.departmentId ? (departmentMap.get(empInfo.departmentId) || '') : '',
        };
      });

      return NextResponse.json({
        success: true,
        ...result,
        data: enrichedData,
      });
    } catch (error: any) {
      logger.error('[CVision Payslips GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.PAYROLL_READ }
);
