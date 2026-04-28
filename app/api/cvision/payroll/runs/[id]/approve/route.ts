import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Payroll Approve API
 * POST /api/cvision/payroll/runs/:id/approve
 *
 * Approves payroll run and locks data snapshot (status = APPROVED).
 * Validates that payslips were generated during dry-run before approving.
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
import { emit } from '@/lib/events';
import { shadowEvaluate } from '@/lib/policy';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// POST - Approve payroll run
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

      if (run.status !== 'DRY_RUN') {
        return NextResponse.json(
          {
            error: 'Invalid status',
            message: `Can only approve DRY_RUN runs. Current status: ${run.status}`,
          },
          { status: 400 }
        );
      }

      void shadowEvaluate({ legacyDecision: 'allow', action: 'Approve', principal: { id: userId, type: 'Thea::User', attrs: { tenantId, role: role ?? '', hospitalId: '' } }, resource: { id: runId, type: 'Thea::CvisionEmployee', attrs: { tenantId, organizationId: String((run as any)?.organizationId ?? ''), status: String((run as any)?.status ?? '') } } });

      // Verify payslips exist from dry-run before approving
      const payslipCollection = await getCVisionCollection<CVisionPayslip>(
        tenantId,
        'payslips'
      );
      const payslipCount = await payslipCollection.countDocuments(
        createTenantFilter(tenantId, { runId })
      );

      if (payslipCount === 0) {
        return NextResponse.json(
          {
            error: 'No payslips found',
            message: 'Cannot approve: no payslips were generated during dry-run. Please re-run dry-run first.',
          },
          { status: 400 }
        );
      }

      const now = new Date();

      // Atomic status transition: only update if the run is still in DRY_RUN status.
      // This prevents double-approval when two requests arrive simultaneously —
      // only the first one will find status === 'DRY_RUN' and succeed.
      const approveResult = await runCollection.updateOne(
        createTenantFilter(tenantId, { id: runId, status: 'DRY_RUN' }),
        {
          $set: {
            status: 'APPROVED',
            approvedAt: now,
            approvedBy: userId,
            updatedAt: now,
            updatedBy: userId,
          },
        }
      );

      if (approveResult.modifiedCount !== 1) {
        // Another request already transitioned the status; treat as conflict.
        return NextResponse.json(
          {
            error: 'Conflict',
            message: 'Payroll run was already approved or its status changed. No changes were made.',
          },
          { status: 409 }
        );
      }

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role: role || 'unknown', tenantId, user }, request),
        'payroll_run_approve',
        'PAYROLL_RUN',
        {
          resourceId: runId,
          metadata: {
            action: 'approve',
            period: run.period,
            totals: run.totals || run.totalsJson,
            payslipCount,
          },
        }
      );

      // Emit payroll.run.completed@v1 — best-effort, never breaks the response.
      try {
        await emit({
          eventName: 'payroll.run.completed',
          version: 1,
          tenantId,
          aggregate: 'payroll_run',
          aggregateId: runId,
          payload: {
            runId,
            tenantId,
            period: String(run.period ?? ''),
            status: 'APPROVED',
            payslipCount,
            finalizedAt: now.toISOString(),
          },
        });
      } catch (e) {
        logger.error('events.emit_failed', { category: 'cvision', eventName: 'payroll.run.completed', error: e });
      }

      return NextResponse.json({
        success: true,
        run: {
          ...run,
          status: 'APPROVED',
          approvedAt: now,
          approvedBy: userId,
        },
        payslipCount,
      });
    } catch (error: any) {
      logger.error('[CVision Payroll Approve POST]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.PAYROLL_APPROVE }
);
