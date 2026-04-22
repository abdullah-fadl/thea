import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Payroll Loans API
 * GET /api/cvision/payroll/loans - List loans
 * POST /api/cvision/payroll/loans - Create loan
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  paginatedList,
  createTenantFilter,
  generateSequenceNumber,
} from '@/lib/cvision/db';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';
import { paginationSchema } from '@/lib/cvision/validation';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { CVisionLoan, CVisionEmployee } from '@/lib/cvision/types';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const createLoanSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  amount: z.number().min(1, 'Amount must be greater than 0'),
  monthlyInstalment: z.number().min(1, 'Monthly instalment must be greater than 0'),
  reason: z.string().optional(),
  startDate: z.string().optional(),
});

// GET - List loans
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

      const status = searchParams.get('status');
      const employeeId = searchParams.get('employeeId');

      const collection = await getCVisionCollection<CVisionLoan>(
        tenantId,
        'loans'
      );

      // Build filter
      const filter: any = {};
      if (status) {
        filter.status = status;
      }
      if (employeeId) {
        filter.employeeId = employeeId;
      }

      const result = await paginatedList(collection, tenantId, params, filter);

      // Enrich with employee names
      const employeesCollection = await getCVisionCollection<CVisionEmployee>(
        tenantId,
        'employees'
      );

      const employeeIds = [...new Set(result.data.map((l: CVisionLoan) => l.employeeId))];
      const employees = await employeesCollection
        .find(createTenantFilter(tenantId, { id: { $in: employeeIds } }))
        .toArray();

      const employeeMap = new Map(
        employees.map((e) => [e.id, {
          name: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email,
          employeeNumber: e.employeeNo || e.employeeNumber || null,
          departmentId: e.departmentId || null,
        }])
      );

      // Get departments for department names
      const departmentIds = [...new Set(employees.map((e: any) => e.departmentId).filter(Boolean))];
      let deptMap = new Map();
      if (departmentIds.length > 0) {
        const { getCVisionCollection: getDeptCollection } = await import('@/lib/cvision/db');
        const deptCollection = await getDeptCollection(tenantId, 'departments');
        const departments = await deptCollection
          .find(createTenantFilter(tenantId, { id: { $in: departmentIds } }))
          .toArray();
        deptMap = new Map(departments.map((d: any) => [d.id, d.name]));
      }

      const enrichedData = result.data.map((loan: CVisionLoan) => {
        const empData = employeeMap.get(loan.employeeId);
        return {
          ...loan,
          employeeName: empData?.name || 'Unknown',
          employeeNumber: empData?.employeeNumber || null,
          departmentId: empData?.departmentId || null,
          departmentName: empData?.departmentId ? deptMap.get(empData.departmentId) || null : null,
        };
      });

      return NextResponse.json({
        success: true,
        ...result,
        data: enrichedData,
      });
    } catch (error: any) {
      logger.error('[CVision Loans GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.PAYROLL_READ }
);

// POST - Create loan
export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }) => {
    try {
      const body = await request.json();
      const data = createLoanSchema.parse(body);

      // Check if employee exists
      const employeesCollection = await getCVisionCollection<CVisionEmployee>(
        tenantId,
        'employees'
      );

      const employee = await employeesCollection.findOne(
        createTenantFilter(tenantId, { id: data.employeeId })
      );

      if (!employee) {
        return NextResponse.json(
          { error: 'Employee not found' },
          { status: 404 }
        );
      }

      // Check for existing active loan
      const loansCollection = await getCVisionCollection<CVisionLoan>(
        tenantId,
        'loans'
      );

      const existingLoan = await loansCollection.findOne(
        createTenantFilter(tenantId, {
          employeeId: data.employeeId,
          status: { $in: ['ACTIVE', 'PENDING'] } as Record<string, unknown>,
        })
      );

      if (existingLoan) {
        return NextResponse.json(
          { error: 'Employee already has an active or pending loan' },
          { status: 400 }
        );
      }

      const now = new Date();
      // Generate loan number atomically to prevent duplicates under concurrency
      const loanNumber = await generateSequenceNumber(tenantId, 'LN');

      const loan: CVisionLoan = {
        id: uuidv4(),
        tenantId,
        employeeId: data.employeeId,
        loanNumber,
        principal: data.amount,
        remaining: data.amount,
        monthlyDeduction: data.monthlyInstalment,
        status: 'PENDING',
        startDate: data.startDate ? new Date(data.startDate) : now,
        endDate: null,
        notes: data.reason || '',
        isArchived: false,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      };

      await loansCollection.insertOne(loan);

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role: role || 'unknown', tenantId, user }, request),
        'loan_create',
        'LOAN',
        {
          resourceId: loan.id,
          changes: {
            after: {
              employeeId: loan.employeeId,
              principal: loan.principal,
              monthlyDeduction: loan.monthlyDeduction,
            },
          },
        }
      );

      return NextResponse.json(
        {
          success: true,
          loan: {
            ...loan,
            employeeName: `${employee.firstNameAr || employee.firstName} ${employee.lastNameAr || employee.lastName}`,
          },
        },
        { status: 201 }
      );
    } catch (error: any) {
      logger.error('[CVision Loans POST]', error?.message || String(error));
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.PAYROLL_WRITE }
);
