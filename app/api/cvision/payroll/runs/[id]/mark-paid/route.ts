import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Payroll Mark as Paid API
 * POST /api/cvision/payroll/runs/:id/mark-paid
 *
 * Marks an APPROVED payroll run as PAID, completing the payroll cycle.
 * Also updates all payslips in the run with paidAt timestamp.
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
import type {
  CVisionPayrollRun,
  CVisionPayslip,
} from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// POST - Mark payroll run as paid
export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
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

      if (run.status !== 'APPROVED') {
        return NextResponse.json(
          {
            error: 'Invalid status',
            message: `Can only mark APPROVED runs as paid. Current status: ${run.status}`,
          },
          { status: 400 }
        );
      }

      const now = new Date();

      // Atomic status transition: only update if still APPROVED
      const paidResult = await runCollection.updateOne(
        createTenantFilter(tenantId, { id: runId, status: 'APPROVED' }),
        {
          $set: {
            status: 'PAID',
            paidAt: now,
            paidBy: userId,
            updatedAt: now,
            updatedBy: userId,
          },
        }
      );

      if (paidResult.modifiedCount !== 1) {
        return NextResponse.json(
          {
            error: 'Conflict',
            message: 'Payroll run status changed concurrently. No changes were made.',
          },
          { status: 409 }
        );
      }

      // Update all payslips in this run with paidAt
      const payslipCollection = await getCVisionCollection<CVisionPayslip>(
        tenantId,
        'payslips'
      );
      const payslipResult = await payslipCollection.updateMany(
        createTenantFilter(tenantId, { runId }),
        {
          $set: {
            paidAt: now,
            updatedAt: now,
          },
        }
      );

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role: role || 'unknown', tenantId, user }, request),
        'payroll_run_mark_paid',
        'PAYROLL_RUN',
        {
          resourceId: runId,
          metadata: {
            action: 'mark_paid',
            period: run.period,
            payslipsUpdated: payslipResult.modifiedCount,
          },
        }
      );

      logger.info('[CVision Payroll Mark Paid] Success:', {
        tenantId,
        runId,
        payslipsUpdated: payslipResult.modifiedCount,
      });

      return NextResponse.json({
        success: true,
        run: {
          ...run,
          status: 'PAID',
          paidAt: now,
          paidBy: userId,
        },
        payslipsUpdated: payslipResult.modifiedCount,
      });
    } catch (error: any) {
      logger.error('[CVision Payroll Mark Paid POST]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.PAYROLL_APPROVE }
);
