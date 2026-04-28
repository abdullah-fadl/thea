import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Payroll Payslips API
 * GET /api/cvision/payroll/runs/:id/payslips
 * 
 * Get payslips for a payroll run
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  createTenantFilter,
  findById,
  paginatedList,
  getCVisionDb,
} from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import { paginationSchema } from '@/lib/cvision/validation';
import type {
  CVisionPayrollRun,
  CVisionPayslip,
  CVisionEmployee,
} from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Get payslips for a payroll run
export const GET = withAuthTenant(
  async (request, { tenantId, userId, role }, params) => {
    try {
      const resolvedParams = await params;
      const runId = resolvedParams?.id as string;

      if (!runId) {
        return NextResponse.json(
          { error: 'Run ID is required' },
          { status: 400 }
        );
      }

      const runCollection = await getCVisionCollection<CVisionPayrollRun>(
        tenantId,
        'payrollRuns'
      );
      const run = await findById(runCollection, tenantId, runId);

      if (!run) {
        return NextResponse.json(
          { error: 'Payroll run not found' },
          { status: 404 }
        );
      }

      const { searchParams } = new URL(request.url);
      const paramsParsed = paginationSchema.parse({
        page: searchParams.get('page'),
        limit: searchParams.get('limit'),
        sortBy: searchParams.get('sortBy') || 'employeeId',
        sortOrder: searchParams.get('sortOrder'),
      });

      const payslipCollection = await getCVisionCollection<CVisionPayslip>(
        tenantId,
        'payslips'
      );

      const result = await paginatedList(
        payslipCollection,
        tenantId,
        paramsParsed,
        { runId }
      );

      // Enrich payslips with employee names
      const payslipData = result.data || [];
      const employeeIds = [...new Set(payslipData.map((p: any) => p.employeeId).filter(Boolean))];

      let employeeMap: Record<string, { name: string; employeeNo: string }> = {};
      if (employeeIds.length > 0) {
        const db = await getCVisionDb(tenantId);
        const employees = await db
          .collection('cvision_employees')
          .find({
            tenantId,
            id: { $in: employeeIds },
            deletedAt: null,
          })
          .project({ id: 1, firstName: 1, lastName: 1, email: 1, employeeNo: 1, employeeNumber: 1 })
          .toArray();

        employeeMap = Object.fromEntries(
          employees.map((emp: any) => [
            emp.id,
            {
              name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email || emp.id,
              employeeNo: emp.employeeNo || emp.employeeNumber || '',
            },
          ])
        );
      }

      const enrichedData = payslipData.map((p: any) => ({
        ...p,
        employeeName: employeeMap[p.employeeId]?.name || p.employeeId,
        employeeNo: employeeMap[p.employeeId]?.employeeNo || '',
      }));

      return NextResponse.json({
        success: true,
        run: {
          id: run.id,
          period: run.period,
          status: run.status,
          totals: run.totals || run.totalsJson,
        },
        ...result,
        data: enrichedData,
      });
    } catch (error: any) {
      logger.error('[CVision Payroll Payslips GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.PAYROLL_READ }
);
