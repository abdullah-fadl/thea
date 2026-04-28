import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Payroll Payslip API
 * GET /api/cvision/payroll/payslips/:id - Get payslip details
 * PATCH /api/cvision/payroll/payslips/:id - Update payslip status
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  createTenantFilter,
  findById,
} from '@/lib/cvision/db';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { CVisionPayslip, CVisionEmployee } from '@/lib/cvision/types';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const updatePayslipSchema = z.object({
  status: z.enum(['draft', 'approved', 'paid']).optional(),
  paidAt: z.string().optional(),
  notes: z.string().optional(),
});

// GET - Get payslip details
export const GET = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      const resolvedParams = await params;
      const payslipId = resolvedParams?.id as string;

      if (!payslipId) {
        return NextResponse.json(
          { error: 'Payslip ID is required' },
          { status: 400 }
        );
      }

      const collection = await getCVisionCollection<CVisionPayslip>(
        tenantId,
        'payslips'
      );

      const payslip = await findById(collection, tenantId, payslipId);
      if (!payslip) {
        return NextResponse.json(
          { error: 'Payslip not found' },
          { status: 404 }
        );
      }

      // Get employee name
      const employeesCollection = await getCVisionCollection<CVisionEmployee>(
        tenantId,
        'employees'
      );

      const employee = await employeesCollection.findOne(
        createTenantFilter(tenantId, { id: payslip.employeeId })
      );

      return NextResponse.json({
        success: true,
        payslip: {
          ...payslip,
          employeeName: employee
            ? `${employee.firstName} ${employee.lastName}`
            : 'Unknown',
        },
      });
    } catch (error: any) {
      logger.error('[CVision Payslip GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.PAYROLL_READ }
);

// PATCH - Update payslip status
export const PATCH = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      const resolvedParams = await params;
      const payslipId = resolvedParams?.id as string;

      if (!payslipId) {
        return NextResponse.json(
          { error: 'Payslip ID is required' },
          { status: 400 }
        );
      }

      const body = await request.json();
      const data = updatePayslipSchema.parse(body);

      const collection = await getCVisionCollection<CVisionPayslip>(
        tenantId,
        'payslips'
      );

      const existing = await findById(collection, tenantId, payslipId);
      if (!existing) {
        return NextResponse.json(
          { error: 'Payslip not found' },
          { status: 404 }
        );
      }

      const updateData: any = {
        updatedAt: new Date(),
        updatedBy: userId,
      };

      if (data.status !== undefined) {
        updateData.status = data.status;

        // If marking as paid, set paidAt
        if (data.status === 'paid') {
          updateData.paidAt = data.paidAt ? new Date(data.paidAt) : new Date();
        }
      }

      if (data.notes !== undefined) {
        updateData.notes = data.notes;
      }

      await collection.updateOne(
        createTenantFilter(tenantId, { id: payslipId }),
        { $set: updateData }
      );

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role: role || 'unknown', tenantId, user }, request),
        'payslip_update',
        'PAYSLIP',
        {
          resourceId: payslipId,
          changes: {
            before: { gross: existing.gross, net: existing.net },
            after: updateData,
          },
          metadata: { employeeId: existing.employeeId },
        }
      );

      return NextResponse.json({
        success: true,
        payslip: { ...existing, ...updateData },
      });
    } catch (error: any) {
      logger.error('[CVision Payslip PATCH]', error?.message || String(error));
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
